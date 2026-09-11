# Mini Wallet Console

A Next.js + Zustand frontend for the mini wallet service in [`../starter`](../starter/README.md). It drives the full deposit → PSP callback → wager → withdrawal flow against the real API and makes the service's guarantees visible: exactly-once credit on duplicate and concurrent callbacks, no overdraw under concurrent wagers, and the turnover lock on withdrawals.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Zustand 5 with the `persist` middleware, Tailwind CSS 4. No component library and no other runtime dependencies.

## Run it

Requires Node 20+ and the API running (see the starter README: `npm run db:up`, `npm run db:migrate`, `npm run dev` in `../starter`).

```bash
cp .env.example .env   # optional; defaults to http://localhost:3000
npm install
npm run dev            # http://localhost:3001
```

The API has no CORS layer, so the browser never calls it directly. Every request goes to `/api/*` on this app and `next.config.ts` rewrites it server-side to `API_URL`. The health badge in the sidebar polls `/api/health` every 15 seconds.

## What you can do

| Page | Actions | API calls |
|---|---|---|
| Overview | Create members, switch the active member, see balance and the turnover gauge, refresh from the API | `POST /members`, `GET /members/:id/wallet` |
| Deposits | Create a Pending deposit; settle it with a `completed` or `failed` callback; replay a callback to see `200 applied=false`; send the opposite outcome to see `409 invalid_transition`; fire five identical callbacks at once; send a free-form callback for any `pspRef` (unknown refs get `404`); settle a different amount to see `amountMismatch` | `POST /deposits`, `POST /psp/callbacks` |
| Wagers | Place a wager; fire N identical wagers concurrently and watch only as many succeed as the balance covers | `POST /wallets/:walletId/wagers` |
| Withdrawals | Request a payout; see the `422 turnover_not_met` body with the outstanding figure while the lock holds | `POST /withdrawals` |
| Activity | Every round trip with request and response bodies, filterable | |

The API has no list endpoints for deposits, wagers or the ledger, so the console keeps its own record of what it asked for and what came back. That record lives in `localStorage` and can be forgotten from the Overview page without touching the API's database. If you clear it, the members still exist server-side.

## Layout

```
src/
├── app/                      # App Router pages: /, /deposits, /wagers, /withdrawals, /activity
├── components/
│   ├── layout/               # AppShell, SideNav, HealthBadge, PageHeader
│   ├── members/              # MemberSwitcher, CreateMemberDialog, NoMember onboarding
│   ├── wallet/               # WalletCard, TurnoverGauge, LocalDataCard
│   ├── deposits/             # DepositForm, CallbackForm (PSP simulator), DepositList
│   ├── wagers/, withdrawals/ # forms and lists
│   ├── activity/             # ActivityFeed
│   ├── forms/                # AmountInput, ErrorNote
│   ├── providers/            # StoreHydrator (rehydrate, request observer, health poll), HydrationGate
│   └── ui/                   # Button, Field/Input/Select, Card/Stat, Badge, Money, CopyButton, Toaster, Empty
├── lib/
│   ├── api/                  # types.ts (wire types), client.ts (fetch + ApiError + observers), endpoints.ts
│   ├── money.ts              # BigInt fixed-scale arithmetic and display formatting
│   ├── validation.ts         # mirrors the API's zod rules for early feedback
│   ├── errors.ts             # ApiError -> one actionable sentence
│   └── format.ts
└── store/
    ├── sessionStore.ts       # members, active member, wallet snapshots (persisted)
    ├── transactionStore.ts   # deposits with callback deliveries, wagers, withdrawals (persisted)
    ├── activityStore.ts      # request log, capped at 300 (persisted)
    ├── operationsStore.ts    # async actions: call the API, update the stores, return an Outcome
    ├── toastStore.ts, healthStore.ts
    └── persist.ts            # shared persist options, hydration helpers
```

## Design notes

- **Money never touches a JS number.** Amounts are strings end to end; the only arithmetic (outstanding turnover, gauge ratio) uses BigInt on an 18-decimal fixed scale in `lib/money.ts`. Inputs are text fields with `inputMode="decimal"`, not `type="number"`.
- **Stores are split by lifetime and concern.** `sessionStore`, `transactionStore` and `activityStore` persist; `operationsStore` is the one place that sequences an API call with the state updates it implies, and returns an `Outcome` instead of throwing so forms can render field-level feedback. Components never import the API client.
- **Hydration without flicker.** Persisted stores use `skipHydration`; `StoreHydrator` rehydrates them after mount and `HydrationGate` shows a skeleton until they are ready, so server and first client render always agree.
- **Every request is observable.** `lib/api/client.ts` notifies observers on each round trip; `StoreHydrator` pipes those into the activity store. Nothing else has to remember to log.
- **Concurrency buttons are the point.** "Complete ×5 concurrently" and "Fire burst" issue parallel requests from one browser so you can watch the API answer with one `applied=true` and four `applied=false`, or accept exactly as many wagers as the balance covers. After a burst the wallet is re-read once, because parallel responses can land out of order.

## Scripts

```bash
npm run dev         # dev server on :3001
npm run build       # production build
npm run start       # serve the build on :3001
npm run typecheck   # tsc --noEmit
```
