# Reachflow

A full-stack email scheduler built for the ReachInbox internship assignment. A modern React dashboard sits on an Express MVC backend, with PostgreSQL persistence, BullMQ delayed jobs, Redis throttling, Elasticsearch search, Google OAuth, Slack OAuth, and Ethereal SMTP.

## Start here

See **[SETUP.md](SETUP.md)** for the full from-scratch Google/Slack/Docker setup and live demo steps. See **[docs/API.md](docs/API.md)** for request/response documentation and **[docs/AUTHENTICATION.md](docs/AUTHENTICATION.md)** for identity, session, CSRF, and access-control behavior.

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

Open **http://localhost:5173** and sign in with Google or create an email/password account. The dashboard requires a real authenticated session.

## Structure

```text
reachflow/
├── frontend/src/
│   ├── pages/          # Login, dashboard, senders, integrations
│   ├── components/     # Compose, email table, details, status badges
│   ├── hooks/          # Workspace data, polling, accessible dialogs
│   ├── services/       # Typed HTTP client
│   ├── types/          # Frontend data contracts
│   ├── utils/          # Lead-file parser
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

**Access and secrets.** Real Google authorization-code login verifies the ID token and email, rotates the session, and persists it in Redis. OAuth uses PKCE, nonce verification, and single-use Redis challenges. Database-backed sessions enforce idle/absolute expiry and version-based revocation. Writes check Origin and a session-bound CSRF token. Bull Board is restricted to Google-authenticated ADMIN_EMAILS because it exposes cross-tenant operator controls. SMTP passwords and Slack webhooks use AES-256-GCM. Parameterized SQL and request schemas validate inputs. Docker’s unauthenticated local services bind only to loopback; hosted infrastructure needs service authentication/TLS and restricted access. Keep .env out of Git and preserve its encryption key.

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
| Real Google login/profile/logout   | Authorization-code flow, verified identity, top profile header, logout and persisted sessions                                       |
| Slack connect/disconnect/reconnect | OAuth channel picker, encrypted webhook, durable live notifications                                  |
| Compose + file leads               | CSV/text upload, deduplication, valid count, size/count validation                                   |
| Scheduling controls                | Local datetime → UTC, server-configured spacing/hourly bounds                                        |
| Scheduled/sent dashboard           | Search, sender/status filters, pagination, message details, Ethereal preview                         |
| UX                                 | Loading skeletons, clear empty/error states, retry, focus trap, responsive layout, self-hosted fonts |
| Documentation                      | Setup, architecture, API, assumptions, and demo sequence                                             |

Design reference: [Outbox Labs Assignment](https://www.figma.com/design/kOTwGlESjijCYnMgtHfvfU/Outbox-Labs-Assignment?node-id=59-6322). Tailwind CSS with custom component styles implements the supplied Figma’s light mail layout, green accents, compact inbox rows, full-page composer, and send-later picker. The login, mail rows, composer toolbar, attachment cards and message actions follow the supplied screenshots. Email accounts use salted scrypt hashes and the same session controls as Google accounts. Rich messages are sanitized on the server, with plain-text alternatives for SMTP/search. Up to five attachments totaling 5 MB are stored once per batch in PostgreSQL, delivered through Ethereal and downloaded only by their owner. Stars, Archive, Trash and Restore persist in PostgreSQL; pending sends cannot be archived/deleted. DiceBear uses the first and last name initials. Test sample data lives under tests/ui and is not imported by the frontend. Queue record pruning, sender deletion/SMTP credential editing, strict FIFO, and automatic SMTP ambiguity resolution are intentionally outside this implementation.

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

## Repeat the live verification

With Docker services up and a migrated isolated `_test` database:

```sh
LIVE_SMTP=1 TEST_DATABASE_URL=postgres://reachflow:reachflow@localhost:5432/reachflow_test npm run test:live
```

This opt-in check provisions fresh Ethereal accounts and sends captured test messages to example.com addresses. It uses a separate session secret, queue namespace, Elasticsearch index, and test database. It restarts actual API/worker processes, checks quota rescheduling, spacing, searchable bodies, tenant isolation, session revocation, and queues a future 1000-recipient batch without sending it. Fixture sessions test the authenticated API; they do not mock a successful Google OAuth flow. Test records, queues, sessions, and index are cleaned up; the summary is saved under `.cache/live-verification.json`. Port 4101 must be available.

QUEUE_PREFIX and ELASTIC_INDEX optionally isolate a deployment or test run; defaults are `bull` and `emails`. API and worker instances belonging to the same deployment must use the same values.

## Email accounts and screenshot features

Click **or sign up through email** on Login to register with first name, last name, email and a password of 12–128 characters. Existing accounts use the Login form. Google and password accounts are separate identities, even when emails match; there is no automatic account linking. Local email ownership is not verified, so password accounts cannot gain operator access from ADMIN_EMAILS. Password reset and email verification are outside the shown flows.

Run `npm run db -w backend` after pulling these changes. This adds password credentials, rich-message content, attachment storage and message flags without changing existing Google accounts. The composer supports formatting, undo/redo, font/size, alignment, lists, indentation and quotes. The paperclip accepts PNG/JPEG/GIF/WebP/PDF/TXT/CSV files; CSV lead upload is a separate control. Archived/deleted completed emails can be restored through their sidebar sections; active sends are protected.
