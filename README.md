# Reachflow

A full-stack email scheduler built for the ReachInbox internship assignment. A modern React dashboard sits on an Express MVC backend, with PostgreSQL persistence, BullMQ delayed jobs, Redis throttling, Elasticsearch search, Google OAuth, Slack OAuth, and Ethereal SMTP.

## Start here

See **[SETUP.md](SETUP.md)** for the full from-scratch Google/Slack/Docker setup and live demo steps. See **[docs/API.md](docs/API.md)** for request/response documentation.

```sh
npm install
npm run setup
npm run infra:up
npm run db -w backend
npm run search:init -w backend
# Add Google and Slack credentials to .env locally.
npm run doctor
npm run dev
```

Open **http://localhost:5173**. Without infrastructure/credentials, run `npm run dev -w frontend` and choose **Take a look around** for an explicitly labeled sample workspace. It never sends mail or substitutes for the required real Google login.

## Structure

```text
reachflow/
├── frontend/src/
│   ├── pages/          # Login, dashboard, senders, integrations
│   ├── components/     # Compose, email table, details, status badges
│   ├── hooks/          # Workspace data, polling, accessible dialogs
│   ├── services/       # Typed HTTP client
│   ├── types/          # Frontend data contracts
│   ├── utils/          # Lead parser and isolated sample fixtures
│   └── styles/         # Responsive visual system, self-hosted fonts
├── backend/src/
│   ├── routes/         # URLs → controllers
│   ├── controllers/    # Validation, HTTP input/output
│   ├── models/         # Relational reads and transactions
│   ├── services/       # Scheduling, OAuth, search, notifications
│   ├── middleware/     # Auth, operator authorization, error handling
│   ├── validators/     # Scheduling schema
│   ├── config/         # Typed env, database, Redis, queues
│   ├── workers/        # BullMQ email + reconciliation process
│   ├── scripts/        # Setup, migrations, search init, diagnostics
│   ├── types/          # Session declarations
│   └── utils/          # Authenticated encryption
├── tests/              # Service tests and React interaction tests
├── docs/API.md
├── examples/leads.csv
└── compose.yaml
```

React supplies the MVC view layer; the backend returns JSON. Routes select controllers, controllers handle HTTP/validation, services orchestrate domain behavior, and models encapsulate persistence. Workers run outside the HTTP lifecycle and share those services/configuration.

## Architecture and reliability

**Durable scheduling.** A PostgreSQL transaction stores an idempotent batch and all recipients in a bulk insert. Each email UUID becomes its BullMQ job ID. Immediate enqueue is followed by durable reconciliation every ten seconds using a BullMQ recurring delayed job, with no OS cron or cron libraries. Keyset pagination scans all pending rows instead of allowing the first page to starve later batches. A queue outage after DB commit leaves accepted rows available for reconciliation.

**Restart persistence and duplicates.** Redis AOF uses `appendfsync always` and `noeviction`; PostgreSQL, Redis, and Elasticsearch have persistent volumes. Completed BullMQ jobs are retained to prevent accidental recreation. Relational row locks, sender advisory locks, deterministic job IDs, and conditional state transitions prevent parallel sends of the same record. Do not delete Docker volumes when testing restarts.

**SMTP ambiguity.** Exactly-once SMTP delivery cannot be guaranteed by a database transaction. The worker commits `sending` before SMTP; a reactivated job in that state becomes `uncertain`. Ambiguous SMTP errors and exhausted stalled sends require review, rather than automatic resend. Explicit SMTP 4xx rejections retry with exponential backoff; explicit 5xx rejections become failed. This favors preventing duplicates over guaranteeing delivery after an ambiguous crash. Deterministic Message-ID helps investigation but is not a provider deduplication guarantee. No UI action automatically retries an uncertain message.

**Throughput.** WORKER_CONCURRENCY defaults to 5 (configurable 1–32). PostgreSQL advisory locks serialize each sender while separate senders run concurrently. Atomic Redis Lua uses Redis server time for a fixed UTC hourly counter and minimum send spacing. The next slot is advanced after SMTP completes. Defaults are MIN_SEND_DELAY_MS=2000 and MAX_EMAILS_PER_HOUR_PER_SENDER=200; UI limits are fetched from the server. A batch’s requested hourly limit is capped by the server ceiling. All batches for one sender share a counter; a lower-limit batch can defer earlier than another batch. Admissions consume capacity conservatively, including uncertain attempts. Reaching quota delays remaining jobs until the next hour without dropping them or consuming retries. Parallel contention preserves order approximately, not strict FIFO. A burst of 1000+ jobs remains persisted and drains within these constraints.

**Slack.** Real OAuth provisions a channel webhook stored encrypted per user. Consuming the sender’s final hourly slot creates a durable notification record. The worker begins a live webhook request immediately after committing that event, alongside SMTP. Reconciliation retries failed notifications. Disconnected users simply have no destination; reconnect is effective without redeployment, and pending unsent events may then be delivered. Slack notification delivery is at least once: a crash after acceptance but before DB acknowledgement can duplicate an alert.

**Search.** Relational changes increment a version. Reconciliation indexes recipient, subject, body, status and timestamps, retrying failures until indexed_version catches up. Elasticsearch external versions prevent stale writes from replacing newer documents. Search is tenant-filtered and ownership is checked again during DB hydration. Indexing may lag at least ten seconds; the current path supports up to 10000 search hits before requiring a larger-scale search_after design.

**Access and secrets.** Real Google authorization-code login verifies the ID token and email, rotates the session, and persists it in Redis. OAuth state is single-use/session-bound. Writes check Origin. Bull Board is restricted to ADMIN_EMAILS because it exposes cross-tenant operator controls. SMTP passwords and Slack webhooks use AES-256-GCM. Parameterized SQL and request schemas validate inputs. Docker’s unauthenticated local services bind only to loopback; hosted infrastructure needs service authentication/TLS and restricted access. Keep .env out of Git and preserve its encryption key.

## Assignment feature map

| Requirement                        | Implementation                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| TypeScript + Express               | MVC API, separate worker process                                                                     |
| PostgreSQL, BullMQ, Redis, no cron | Durable batches/outbox, delayed jobs, reconciliation                                                 |
| Multiple senders + Ethereal        | Provision accounts in Sending accounts; encrypted SMTP credentials                                   |
| Concurrency, spacing, hourly quota | Configurable worker count, sender locks, atomic shared Redis admission                               |
| Restart persistence + idempotency  | Persistent volumes/AOF, unique batch keys/job IDs, conservative SMTP recovery                        |
| Searchable scheduled/sent emails   | Versioned Elasticsearch indexing of recipient/subject/body                                           |
| Live BullMQ dashboard              | Operator-only Bull Board at /queues                                                                  |
| Real Google login/profile/logout   | Authorization-code flow, verified identity, persisted sessions                                       |
| Slack connect/disconnect/reconnect | OAuth channel picker, encrypted webhook, durable live notifications                                  |
| Compose + file leads               | CSV/text upload, deduplication, valid count, size/count validation                                   |
| Scheduling controls                | Local datetime → UTC, server-configured spacing/hourly bounds                                        |
| Scheduled/sent dashboard           | Search, sender/status filters, pagination, message details, Ethereal preview                         |
| UX                                 | Loading skeletons, clear empty/error states, retry, focus trap, responsive layout, self-hosted fonts |
| Documentation                      | Setup, architecture, API, assumptions, and demo sequence                                             |

No Figma URL was supplied, so the UI was designed independently from the written requirements. Custom CSS is used instead of Tailwind. Sample data is isolated from the authenticated workspace. Queue record pruning, sender deletion/SMTP credential editing, strict FIFO, and automatic SMTP ambiguity resolution are intentionally outside this implementation.

## Validation

```sh
npm run build          # Frontend production bundle + compiled backend
npm run test:all       # Service/security tests + React workflow tests
npm audit
```

Integration tests are explicitly skipped unless TEST_REDIS_URL / TEST_DATABASE_URL are supplied. SETUP.md explains the isolated PostgreSQL test database and Redis checks. Automated build/component tests do not prove real OAuth, SMTP, Slack, or restart behavior against live accounts; complete the live checklist before submission.

## Production process layout

After configuring a single HTTPS origin and managed/restricted infrastructure, `npm run build` emits frontend/dist and backend/dist. Run API and worker as separate supervised processes:

```sh
NODE_ENV=production npm run start -w backend
NODE_ENV=production npm run start:worker -w backend
```

Express serves the built frontend and API together in production. Set WEB_URL/API_URL to that HTTPS origin and register matching provider callbacks. Put it behind a reverse proxy, configure correct proxy trust, and keep the worker running independently. Do not use the Vite development server for a hosted submission.

## Submission still required

Create the private GitHub repository, verify/invite the assignment’s reviewer usernames (`Mitrajit` and `Yadav036`), configure live accounts/services, record the maximum-five-minute demo, and submit repository/video/hosted links through the supplied ClickUp form. This checkout does not create those accounts or submit the application.
