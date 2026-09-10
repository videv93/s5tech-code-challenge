# Problem 5 — A Crude Server

A CRUD service over **swap orders**, built with **Express 5 + TypeScript + Prisma**.
The resource lines up with Problem 2's currency-swap form, so the two halves of
this submission describe the same domain.

- 5/5 required interface functionalities, plus filtering, pagination and sorting
- Persistent database via Prisma (SQLite by default, PostgreSQL in one config change)
- 55 tests against a **real database** — no mocked ORM
- OpenAPI document **generated from the same Zod schemas the routes validate with**

---

## Quick start

Requires Node 20+.

```bash
cd src/problem5
npm install               # postinstall runs `prisma generate`
cp .env.example .env      # defaults work as-is
npm run db:migrate        # creates prisma/dev.db from the migrations
npm run db:seed           # optional: 24 sample orders
npm run dev               # http://localhost:3000
```

Then open **http://localhost:3000/docs** for the interactive API reference, or
run the requests in [`requests.http`](./requests.http).

```bash
npm test          # 55 tests against a throwaway SQLite database
npm run typecheck
npm run build && npm start   # production build
```

### Configuration

Every variable is validated at boot by [`src/config/env.ts`](./src/config/env.ts) —
a missing or malformed value stops the process with a readable message rather
than surfacing as a connection error on the first request an hour later.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | Prisma connection string. **Required.** |
| `PORT` | `3000` | HTTP port. |
| `NODE_ENV` | `development` | `development` \| `test` \| `production`. |
| `LOG_LEVEL` | `info` | pino level; forced to `silent` under test. |
| `CORS_ORIGIN` | `*` | Comma-separated allowlist, or `*`. |
| `RATE_LIMIT_PER_MINUTE` | `120` | Requests per IP per minute; `0` disables. |

### Switching to PostgreSQL

SQLite is the default so the service runs with zero external infrastructure. The
model uses no SQLite-specific features, so moving to Postgres is two changes:

1. `prisma/schema.prisma` → `provider = "postgresql"`
2. `.env` → `DATABASE_URL="postgresql://swap:swap@localhost:5432/swap_orders"`

then `npm i @prisma/adapter-pg`, swap the adapter in `src/db/client.ts`, and run
`npm run db:migrate`.

### Running it in a container

```bash
docker compose up --build -d      # http://localhost:3200
```

The image is multi-stage: the runtime carries no compiler and no dev
dependencies. It **migrates itself on start** (`prisma migrate deploy`, which is
idempotent, so restarts are safe), runs as the non-root `node` user, and keeps
the SQLite file on a named volume so a redeploy does not take the data with it.
The port binds to `127.0.0.1` only — the way in is through a reverse proxy.

Two things worth knowing about the image. It is built on `node:22-slim` rather
than Alpine because `better-sqlite3` is a native addon with no musl prebuilds,
and `npm rebuild better-sqlite3` is called explicitly because the install runs
with `--ignore-scripts` (otherwise Prisma's postinstall tries to generate into a
source tree the runtime stage does not have). Skip either and the container
starts, then fails on its first query.

---

## API

Base path `/api/v1`. Full contract at `/docs` (`/docs/openapi.json` for the raw spec).

| # | Brief's requirement | Endpoint | Success |
|---|---|---|---|
| 1 | Create a resource | `POST /api/v1/swap-orders` | `201` + `Location` |
| 2 | List with basic filters | `GET /api/v1/swap-orders` | `200` + `meta` |
| 3 | Get details | `GET /api/v1/swap-orders/:id` | `200` |
| 4 | Update details | `PATCH /api/v1/swap-orders/:id` | `200` |
| 5 | Delete | `DELETE /api/v1/swap-orders/:id` | `204` |

Plus `GET /health` (liveness) and `GET /ready` (readiness).

### List filters

| Parameter | Example | Notes |
|---|---|---|
| `status` | `?status=PENDING&status=FAILED` | Repeatable. |
| `fromCurrency` / `toCurrency` | `?fromCurrency=eth` | Case-insensitive. |
| `walletAddress` | `?walletAddress=0x71C7…` | Exact match. |
| `minAmount` / `maxAmount` | `?minAmount=1&maxAmount=10` | Inclusive, on `fromAmount`. |
| `createdAfter` / `createdBefore` | `?createdAfter=2026-01-01T00:00:00Z` | ISO-8601. |
| `q` | `?q=alpha` | Free text over note + wallet. |
| `page` / `limit` | `?page=2&limit=20` | `limit` capped at 100. |
| `sortBy` / `sortOrder` | `?sortBy=fromAmount&sortOrder=asc` | Allowlisted columns only. |

```bash
curl -s 'localhost:3000/api/v1/swap-orders?status=CONFIRMED&limit=2'
```
```json
{
  "data": [ { "id": "…", "fromCurrency": "ETH", "fromAmount": "0.5", "toAmount": "1249.25", "status": "CONFIRMED" } ],
  "meta": { "page": 1, "limit": 2, "total": 10, "totalPages": 5, "hasNextPage": true }
}
```

### Errors

One shape for every failure, always carrying the correlation id:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body or query failed validation",
    "details": [{ "field": "fromAmount", "message": "must be greater than zero", "code": "custom" }],
    "requestId": "c8c35a1d-ee36-4f00-88d2-36c2e1874f7b"
  }
}
```

`400` malformed JSON · `404` no such resource or route · `409` illegal state
transition · `422` validation · `429` rate limited · `500` internal (message
suppressed in production so exception text cannot leak table names or paths).

---

## Design decisions

Layered as **routes → controller → service → repository**, so each layer has one
reason to change: the controller knows HTTP, the service knows the rules, the
repository knows Prisma. It is why the service can be reasoned about without an
HTTP layer, and why swapping the storage engine touches one file.

**Money is never a JavaScript number.** Amounts are `Decimal` in the database,
validated as decimal *strings*, multiplied with BigInt arithmetic
([`src/shared/decimal.ts`](./src/shared/decimal.ts)), and serialised as strings on
the wire. `0.1 * 0.2 === 0.020000000000000004`, and an 18-decimal token amount
exceeds the ~15 significant digits a double holds exactly — silently. Returning a
JSON *number* would undo all of that at `JSON.parse` on the client, so the API
returns `"3750"`, not `3750`.

**`toAmount` is derived, never accepted.** Taking `fromAmount`, `rate` and
`toAmount` from the client would let a caller submit an internally inconsistent
order with no way to tell afterwards which field was wrong.

**Status transitions are a state machine, not an enum.** `PENDING` may become
`CONFIRMED`, `FAILED` or `CANCELLED`; all three are terminal. Without this, a
`PATCH` could walk a settled order back to `PENDING` and replay a settlement.
Encoded as a data table in the service so the whole machine is reviewable at a
glance.

**Some fields are deliberately immutable.** `fromCurrency`, `toCurrency` and
`rate` define the order; changing them rewrites history rather than updating a
record. Correcting them means cancelling and re-creating. Likewise an amount
cannot be amended once the order has settled.

**Parse, don't validate.** Zod schemas at the edge narrow every request to a
typed value before a handler sees it, so nothing downstream re-checks shapes. The
schemas are `.strict()`, so an unknown field is a `422` rather than a silent
drop — a client that misspells `walletAddres` finds out immediately.

**Pagination sorts on a tiebreaker.** `orderBy` always ends with `id: 'asc'`.
Without it, rows sharing a `createdAt` can be ordered differently between two
queries, and the same record appears on page 1 *and* page 2. There is a test for
exactly that.

**`limit` is capped at 100.** An uncapped page size is a denial-of-service
primitive handed to every client.

**Every request carries a correlation id**, echoed as `x-request-id`, attached to
each log line and included in every error body — so a user reporting "it failed"
hands over one string that finds the exact request.

**Graceful shutdown** on `SIGTERM`/`SIGINT`: stop accepting connections, drain
in-flight requests, close the pool, with a 10s backstop. Without it, every deploy
drops whatever was mid-flight and the user sees a random 502.

**Liveness does not touch the database; readiness does.** A liveness probe that
fails on a database blip gets the container killed and restarted, which fixes
nothing and turns a degradation into an outage.

**The OpenAPI document is generated from the validation schemas**
(`z.toJSONSchema`, native in Zod 4). Hand-written API docs drift from the
implementation within about two sprints; this cannot, because there is one
definition of each shape.

---

## Testing

```
✓ src/shared/decimal.test.ts             (10 tests)
✓ src/modules/swap-orders/…routes.test.ts (45 tests)
  55 passed
```

Tests run against a **real SQLite database** created from the migrations and
deleted afterwards, not a mocked Prisma client. Mocking the ORM would verify that
our mocks agree with our code; it would not catch a bad `where` clause, a Decimal
that round-trips wrong, or a unique-constraint violation — which is most of what
can actually break here. The app is built by a factory and driven in-process
through supertest, so there is no port binding and no flaky "address already in
use".

The suite pins the reasoning above, not just the happy path: precision is
preserved where a float would lose it, a settled order cannot be reopened or
amended, no row appears on two pages, `?limit=5000` is refused, malformed JSON is
`400` and not `500`, and a non-UUID id is `422` and not a stack trace.

---

## Assumptions declared

- **The brief says "a resource" without naming one.** I chose swap orders to
  match Problem 2, so the submission reads as one system.
- **`PATCH`, not `PUT`.** The brief says "update resource details", which is
  partial-update semantics. A `PUT` would require the client to resend every
  field and would silently clear anything omitted.
- **No authentication.** Out of scope here and not mentioned in the brief — and
  Problem 6 is where the auth design belongs. `walletAddress` is a plain column,
  not a foreign key to a user.
- **Hard delete, not soft.** The brief says "delete". In a real financial ledger
  this would be a soft delete or a cancellation, since orders are records of what
  happened — noted below.

## Improvements I would make next

1. **Authentication and per-wallet authorisation.** Every order is currently
   world-readable. See Problem 6 for how I would do the token design.
2. **Soft delete / append-only ledger.** Financial records should not vanish;
   `deletedAt` plus an audit trail (the `PaperTrail` pattern) preserves history.
3. **Keyset pagination** on `(createdAt, id)` once the table is large enough that
   `COUNT(*)` and `OFFSET` start to hurt — offset pagination degrades linearly
   with page depth.
4. **Idempotency keys on `POST`.** A retried create currently makes a second
   order. An `Idempotency-Key` header with a short-lived unique index fixes it.
5. **Redis-backed rate limiting.** The in-memory limiter is honest about being
   single-node: it does not survive a restart and does not coordinate across
   replicas, so behind N instances the effective limit is N×.
6. **Optimistic concurrency** via a `version` column, so two concurrent `PATCH`es
   cannot silently overwrite one another.
7. **OpenTelemetry traces and a `/metrics` endpoint** — the logs already carry the
   correlation id, so spans are the missing half.
