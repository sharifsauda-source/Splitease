# SplitEase — Expense Splitting REST API

SplitEase is a backend service for splitting shared expenses within groups, similar to
Splitwise. Users create groups, add expenses, and the app calculates who owes whom using
a debt-simplification algorithm that minimizes the number of transactions needed to
settle a group — rather than settling every pairwise debt individually.

Built to demonstrate a practical, production-shaped Node.js/Express API integrating a
relational database, a NoSQL store, a cache layer, JWT authentication, automated testing,
and a third-party API — all containerized with Docker.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime / Framework | Node.js + Express | Core REST API framework |
| Relational DB | PostgreSQL | Users, groups, membership, and expenses are naturally relational |
| NoSQL DB | MongoDB | Activity feed / event log — schema-flexible, append-only |
| Cache | Redis | Caches each group's computed balances (cache-aside pattern) |
| Auth | JWT + bcrypt | Stateless authentication, industry-standard password hashing |
| Testing | Jest + Supertest | Unit tests for the settlement algorithm, integration tests for the full request flow |
| Third-party API | Open Exchange Rates (open.er-api.com) | Converts expenses entered in other currencies to the group's base currency |
| Containerization | Docker + docker-compose | Spins up Postgres, Mongo, Redis, and the app together with one command |

---

## How to Run Locally

### Option 1 — Full stack with Docker (recommended)

```bash
docker compose up -d --build
```

This starts Postgres, MongoDB, Redis, and the API together. On first run, load the schema
into Postgres:

```bash
docker exec -i splitease-postgres-1 psql -U splitease -d splitease < schema.sql
```

The API is now available at `http://localhost:3000`.

### Option 2 — Local development

```bash
npm install
docker compose up -d postgres mongo redis   # databases only
npm run dev                                  # starts the app with nodemon
```

Copy `.env.example` to `.env` and adjust values as needed before running.

### Running tests

```bash
npm test
```

Runs both the unit tests (settlement algorithm) and integration tests (full signup →
login → group → expense → balances flow against a live Express app and Postgres
instance).

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /auth/signup | Create a user account |
| POST | /auth/login | Returns a JWT |
| POST | /groups | Create a group (creator auto-joins) |
| POST | /groups/:id/members | Add a member to a group |
| GET | /groups/:id | Group details + current member list |
| POST | /groups/:id/expenses | Add an expense; splits evenly among all current members unless custom splits are provided |
| GET | /groups/:id/balances | Who owes whom — the simplified settlement plan (cached in Redis) |
| GET | /groups/:id/activity | Paginated activity feed (from MongoDB) |

All routes except signup/login require a valid JWT, sent as `Authorization: Bearer <token>`.

---

## The Settlement Algorithm

Rather than tracking every individual debt between every pair of group members, SplitEase
reduces a group's finances to the minimum number of payments needed to settle up:

1. **Compute net balances** — for each member, sum what they paid across all expenses,
   minus what they owe across all expense splits. A positive balance means they're owed
   money; negative means they owe money.
2. **Split into creditors and debtors** based on the sign of their balance.
3. **Greedily match** the largest debtor against the largest creditor, settling the
   smaller of the two amounts, and repeat until every balance nets to zero.

This is a greedy algorithm — simple to explain and reason about, and it substantially
reduces transaction count versus naive pairwise settlement — though it isn't guaranteed
to find the mathematically optimal minimum in every edge case. Its time complexity is
O(n log n) for sorting balances plus O(n) for the matching pass.

**Why Redis here:** balance computation requires pulling every expense and split ever
recorded for a group, which gets more expensive as a group's history grows — but people
check balances far more often than they add new expenses. SplitEase caches the computed
settlement plan in Redis under `group:{id}:balances`, and invalidates (deletes) that key
whenever a new expense or settlement is recorded. The next read after invalidation
recomputes fresh and re-caches — the standard cache-aside pattern.

**Why MongoDB here:** the activity log records several different kinds of events
(expense added, member joined, settlement recorded), each with a different shape of
event-specific detail. Modeling that in a relational table would mean either a table with
many unused columns, or a separate table per event type. MongoDB's schema-flexible
documents fit this naturally, and since the activity feed is never joined against
relational data — only paginated — there's no relational benefit lost by keeping it
separate from Postgres.

---

## Data Model

**PostgreSQL** — `users`, `groups`, `group_members`, `expenses`, `expense_splits`, linked
by foreign keys, with composite primary keys on the join tables to prevent duplicate
memberships or splits.

**MongoDB** — a single `activity_log` collection, one document per event:
```json
{
  "group_id": 12,
  "type": "expense_added",
  "actor_user_id": 4,
  "details": { "expense_id": 7, "amount": 3000, "description": "Dinner" },
  "timestamp": "2026-09-19T10:00:00Z"
}
```

**Redis** — key pattern `group:{group_id}:balances`, holding the cached JSON result of
the settlement algorithm for that group.

---

## Project Structure

```
src/
  config/       Database connection setup (Postgres, Mongo, Redis)
  controllers/  Request handlers for auth, groups, and expenses
  middleware/   JWT authentication middleware
  routes/       Express route definitions
  utils/        Settlement algorithm and currency conversion logic
tests/
  settlement.test.js             Unit tests for the settlement algorithm
  expenses.integration.test.js   End-to-end integration test of the full API flow
```
