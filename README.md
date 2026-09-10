# 99Tech / S5 Tech — Code Challenge

[![CI](https://github.com/videv93/s5tech-code-challenge/actions/workflows/ci.yml/badge.svg)](https://github.com/videv93/s5tech-code-challenge/actions/workflows/ci.yml)

All six problems, each self-contained in its own folder with its own README,
tests and run instructions.

**Live:** [s5tech.duelcode.online](https://s5tech.duelcode.online) (Problem 2 — swap app) ·
[api.duelcode.online/docs](https://api.duelcode.online/docs) (Problem 5 — API)

| # | Problem | Deliverable | Tests |
|---|---|---|---|
| 1 | [Three ways to sum to n](./src/problem1) | 3 JavaScript implementations | 65 |
| 2 | [Fancy Form](./src/problem2) | Currency swap app — Vite + React 19 + TS + Tailwind 4 · **[live demo](https://s5tech.duelcode.online)** | 101 |
| 3 | [Messy React](./src/problem3) | 24 findings + refactored component | 29 |
| 4 | [Three ways to sum to n](./src/problem4) | 3 TypeScript implementations + complexity analysis | 58 |
| 5 | [A Crude Server](./src/problem5) | Express 5 + TypeScript + Prisma CRUD service · **[live API](https://api.duelcode.online/docs)** | 55 |
| 6 | [Architecture](./src/problem6) | Live scoreboard module specification + diagrams | — |

**308 tests, all passing.** Every folder runs with `npm install && npm test`.

---

## Quick tour

**Problem 1 & 4** — the same task in JavaScript and TypeScript, answered with
different sets of strategies so the two are not a copy-paste of each other.
Problem 4's complexity claims are backed by a runnable benchmark, and both
declare their assumptions about negative input up front.

**Problem 2** — a swap form built against the *live* price feed, including the
two things the real data actually does wrong: duplicate currency entries, and
icon filenames whose casing does not match the feed. Money never becomes a
JavaScript number anywhere in the app.
**Running at [s5tech.duelcode.online](https://s5tech.duelcode.online)**; screenshots
in [its README](./src/problem2#readme).

**Problem 3** — the analysis is the deliverable. 24 findings, led by the fact
that **the component as written crashes on mount**, and with that fixed renders
the wrong wallets with blank amount columns. Each fix carries a test that fails
against the original behaviour — including the performance claim.

**Problem 5** — swap orders, chosen to line up with Problem 2 so the submission
reads as one system, and **the swap form submits to it**: a completed swap is a
row in this service, and the receipt links to the record. **Running at
[api.duelcode.online/docs](https://api.duelcode.online/docs)**. Tests run against a real database rather than a mocked ORM.
OpenAPI docs are generated from the same Zod schemas the routes validate with.

**Problem 6** — a scoreboard module spec written for a team to implement, with
four Mermaid diagrams (also rendered to SVG). Its centre of gravity is the honest
answer to "prevent malicious users": a client-dispatched score increment cannot
be trusted in principle, so the design turns the question into *"is this the
redemption of a specific, server-issued, single-use permit?"*

---

## Running everything

```bash
# Problems 1, 3, 4 — pure logic, no setup
(cd src/problem1 && npm install && npm test)
(cd src/problem3 && npm install && npm test)
(cd src/problem4 && npm install && npm test && npm run bench)

# Problem 2 — the swap app
(cd src/problem2 && npm install && npm test && npm run dev)

# Problem 5 — the API service
(cd src/problem5 && npm install && cp .env.example .env && npm run db:migrate && npm run db:seed && npm test && npm run dev)
# then open http://localhost:3000/docs

# Problem 6 — documentation
open src/problem6/README.md
```

Each project pins its own dependencies; there is no shared root install.

---

## CI/CD

One workflow, [`.github/workflows/ci.yml`](./.github/workflows/ci.yml), with two
jobs.

**`verify`** runs a matrix over all five code projects — install from the
lockfile, typecheck, lint, test, build. It uses
`npm run <script> --if-present`, so a single job definition covers five
different toolchains without special-casing: problem 1 has no typecheck, only
problem 2 lints, and neither is a reason to fork the config. `fail-fast` is off
so one red project cannot hide the state of the other four.

**`deploy`** `needs: verify`, so a failing suite anywhere blocks publication,
and only runs on a push to `main`. It is deliberately excluded from the
concurrency cancellation that applies to CI — interrupting a deploy mid-upload
is how a half-published site happens. After publishing it smoke-tests the real
URL, because a 200 from the CDN is not by itself proof the app works.

Deploys go to Cloudflare as an assets-only Worker; the custom domain is declared
in [`wrangler.jsonc`](./src/problem2/wrangler.jsonc), so DNS is managed by the
deploy rather than by hand.

## How I approached this

**Assumptions are declared, not hidden.** Where a brief is ambiguous — what
`sum_to_n(-5)` should return, whether `amount <= 0` in Problem 3 was a typo, which
resource Problem 5 should expose — every README has an "Assumptions declared"
section stating the reading I took and why.

**Tests pin the reasoning, not just the happy path.** The interesting assertions
are the ones that would fail against a plausible wrong implementation: that a
price tick does not re-run a sort (Problem 3), that `MAX` produces exactly the
balance and not a rounded one (Problem 2), that a settled order cannot be
reopened (Problem 5), that no row appears on two pages (Problem 5), that the
closed form reads `n` exactly once (Problem 4).

**Comments explain why, not what.** Every non-obvious decision carries its
reasoning at the point where a future reader would question it.

**Stack:** TypeScript throughout, React 19, Vite, Tailwind 4, Radix, TanStack
Query, React Hook Form + Zod, Express 5, Prisma, Vitest, Testing Library, MSW.
