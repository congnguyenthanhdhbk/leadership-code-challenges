# Mini Wallet Service - Starter

This is the starter codebase for the Backend Lead take-home. The task itself is described in [`../readme.md`](../readme.md). Design reasoning is in [`DECISIONS.md`](DECISIONS.md) and the PSP integration note in [`DESIGN-PSP.md`](DESIGN-PSP.md).

## Stack

TypeScript, Express, Sequelize, PostgreSQL, Jest. Money is `DECIMAL(36,18)` in Postgres, strings in JS/JSON, and all arithmetic goes through `bignumber.js` (see `src/lib/money.ts`).

## Setup

Requires Node 20+ and Docker.

```bash
cp .env.example .env
npm install
npm run db:up        # starts Postgres on localhost:5439 (dev + test databases)
npm run db:migrate   # migrates the dev database
npm test             # migrates the test database and runs the test suite
npm run dev          # starts the API on :3000
```

If port 5439 clashes with something on your machine, change it in `docker-compose.yml` and `.env`.

## Endpoints

All amounts are positive decimal strings with at most 18 fractional digits. Responses return amounts as fixed 18-decimal strings.

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| `POST` | `/members` | `{ username }` | 201 member + wallet | 400 |
| `GET` | `/members/:memberId/wallet` | | 200 `{ id, memberId, balance, turnoverRequired, turnoverAccrued }` | 404 |
| `POST` | `/deposits` | `{ memberId, amount, turnoverMultiplier? }` | 201 `{ id, pspRef, status: 'Pending', amount, turnoverMultiplier }` | 400, 404 |
| `POST` | `/psp/callbacks` | `{ pspRef, status: 'completed' \| 'failed', amount }` | 200 `{ id, pspRef, status, amount, settledAmount, amountMismatch, applied }` | 400, 404, 409 |
| `POST` | `/wallets/:walletId/wagers` | `{ amount }` | 201 `{ walletId, balance, turnoverAccrued }` | 400, 404, 422 |
| `POST` | `/withdrawals` | `{ memberId, amount }` | 201 `{ id, status: 'Pending', amount, balance }` | 400, 404, 422 |

Error bodies carry a stable `error` code:

| Code | Status | Extra fields |
|---|---|---|
| `validation_error` | 400 | `details` (zod issues) |
| `not_found` | 404 | `resource`, `id` |
| `invalid_transition` | 409 | `from`, `to` |
| `unsupported_callback` | 409 | `pspRef`, `kind`, `reason` |
| `insufficient_balance` | 422 | `balance`, `requested` |
| `turnover_not_met` | 422 | `required`, `accrued`, `outstanding` |

### Walkthrough

```bash
BASE=http://localhost:3000

# 1. Member with an empty wallet
MEMBER=$(curl -s -X POST $BASE/members -H 'content-type: application/json' -d '{"username":"alice01"}')
MEMBER_ID=$(echo $MEMBER | jq -r .member.id); WALLET_ID=$(echo $MEMBER | jq -r .wallet.id)

# 2. Pending deposit of 100 with a 1x turnover requirement
DEP=$(curl -s -X POST $BASE/deposits -H 'content-type: application/json' \
  -d "{\"memberId\":\"$MEMBER_ID\",\"amount\":\"100.00\",\"turnoverMultiplier\":1}")
PSP_REF=$(echo $DEP | jq -r .pspRef)

# 3. PSP says it completed. Send it twice: the second is an idempotent 200 with applied=false.
curl -s -X POST $BASE/psp/callbacks -H 'content-type: application/json' \
  -d "{\"pspRef\":\"$PSP_REF\",\"status\":\"completed\",\"amount\":\"100.00\"}"
curl -s -X POST $BASE/psp/callbacks -H 'content-type: application/json' \
  -d "{\"pspRef\":\"$PSP_REF\",\"status\":\"completed\",\"amount\":\"100.00\"}"

# 4. Withdrawal is blocked: 422 turnover_not_met, outstanding 100
curl -s -X POST $BASE/withdrawals -H 'content-type: application/json' \
  -d "{\"memberId\":\"$MEMBER_ID\",\"amount\":\"50.00\"}"

# 5. Wager 60 (balance 40, accrued 60). Still blocked: outstanding 40.
curl -s -X POST $BASE/wallets/$WALLET_ID/wagers -H 'content-type: application/json' -d '{"amount":"60.00"}'
curl -s -X POST $BASE/withdrawals -H 'content-type: application/json' \
  -d "{\"memberId\":\"$MEMBER_ID\",\"amount\":\"50.00\"}"

# 6. Wager 40 (balance 0, accrued 100 = required). Top up with a 0x deposit so there is money to withdraw.
curl -s -X POST $BASE/wallets/$WALLET_ID/wagers -H 'content-type: application/json' -d '{"amount":"40.00"}'
DEP2=$(curl -s -X POST $BASE/deposits -H 'content-type: application/json' \
  -d "{\"memberId\":\"$MEMBER_ID\",\"amount\":\"100.00\",\"turnoverMultiplier\":0}")
curl -s -X POST $BASE/psp/callbacks -H 'content-type: application/json' \
  -d "{\"pspRef\":\"$(echo $DEP2 | jq -r .pspRef)\",\"status\":\"completed\",\"amount\":\"100.00\"}"

# 7. Withdraw 50 -> 201, status Pending, balance 50
curl -s -X POST $BASE/withdrawals -H 'content-type: application/json' \
  -d "{\"memberId\":\"$MEMBER_ID\",\"amount\":\"50.00\"}"

# 8. Wallet state: balance 50, turnoverRequired 100, turnoverAccrued 100
curl -s $BASE/members/$MEMBER_ID/wallet
```

## Layout

```
src/
├── app.ts               # express app factory + error handler (DomainError -> HTTP)
├── index.ts             # entrypoint
├── config.ts
├── container.ts         # composition root: wires repositories, services and handlers
├── lib/
│   ├── money.ts         # BigNumber helpers - use these for all money math
│   ├── validation.ts    # zod schemas for amounts, uuids, turnover multiplier
│   └── errors.ts        # DomainError hierarchy with stable codes
├── domain/              # pure rules, no I/O
│   ├── fundingStateMachine.ts   # the only place that knows legal transitions
│   ├── walletMovement.ts        # movement type, sign derived from kind
│   └── walletPolicies.ts        # TurnoverMetPolicy, SufficientBalancePolicy
├── db/
│   ├── sequelize.ts
│   ├── transactionRunner.ts     # unit-of-work boundary services depend on
│   ├── cli-config.js    # sequelize-cli config (used by npm run db:migrate)
│   ├── migrations/      # members, wallets, funding_txs, wallet_txs + psp_callbacks, wallet turnover
│   └── models/
├── repositories/        # the only code that queries or locks rows
│   ├── walletRepository.ts        # lockById / lockByMemberId are the FOR UPDATE reads
│   ├── fundingTxRepository.ts     # create Pending, lockByPspRef
│   ├── ledgerRepository.ts        # append() only
│   └── callbackInboxRepository.ts
├── routes/              # thin: validate with zod, delegate to a service
└── services/
    ├── ledgerService.ts           # the one code path that changes wallets.balance
    ├── walletDebitOperation.ts    # template: lock, policies, movement, ledger, one transaction
    ├── wagerService.ts            # A3, extends the template
    ├── withdrawalService.ts       # A4, extends the template with the turnover policy first
    ├── depositService.ts          # A1
    └── psp/
        ├── pspCallbackService.ts        # A2: inbox, lock, state machine, delegate
        └── callbackOutcomeHandlers.ts   # strategies for completed and failed
test/                    # one file per concern; helpers.ts for setup and ledger reads
```

## Conventions to keep

- Money never touches JS `number`. Strings at the boundaries, BigNumber in between.
- Any operation writing more than one row runs in a single DB transaction (see `memberService.createMember`).
- Routes validate input with zod and delegate to services; business logic lives in services, not routes.
- New tables are created via migrations, not `sync()`.
- Every change to a wallet balance goes through `LedgerService.post` under a `FOR UPDATE` lock, and lock order is always funding row first, then wallet.
- New wallet debits extend `WalletDebitOperation` and add policies; they do not open their own transactions or touch models directly.
