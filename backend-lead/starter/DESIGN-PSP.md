# DESIGN-PSP: the 50th PSP

**Question.** How does a junior engineer integrate a new PSP in one day without being able to break the wallet?

**Answer in one line.** Providers are adapters that turn a raw HTTP delivery into one canonical event. The wallet core consumes only canonical events, never provider payloads, and a shared contract test suite decides whether an adapter is allowed to go live.

## The sketch, as C4

Four views following the [C4 model](https://c4model.com/diagrams): System Context, Container, Component, and a Dynamic view of one callback. The Code and Deployment levels are omitted because they add nothing to this question. The Component diagram carries the whole argument: the boundary between the **edge** and the **core** is the line a PSP integration never crosses.

### Level 1: System Context

```mermaid
C4Context
  title System Context. Wallet platform and its payment providers
  Person(player, "Player", "Deposits, wagers and withdraws real money.")
  Person(ops, "Payments operations", "Reviews mismatches and orphans. Flips adapters from shadow to live.")
  System(wallet, "Wallet platform", "Holds member wallets, applies funding events, enforces the ledger invariants.")
  System_Ext(mockPsp, "Mock PSP", "The one provider integrated today.")
  Person(engineer, "Integration engineer", "Adds PSP number fifty in one day. Touches config and fixtures only.")
  System_Ext(otherPsps, "PSP 2 to 50", "Each with its own callback format, signature scheme, status vocabulary and retry habits.")
  Rel(player, wallet, "Deposits, wagers, withdraws", "HTTPS JSON")
  Rel(ops, wallet, "Reads the inbox, changes adapter mode")
  Rel(engineer, wallet, "Adds adapter config and recorded fixtures")
  BiRel(wallet, mockPsp, "Deposit requests out, callbacks back", "HTTPS, webhooks retried")
  BiRel(wallet, otherPsps, "Deposit requests out, callbacks back in provider format", "HTTPS, retried, sometimes out of order")
  UpdateRelStyle(player, wallet, $offsetX="-90", $offsetY="-10")
  UpdateRelStyle(ops, wallet, $offsetX="-20", $offsetY="-40")
  UpdateRelStyle(engineer, wallet, $offsetX="-130", $offsetY="0")
  UpdateRelStyle(wallet, mockPsp, $offsetX="-40", $offsetY="-100")
  UpdateRelStyle(wallet, otherPsps, $offsetX="-40", $offsetY="0")
```

### Level 2: Container

```mermaid
C4Container
  title Container diagram. Wallet platform
  Person(engineer, "Integration engineer", "Touches only config and fixtures.")
  System_Boundary(platform, "Wallet platform") {
    Container(config, "PSP adapter config", "YAML files in the repo", "One file per provider. Loaded at boot into the adapter registry.")
    Container(fixtures, "Recorded fixtures", "JSON files in the repo", "Redacted real callbacks per provider, from sandboxes and the production inbox.")
    Container(contract, "Contract test suite", "Jest, no network", "Runs every adapter against its fixtures and replays them through the real core.")
    Container(api, "Wallet API", "TypeScript, Express, Sequelize", "One process. Routes, the PSP edge and the wallet core.")
    ContainerDb(db, "Wallet database", "PostgreSQL 16", "wallets, funding_txs, wallet_txs ledger, psp_callbacks inbox.")
  }
  System_Ext(psp, "PSP N", "Any of the fifty providers.")
  Rel(engineer, config, "Adds one file")
  Rel(engineer, fixtures, "Records five callbacks from the sandbox")
  Rel(contract, fixtures, "Reads")
  Rel(contract, api, "Replays fixtures, in process")
  Rel(config, api, "Loaded at boot")
  Rel(api, db, "Row locks, ledger and inbox writes", "SQL, one transaction per callback")
  Rel(psp, api, "POST /psp/provider/callbacks", "HTTPS webhook")
  UpdateRelStyle(engineer, config, $offsetY="-20")
  UpdateRelStyle(engineer, fixtures, $offsetX="30", $offsetY="-40")
  UpdateRelStyle(contract, fixtures, $offsetX="20", $offsetY="-10")
  UpdateRelStyle(contract, api, $offsetX="-60", $offsetY="-45")
  UpdateRelStyle(config, api, $offsetX="-150", $offsetY="-10")
  UpdateRelStyle(api, db, $offsetX="10", $offsetY="-30")
  UpdateRelStyle(psp, api, $offsetX="-90", $offsetY="-10")
```

### Level 3: Component, the line

```mermaid
C4Component
  title Component diagram. Wallet API, PSP callback path. No arrow leaves the edge towards the core
  System_Ext(psp, "PSP N", "Provider callback in its own format.")
  Container_Boundary(edge, "EDGE, per provider") {
    Component(registry, "Adapter registry", "TypeScript", "Loads one config file per provider at boot. Knows shadow or live per provider. Builds a declarative adapter from config, or instantiates a custom class for the strange providers.")
    Component(adapter, "PspAdapter", "Interface. Declarative from config, or custom class", "verify: signature, timestamp, allow list. normalize: JSON paths, unit scale, status map. Pure. Imports nothing from the core, the database or the ledger.")
  }
  Container_Boundary(core, "CORE, provider blind") {
    Component(pipeline, "Callback pipeline", "Express route and service", "POST /psp/provider/callbacks. Persists the raw payload to the psp_callbacks inbox first, then verify, normalize, apply. Maps the outcome to an HTTP status through the per provider ack policy.")
    Component(apply, "applyPspEvent", "Service", "The A2 service. SELECT funding_txs FOR UPDATE by provider and pspRef, then the funding state machine. Repeats are no-ops, conflicts are 409. Marks the inbox row applied, duplicate, orphan or rejected.")
    Component(ledger, "Ledger service", "Service", "The only code path that changes a balance. UPDATE wallets and INSERT wallet_txs in the same transaction as the state change.")
  }
  Rel(psp, pipeline, "Raw callback", "HTTPS")
  Rel(pipeline, registry, "get adapter for provider")
  Rel(pipeline, adapter, "verify, then normalize. Returns a canonical PspEvent")
  Rel(pipeline, apply, "PspEvent")
  Rel(apply, ledger, "credit settled amount, add turnover requirement")
  UpdateRelStyle(psp, pipeline, $offsetX="-50", $offsetY="-70")
  UpdateRelStyle(pipeline, registry, $offsetX="-70", $offsetY="-25")
  UpdateRelStyle(pipeline, adapter, $offsetX="-150", $offsetY="40")
  UpdateRelStyle(pipeline, apply, $offsetX="10", $offsetY="-10")
  UpdateRelStyle(apply, ledger, $offsetX="10", $offsetY="-10")
  UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="2")
```

The edge is owned by the integration engineer and is what changes per provider. The core is owned by the wallet team, is provider blind, and is exactly the A2 service from Part A with `pspRef` widened to `(provider, pspRef)`. Every arrow into the edge comes from the core, through the `PspAdapter` interface. No arrow leaves the edge towards the core, the database or the ledger. That is the property the ESLint import rule and CODEOWNERS enforce, and it is why an adapter cannot move money.

### Dynamic view: one callback in live mode

The C4 model draws dynamic diagrams as either collaboration or sequence diagrams. A sequence reads better here because the ordering is the point.

```mermaid
sequenceDiagram
  title Dynamic view. One completed callback from PSP N, live mode
  autonumber
  participant PSP as PSP N
  box rgb(232, 240, 250) CORE. Provider blind
    participant P as Callback pipeline
    participant A as applyPspEvent
    participant L as Ledger service
  end
  box rgb(250, 240, 225) EDGE. Per provider
    participant AD as PspAdapter for PSP N
  end
  participant DB as PostgreSQL

  PSP->>P: POST /psp/pspn/callbacks, raw body and headers
  P->>DB: INSERT psp_callbacks, outcome received
  P->>AD: verify(raw)
  AD-->>P: verified payload, or 401 and stop
  P->>AD: normalize(payload)
  AD-->>P: PspEvent, amount in major units, status mapped
  Note over P,AD: The only crossings of the line. Both are calls from core into edge.
  P->>A: applyPspEvent(event)
  A->>DB: BEGIN. SELECT funding_txs FOR UPDATE by provider and pspRef
  alt transition applies
    A->>L: credit settled amount, add turnover requirement
    L->>DB: UPDATE wallets, INSERT wallet_txs
    A->>DB: UPDATE funding_txs status, UPDATE psp_callbacks outcome applied. COMMIT
  else repeat of the same outcome
    A->>DB: UPDATE psp_callbacks outcome duplicate. COMMIT
  else conflicting outcome or unknown ref
    A->>DB: UPDATE psp_callbacks outcome rejected or orphan. ROLLBACK
  end
  A-->>P: outcome
  P-->>PSP: HTTP status from the ack policy for PSP N
```

In shadow mode the pipeline stops after step 6, logs the event it would have applied, and returns the ack. Everything else is unchanged.

## The abstraction

```ts
// The only thing the core ever sees.
interface PspEvent {
  provider: string;              // 'mockpsp', 'adyen', ...
  pspRef: string;                // our reference, echoed back
  providerEventId: string;       // their id, for dedup across redeliveries
  status: 'pending' | 'completed' | 'failed';
  amount: string;                // major units, decimal string, already scaled
  currency: string;
  receivedAt: Date;
  raw: unknown;                  // kept for the inbox, never read by the core
}

interface PspAdapter {
  readonly name: string;
  verify(req: RawRequest): Promise<VerifiedPayload>;   // throws on bad signature
  normalize(payload: VerifiedPayload): PspEvent;       // pure; no I/O, no wallet imports
  ackPolicy: { onOrphan: 200 | 404; onConflict: 200 | 409 };
}
```

Adapters import nothing from `services/` or `db/`. An ESLint `no-restricted-imports` rule on `src/psp/adapters/**` enforces that, and CODEOWNERS on `src/services/**` and `src/domain/**` means a PSP pull request cannot change the core without a wallet owner's review.

## Where the quirks die

| Quirk | Where it is absorbed |
|---|---|
| Amounts in minor units (`10050` for 100.50) | `unitScale: 2` in adapter config; `normalize` divides with BigNumber. The core never sees minor units. |
| Their status vocabulary (`AUTHORISED`, `SETTLED`, `CHARGEBACK`) | `statusMap` in config to the three canonical statuses; unknown values are rejected at the edge with an alert, never guessed. |
| `success` arrives before `pending` | Nothing to do. The core state machine is monotonic: a `pending` after `Completed` is a no-op, not a regression. |
| Aggressive retries | Inbox dedup on `(provider, providerEventId)`, then the Part A lock and state guard. Ack policy returns 200 to stop the storm. |
| Signature schemes (HMAC header, JWS body, IP allow-list) | `verify()`. Declarative adapter supports HMAC-over-body with a configurable header and secret ref; anything else is a small custom class. |
| Reference in a different JSON path | `refPath`, `amountPath`, `statusPath` as JSON pointers in config. |

## Config over code

Most providers need **no code**. A declarative adapter is built from one file:

```yaml
# config/psp/acmepay.yaml
name: acmepay
verify: { type: hmac-sha256, header: X-Acme-Signature, secretRef: env:ACMEPAY_SECRET }
fields: { ref: /merchantReference, amount: /amount/value, status: /eventType, eventId: /id, currency: /amount/currency }
unitScale: 2
statusMap: { AUTHORISED: pending, SETTLED: completed, REFUSED: failed, CANCELLED: failed }
ack: { onOrphan: 200, onConflict: 200 }
mode: shadow          # shadow | live
```

The registry loads every file at boot. `mode: shadow` means verify, normalize, write the canonical event to the inbox, log what *would* have happened, and do not call `applyPspEvent`. Flipping to `live` is a config change per provider, reviewable and reversible.

## Testing a provider you cannot call in CI

1. **Contract suite, shared by every adapter.** One Jest suite parameterised over `src/psp/adapters/*`, fed by `fixtures/psp/<provider>/`. Required fixtures: `valid-completed`, `valid-failed`, `tampered-signature`, `duplicate-delivery`, `minor-units` (if applicable), `out-of-order`, `unknown-ref`. The suite asserts the canonical event produced, that the tampered fixture is rejected, and that replaying every fixture through the real core against Postgres leaves the ledger invariant intact. No network. An adapter without a green contract suite cannot be registered.
2. **Recorded fixtures, not hand-written ones.** Captured from the provider's sandbox during development and, once live, sampled from the production `psp_callbacks` inbox with amounts and identifiers redacted. The inbox from Part A is the replay source; it already stores the raw payload.
3. **Sandbox smoke, nightly, non-blocking.** Hits the provider's sandbox end to end and posts to a channel on failure. The provider's uptime is not our CI's problem.
4. **Shadow mode in staging, then production.** New adapters run in `shadow` for a day of real traffic. The diff between "would have applied" and the incumbent path is the acceptance test.

## The one-day checklist

Morning: copy the adapter template (`npm run psp:new acmepay` scaffolds config, fixtures directory and the suite entry), capture five sandbox fixtures, fill in the config. Afternoon: contract suite green, deploy to staging in shadow mode, open the PR. The PR touches `config/psp/`, `fixtures/psp/` and at most `src/psp/adapters/acmepay.ts`. If it touches anything below the line, CODEOWNERS stops it.
