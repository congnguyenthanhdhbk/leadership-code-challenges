# DECISIONS

Trade-offs made while implementing the deposit → wager → withdrawal flow, recorded as they were applied. The code is evidence for these decisions, not the other way round.

## Invariants

Six properties the wallet must hold. Each is enforced in the database, again in the service layer, and has a test that fails if either guard is removed.

| # | Invariant | Database | Service | Test |
|---|---|---|---|---|
| I1 | A completed deposit credits exactly once | `UNIQUE (psp_ref)` on `funding_txs` | `FOR UPDATE` on the funding row, then the state guard; a repeat delivery sees `Completed` and returns 200 without writing | `pspCallbacks.test.ts`: sequential duplicate, 10 concurrent duplicates |
| I2 | Balance never goes negative | `CHECK (balance >= 0)` on `wallets` | wallet row locked, compared with BigNumber, debited in the same transaction; loser gets 422 | `wagers.test.ts`: balance 100, ten concurrent wagers of 15, exactly six succeed |
| I3 | Ledger reconstructs balance | append-only `wallet_txs` with signed `amount` and `balance_after`; a trigger rejects `UPDATE`/`DELETE` | one method, `LedgerService.post`, is the only code that assigns `balance`, and it writes the ledger row in the same transaction; `LedgerRepository` exposes `append` only | `ledger.test.ts`: mixed concurrent load, `SUM(amount)` = balance, `balance_after` is a consistent running total |
| I4 | State transitions are explicit | three-value enum | `domain/fundingStateMachine.transition(from, to)` owns the edges; repeat of the applied outcome is a no-op, a conflicting outcome is 409 | `pspCallbacks.test.ts` state machine block, `fundingStateMachine.test.ts` |
| I5 | Withdrawal only when turnover is met | non-negative `turnover_required` / `turnover_accrued` on `wallets` | under the wallet lock: if accrued < required, 422 with the outstanding figure | `withdrawals.test.ts`: blocked with outstanding 40, then unblocked |
| I6 | Money never touches a JS `number` | `DECIMAL(36,18)`; pg returns strings | Zod accepts decimal strings with ≤ 18 fractional digits; all arithmetic via `lib/money.ts`; `toMoney()` writes a fixed 18-dp string | `grep -rnE "parseFloat|Number\(|\+amount" src/` returns only the port |

## Locking

**Pessimistic row locks, one transaction per money movement.** Every service method opens a Sequelize transaction, locks the rows it will change with `SELECT ... FOR UPDATE`, checks, writes, commits. Postgres serialises concurrent callers on the locked row, so the second callback delivery or the second wager observes the first one's committed result, never a stale read.

**Lock order is fixed:** funding transaction first, then wallet. Wagers and withdrawals lock only the wallet. No code path locks in the other order, so no deadlock is possible. Inserts into `funding_txs` and `wallet_txs` take a `FOR KEY SHARE` on the referenced wallet, which waits briefly behind a concurrent `FOR UPDATE` but never forms a cycle.

**Why exactly-once holds.** The row lock makes concurrent deliveries take turns. The state guard makes every turn after the first a read-only no-op. The unique index makes it impossible to have two funding rows to race between. Any one of the three could fail and the other two would still hold.

**Rejected alternatives.**
- `SERIALIZABLE` isolation with retry loops. Correct, but it moves the correctness burden into a retry layer that every caller must get right, and gives no benefit at this scale.
- Optimistic versioning (`version` column, compare-and-swap). Hot wallets retry-storm under load and, again, every caller has to implement the retry.
- Advisory locks keyed on wallet id. Works, but adds a second locking primitive next to the row locks Postgres already gives us.

**Where this stops scaling.** A very hot wallet (one member, thousands of wagers per second) serialises on one row. Long-held locks would hurt if the callback path ever made a network call while holding one; today it does not. The replacement, when needed, is a per-wallet queue or single-writer partition so the lock is never contended, not a change to the invariants.

**Test harness.** Sequelize's default pool of 5 would have queued half of ten concurrent requests on the pool before they ever reached the lock, making the concurrency tests quietly sequential. `pool.max` is 25 under `NODE_ENV=test` and 10 otherwise. This is the only configuration change.

## Schema

Three migrations, each reversible (`db:migrate:undo:all` then `db:migrate` was run on both databases).

- **`funding_txs`**: one row per PSP-facing operation. `kind` (deposit | withdrawal), `status` (Pending | Completed | Failed), `amount` (what was asked for), `settled_amount` (what the PSP said moved), `amount_mismatch`, `psp_ref` **unique**, `turnover_multiplier`. `CHECK (amount > 0)`.
- **`wallet_txs`**: append-only ledger. Signed `amount`, `balance_after`, nullable `funding_tx_id`, no `updated_at`. A `BEFORE UPDATE OR DELETE` trigger raises, so append-only is a property of the database and not only of the code.
- **`psp_callbacks`**: raw inbox. Every delivery is inserted *before* the money transaction opens, with `outcome = received`, then updated to `applied | duplicate | orphan | rejected`. A crash mid-processing leaves a `received` row as evidence. This table is also the replay source for Part B.
- **`wallets` (altered)**: `turnover_required`, `turnover_accrued`, and three non-negative `CHECK`s.

**Materialised balance plus ledger**, rather than ledger-only, keeps every read a single row and keeps the invariant provable with one `SUM`. `balance_after` on each row makes any drift locatable to the exact entry.

**Turnover counters instead of derived sums.** Required and accrued could be computed from `funding_txs` and `wallet_txs` on every withdrawal. Storing them on the wallet keeps the withdrawal check to one locked row and one comparison, and they are updated in the same transaction as the money, so they cannot drift from it.

## Rulings

Where the brief leaves something open, this is what was chosen and why.

| Question | Ruling | Why this and not the alternative |
|---|---|---|
| Callback amount differs from deposit amount | Credit the **settled** amount from the callback. Persist both, set `amount_mismatch = true`, log at warn level. Turnover requirement follows the settled amount. | The callback is what the PSP says actually moved. Crediting the requested amount invents money or hides a shortfall. Parking the transaction in a review state is the other defensible answer; it needs a fourth state and an approval path the brief said not to build. It is the production choice; see next steps. |
| Unknown `pspRef` | Persist the raw callback with outcome `orphan`, respond 404. | Nothing to lock, nothing to credit. Storing the payload means a late deposit row or a support case can still be matched. Many PSPs retry on non-2xx forever, so in production a 200 acknowledgement with an alert is the likely real answer. |
| Repeat callback with the same outcome | 200, idempotent no-op, echo the current state with `applied: false`. | Retries must be safe to acknowledge. A 409 here would cause retry storms. |
| Callback conflicting with a terminal state | 409 `invalid_transition { from, to }`, no write, inbox row marked `rejected`. | Silently applying it is the failure the brief names. A loud reject is what the state machine is for. |
| Callback for a withdrawal's `pspRef` | 409 `unsupported_callback`, no write. | Payout callbacks are out of scope, and a completed callback must never be able to credit a wallet through a withdrawal row. |
| Withdrawal larger than balance | 422 `insufficient_balance`, checked after the turnover gate under the same lock. | The brief only mentions the turnover check, but a wallet that never loses money cannot overdraw. Turnover first because it is the anti-abuse control and its 422 body is specified. |
| Does a withdrawal reset turnover? | No. Required and accrued are lifetime counters; outstanding is `max(required − accrued, 0)`. | Simplest model that satisfies the rule as written. Real platforms often reset on withdrawal or track per deposit; this is an open product question. |
| `turnoverMultiplier` of 0 | Allowed. Adds nothing to required turnover. | The brief says integer ≥ 0. |
| Failed deposit and turnover | Adds no requirement. Only completion changes wallet state. | No money arrived, so nothing to lock against. |
| Precision of `amount` | `^\d{1,18}(\.\d{1,18})?$` and > 0. More than 18 decimals is a 400. | Anything the column cannot hold exactly is rejected at the edge, not rounded silently. |
| Malformed callback body | 400 before the inbox insert. | The inbox needs a `pspRef` to be useful. A body with no parseable reference is noise, not evidence. |
| Currency | Single implicit currency. Out of scope. | Adding a currency column without conversion rules is theatre. |

## Testing

Real Postgres, no mocks. The existing harness migrates the test database and truncates between tests. One file per concern, plus `test/helpers.ts` (create member, deposit, complete callback, read ledger).

Concurrency tests build the full array of requests before awaiting any of them, and assert **exact** counts: one `applied: true` out of ten callbacks, exactly six of ten wagers succeed, one credit per deposit under a mixed load of callbacks, wagers and withdrawals. A test that awaits in a loop is a sequential test with a misleading name.

Named minimum from the brief, and where it lives:
- Sequential duplicate callback → `pspCallbacks.test.ts`
- Concurrent duplicate callbacks → `pspCallbacks.test.ts`
- Concurrent wagers cannot overdraw → `wagers.test.ts`
- Turnover lock blocks and unblocks → `withdrawals.test.ts`

Beyond the minimum: state machine conflicts in both directions, amount mismatch, unknown ref with orphan inbox row, failed deposit adds no turnover, ledger sum and running `balance_after` under concurrent load, the append-only trigger, the balance `CHECK`, input validation edge cases, and pure unit tests for the state machine and the wallet policies.

## Structure

The services were first written as plain functions, then refactored once all four endpoints and the tests were green. The refactor changed no behaviour and no test. It introduced a small set of patterns, each chosen because it makes an invariant structural rather than a matter of discipline.

| Pattern | Where | What it makes structural |
|---|---|---|
| Repository | `repositories/` | The only code that queries or locks rows. `lockById`, `lockByMemberId` and `lockByPspRef` are the `FOR UPDATE` reads by name; `LedgerRepository` has an `append` method and nothing else, so append-only is true in code as well as in the trigger. |
| Unit of Work | `db/transactionRunner.ts` | Services depend on a `TransactionRunner` interface, not on Sequelize. One `run()` per money movement. |
| Template Method | `services/walletDebitOperation.ts` | Wagers and withdrawals share the skeleton lock, policies, movement, ledger post, all inside one transaction. Subclasses cannot reorder or skip a step, so a future debit type cannot forget the lock. |
| Policy | `domain/walletPolicies.ts` | Each business gate is one pure object with a `check()` that throws the right `DomainError`. Withdrawal lists `[TurnoverMetPolicy, SufficientBalancePolicy]`; the order is visible in one line. Pure, so unit tested without a database. |
| Strategy | `services/psp/callbackOutcomeHandlers.ts` | One handler per terminal outcome. The callback service owns the exactly-once guards; a handler owns what applying the outcome means. A new outcome is a new handler, not an edit to the guard code. |
| Composition root | `container.ts` | The only file that constructs services. Routes import instances from it; a test can build a service with a fake runner or repository. |

**Not adopted.** No dependency-injection library, no event bus, no command bus, no generic base repository. The brief says the exercise fits in what is already there, and each of those would add surface area without making any invariant harder to break.

## Deviations from the starter

None of the conventions were broken. Additions: a database trigger on `wallet_txs` (the README asks for migrations, not `sync()`; a trigger is still a migration), a larger connection pool under test, `toMoney()` in `lib/money.ts` so every stored and returned amount is a fixed 18-decimal string, and a `DomainError` hierarchy mapped in the existing error handler so routes stay as thin as the members route.

## AI tools

Claude Code (Claude Fable 5.1) was used throughout this submission:

- **Planning.** It produced the written build plan (invariants table, rulings table, lock order, schema, timeboxed phases) from the brief and the starter code before any code was written. The plan was reviewed and adjusted before implementation began.
- **Implementation.** Migrations, models, services, routes and tests were drafted by the assistant from that plan, phase by phase, run against Postgres after each phase, and committed in the order the plan prescribed.
- **Review.** It ran the pre-submission checks: the money-math grep, migration roll-down and roll-up, three repeated runs of the suite for flakiness, and the fresh-clone run.
- **Documents.** The first drafts of this file and `DESIGN-PSP.md` were written by the assistant and edited.

Everything in this repository was read and is defensible line by line. The decisions in the rulings table are mine, in the sense that I chose to apply them; the interview will test that.

## Next steps

In roughly priority order, with more time:

1. **Review state for amount mismatches.** A fourth funding state (`UnderReview`) with an approval endpoint, instead of crediting the settled amount and flagging. Planned below.
2. **Reconciliation job** against PSP settlement reports, keyed on `psp_ref`, comparing `settled_amount` and detecting orphans that later got a deposit row.
3. **Withdrawal lifecycle**: approval, PSP payout request, payout callback moving the withdrawal to `Completed` or `Failed` with a refund credit on failure.
4. **Idempotency key on `POST /deposits`** so a client retry does not create two pending deposits.
5. **Ack policy per PSP**: return 200 for orphans and conflicts where the provider retries on non-2xx forever, and alert instead.
6. **Outbox** for side effects (notifications, analytics) so they are written in the money transaction and delivered after commit.
7. **Structured logging** with `pspRef` as the correlation id, and metrics on inbox outcomes.
8. **Currency** as a first-class column with per-currency scale, once there is a rule for what happens across currencies.
9. **Per-wallet write queue** if a single hot wallet ever makes the row lock the bottleneck.

## Plan: review state for amount mismatches

Next step 1, planned against the code as it stands after the structure refactor. Nothing here is implemented yet. The plan replaces the "credit the settled amount and flag" ruling with a hold, and adds the human decision the current ruling says is the production answer.

### What changes and what does not

A deposit callback whose `amount` differs from the requested amount no longer credits anything. The funding row moves `Pending → UnderReview`, the PSP figure is persisted as `settled_amount`, and the delivery is acknowledged with 200. An operator then approves (credit the settled amount, `→ Completed`) or rejects (`→ Failed`, no credit). Matching callbacks, failed callbacks, wagers and withdrawals are untouched. I1, I2, I3, I5 and I6 are unchanged; I4 gains a state and gains an actor.

### The trap this plan is built around

Today the callback service asks `transition(fundingTx.status, handler.target)` where `target` is fixed per handler (`Completed` for `completed`). If `UnderReview` were added with the naive edge `UnderReview → Completed`, then a PSP **retry** of the mismatched callback, or a second delivery with the corrected figure, would satisfy that edge and credit the wallet with no human involved. The hold would be theatre. Two rules follow:

1. The target state is a function of the row **and** the input, not of the handler alone. `completed` with a matching figure targets `Completed`; with a different figure it targets `UnderReview`.
2. Edges are owned by an actor. The PSP may move `Pending` to `Completed`, `Failed` or `UnderReview`. Only an operator may move `UnderReview` to `Completed` or `Failed`. The PSP has no edge out of `UnderReview`, so any callback that would leave it is a 409, exactly like a callback against a terminal state today.

### State machine

```
  psp:       Pending     ──▶ Completed
             Pending     ──▶ Failed
             Pending     ──▶ UnderReview
  operator:  UnderReview ──▶ Completed
             UnderReview ──▶ Failed

  Completed and Failed are terminal for everyone.
  The PSP has no edge out of UnderReview; the operator has no edge out of Pending.
```

`transition(from, to, actor: 'psp' | 'operator')` in `domain/fundingStateMachine.ts`, with one `EDGES` table per actor. `from === to` stays a no-op for both actors, so a PSP retry of the mismatched callback is `duplicate`, and a second click on approve is `applied: false`. `isTerminal` is unchanged: `UnderReview` has outgoing edges, so it is not terminal.

### Rulings for the new state

| Question | Ruling | Why |
|---|---|---|
| What counts as a mismatch | Any difference. `settled.isEqualTo(amount)` is false, the row is held. No tolerance band. | A band is a product decision with a number in it that nobody has given. Adding one later is a policy object, not a schema change. |
| PSP retries the same mismatched callback while `UnderReview` | 200, `applied: false`, inbox `duplicate`. | Same outcome already applied. Retries must be safe to acknowledge. |
| PSP sends `completed` with the **matching** figure while `UnderReview` | 409 `invalid_transition { from: UnderReview, to: Completed }`, inbox `rejected`. | The PSP has now reported two different figures for one payment. That is exactly what a person should look at, and a delivery must never be able to credit a held row. |
| PSP sends `completed` with a **third** figure while `UnderReview` | 200, `applied: false`, inbox `duplicate`, warn log with both figures. The first figure stays in `settled_amount`. | The target state is the same, so the state machine says no-op. The inbox holds every payload, so the reviewer can see all of them. |
| PSP sends `failed` while `UnderReview` | 409 `invalid_transition { from: UnderReview, to: Failed }`. | Conflicting outcome. Rejecting the payment is the operator's decision now, not the PSP's. |
| What approve credits | `settled_amount`, the PSP figure. Turnover requirement follows it. The endpoint does not accept an amount. | The approve decision means "the PSP is right, credit what moved". Letting an operator type a figure is a third source of truth and a fraud surface. Crediting the requested amount is inventing money. |
| What reject does | `→ Failed`. No credit, no ledger row, no turnover. `settled_amount` is kept as evidence. | Whatever the PSP actually moved is settled out of band. The wallet never saw it. |
| Approve or reject a `Pending` deposit | 409 `invalid_transition { from: Pending, to: Completed }`. | The PSP has not spoken yet. An operator completing a deposit without a callback is a credit with no evidence behind it. |
| Repeat approve after approve | 200, `applied: false`. | Idempotent, same as a callback retry. |
| Reject after approve, or approve after reject | 409. | Terminal states have no outgoing edges for anyone. |
| Review a withdrawal's id, or an unknown id | 404 `not_found { resource: 'deposit' }`. | The endpoint lives under `/deposits`; a withdrawal is not a deposit as far as it is concerned. |
| Who is the reviewer | `reviewedBy` is a required string in the request body. | There is no auth in the starter. The field is where the authenticated principal goes once there is one; the plan does not build auth. |
| Inbox outcome for a hold | `applied`. No new `psp_callbacks.outcome` value. | The delivery did move the funding row. Which rows were held is answered by `funding_txs.review_reason`, not by the inbox. |

### Schema

One new migration, reversible.

- `ALTER TYPE enum_funding_txs_status ADD VALUE 'UnderReview'`. sequelize-cli does not wrap a migration in a transaction, which matters because Postgres cannot use a new enum value in the transaction that added it.
- New nullable columns on `funding_txs`: `review_reason TEXT`, `reviewed_by TEXT`, `review_note TEXT`, `reviewed_at TIMESTAMPTZ`.
- Two `CHECK`s so the database, not the service, enforces the shape: `status <> 'UnderReview' OR review_reason IS NOT NULL` (a row cannot be held without a reason), and `reviewed_at IS NULL OR status IN ('Completed', 'Failed')` (a decision only exists on a resolved row).
- Partial index `funding_txs (created_at) WHERE status = 'UnderReview'` for the review queue.
- `down`: Postgres cannot drop an enum value. The migration refuses to roll down if any row is `UnderReview`, then recreates the three-value type and swaps the column over with a cast, then drops the columns and the index. This is the standard recipe and it is the only migration in the repo whose `down` can refuse.

The comment on `settled_amount` changes from "null until a terminal callback is applied" to "null until a callback carrying a figure is applied". `amount_mismatch` keeps its meaning and is now always `true` on a held row.

Rejected: a separate `funding_tx_reviews` table. A row is reviewed at most once by construction, so columns on the row are the audit trail, and the join buys nothing.

### Code

| File | Change |
|---|---|
| `db/models/fundingTx.ts` | `FundingTxStatus` gains `'UnderReview'`; new declared fields; `FUNDING_TX_STATUSES` updated so the model enum matches the migration. |
| `domain/fundingStateMachine.ts` | `Actor = 'psp' \| 'operator'`; `EDGES` becomes `Record<Actor, Record<FundingTxStatus, FundingTxStatus[]>>`; `transition(from, to, actor)`. Still the only file that knows an edge. |
| `services/depositCredit.ts` (new) | `DepositCredit.apply(tx, fundingTx, settled)`: lock the wallet, `ledger.post` the credit with the turnover delta, update the row to `Completed` with `settled_amount`. This is the body of today's `CompletedDepositHandler.apply`, lifted out so the callback path and the approve path are one code path. After this change, exactly one place in `src/` can complete a deposit. |
| `services/psp/callbackOutcomeHandlers.ts` | `CallbackOutcomeHandler.target` becomes `resolveTarget(fundingTx, input): FundingTxStatus`. `CompletedDepositHandler` returns `UnderReview` on mismatch and `Completed` otherwise; its `apply` either holds (write `UnderReview`, `settled_amount`, `amount_mismatch`, `review_reason = 'amount_mismatch'`) or delegates to `DepositCredit`. `FailedDepositHandler.resolveTarget` returns `Failed`. |
| `services/psp/pspCallbackService.ts` | Calls `handler.resolveTarget(fundingTx, input)` then `transition(status, target, 'psp')`. No other change; the three guards stay where they are. |
| `services/depositReviewService.ts` (new) | `review(depositId, { decision, reviewedBy, note })`. One `transactions.run`: `fundingTxs.lockById`, 404 if missing or not a deposit, `transition(status, decision === 'approve' ? 'Completed' : 'Failed', 'operator')`, then `DepositCredit.apply` or a `Failed` update, and stamp `reviewed_by`, `review_note`, `reviewed_at`. Returns `{ applied, fundingTx }`. |
| `repositories/fundingTxRepository.ts` | `lockById(id, tx)` next to `lockByPspRef`; `FundingTxChanges` gains the review fields; `listUnderReview()` for the queue. |
| `routes/deposits.ts` | `POST /deposits/:depositId/review` with body `{ decision: 'approve' \| 'reject', reviewedBy: string, note?: string }`, 200 with the funding tx and `applied`. `GET /deposits?status=UnderReview` returning the queue, oldest first. |
| `routes/pspCallbacks.ts` | Response gains `reviewReason`. Status code stays 200 for a hold; the PSP needs an acknowledgement, not a semantic. |
| `lib/errors.ts` | `NotFoundError` resource union gains `'deposit'`. No new error class: every failure is an existing `invalid_transition` or `not_found`. |
| `container.ts` | Construct `DepositCredit` once, hand it to both `CompletedDepositHandler` and `DepositReviewService`. |

Lock order is unchanged. The review service locks the funding row by id, then the wallet inside `DepositCredit`. The callback service locks the same funding row by `psp_ref`, then the wallet. An approve racing a PSP retry serialises on the funding row; whichever runs second sees the committed state and the state machine gives it `noop` or 409. No new lock, no new order, no deadlock.

### Tests

`fundingStateMachine.test.ts`
- PSP edges from `Pending` reach all three states; operator has no edge from `Pending`.
- Operator edges from `UnderReview` reach both terminals; PSP has no edge from `UnderReview`, including to `Completed`.
- `UnderReview` is not terminal. `from === to` is a no-op for both actors.

`pspCallbacks.test.ts`
- Rewrite the existing mismatch test: `Pending → UnderReview`, balance 0, no ledger row, turnover 0, `settledAmount` = the PSP figure, `amountMismatch = true`, `reviewReason = 'amount_mismatch'`, inbox `applied`.
- Retry of the mismatched callback: 200, `applied: false`, still no ledger row, inbox `['applied', 'duplicate']`.
- Matching `completed` after a hold: 409 `{ from: 'UnderReview', to: 'Completed' }`, inbox `rejected`, balance still 0.
- `failed` after a hold: 409.
- Ten concurrent mismatched callbacks: exactly one `applied: true`, row `UnderReview`, ledger count 0. Same shape as the existing exactly-once test, built with `Promise.all` over a prebuilt array.

`depositReview.test.ts` (new)
- Approve: row `Completed`, balance = settled, turnover required = settled × multiplier, one ledger row with `fundingTxId`, `reviewedBy` and `reviewedAt` set.
- Reject: row `Failed`, balance 0, no ledger row, `settledAmount` retained.
- Approve a `Pending` deposit: 409 `{ from: 'Pending', to: 'Completed' }`.
- Repeat approve: 200, `applied: false`, still one ledger row.
- Reject after approve: 409, balance unchanged.
- Unknown id and a withdrawal's id: 404 `{ resource: 'deposit' }`.
- Five concurrent approves and five concurrent rejects on one held row: exactly one `applied: true`; if the row ends `Completed` the ledger has one row, if `Failed` it has none. The test asserts the pair, not the winner.
- Approve racing ten PSP retries of the mismatched callback: one credit, `SUM(amount)` = balance.
- Queue: two held deposits and one completed, `GET /deposits?status=UnderReview` returns the two, oldest first.

Unchanged and expected green with no edits: `wagers`, `withdrawals`, `ledger`, `walletPolicies`, `deposits`, `members`. The money grep must still return only the port.

### Phases

Timeboxed; each ends with the suite green and one commit.

1. **Migration and model** (30 min). Enum value, columns, checks, index, reversible `down`. Run `db:migrate:undo` and `db:migrate` on both databases before moving on, because the enum `down` is the one that can bite.
2. **State machine** (30 min). Actor parameter, edge tables, unit tests. The only call site is updated with `'psp'` so behaviour is identical at the end of this phase.
3. **Hold on mismatch** (45 min). `DepositCredit` extracted, `resolveTarget`, the hold branch. The old mismatch test goes red here and is rewritten. Concurrent hold test added.
4. **Review endpoint** (45 min). Repository `lockById`, service, route, container. New test file.
5. **Queue endpoint** (20 min). `listUnderReview`, `GET /deposits?status=UnderReview`, one test.
6. **Documents** (20 min). README endpoint table and error table; DECISIONS: I4 row (four-value enum, actor-scoped edges), the mismatch ruling row replaced with a pointer to the rulings above, this plan section rewritten in the past tense, next step 1 removed; DESIGN-PSP: `applyPspEvent` note that a mismatch holds rather than credits.
7. **Pre-submission checks** (15 min). Money grep, migration roll-down and roll-up, three repeated suite runs, fresh-clone run.

### Out of scope, deliberately

- Authentication of the reviewer. `reviewedBy` is a body field until there is a principal to take it from.
- A tolerance band or per-PSP mismatch policy. It slots in as a `walletPolicies`-style object that `resolveTarget` consults, once someone owns the number.
- Notifying anyone that a row is held. That is the outbox in next step 6.
- Holding for reasons other than amount mismatch. `review_reason` is `TEXT` rather than a one-value enum so a second reason is a string, not a migration, but no second reason is being added here.
