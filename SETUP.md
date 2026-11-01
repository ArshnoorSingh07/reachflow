# Local setup from scratch

Run commands from `/Users/arshnoorsingh/work/reachflow`.

## 1. Install the prerequisites

Use Node.js 22.12 or newer. Docker Desktop is not installed in the environment used to build this version. Install the appropriate Mac edition from [Docker’s official instructions](https://docs.docker.com/desktop/setup/install/mac-install/) and launch it. You complete Docker’s first-run agreement and any system prompts yourself.

## 2. Prepare configuration and services

```sh
npm install
npm run setup
npm run infra:up
npm run db -w backend
npm run search:init -w backend
npm run doctor
```

`setup` creates `.env` with generated session and encryption keys if the file does not exist. It never overwrites an existing file. A local `.env` has already been created in this checkout. Keep its ENCRYPTION_KEY stable: changing it makes previously stored SMTP/webhook credentials unreadable.

PostgreSQL, Redis, and Elasticsearch run in Docker with persistent named volumes. Ports are bound to your local machine. The `infra:up` command waits for health checks. Elasticsearch may take a minute to become ready. OAuth credentials are deliberately blank until you add your own.

If you only want to inspect the design:

```sh
npm run dev -w frontend
```

Open **http://localhost:5173** and select **Take a look around**. The sample workspace never schedules real messages. This mode is not the assignment’s Google login implementation.

## 3. Configure Google login

1. Open [Google Cloud Console](https://console.cloud.google.com/). Choose/create a project.
2. Configure Google Auth Platform consent branding and audience. For an external app in testing, add your Google account as a test user.
3. Create an OAuth client with application type **Web application**.
4. Authorized JavaScript origin: `http://localhost:5173`.
5. Authorized redirect URI: `http://localhost:4000/auth/google/callback`.
6. Paste the client values into `.env` as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Do not paste them into chat or source files.
7. Set ADMIN_EMAILS to your Google account email if you want to operate Bull Board.

The application requests only `openid`, `email`, and `profile`. It verifies the ID token server-side, checks verified email, and creates a Redis-backed session. See [Google’s web-server OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server).

## 4. Start the app and add senders

```sh
npm run dev
```

This starts three processes: frontend (5173), API (4000), and email worker. Open **http://localhost:5173**, sign in with Google, then go to **Sending accounts → Add sender**. Name the account and click **Create test sender**. The server provisions an Ethereal mailbox and encrypts the password. Repeat to test multiple senders.

Alternatively:

```sh
npm run sender -w backend -- your-google-email@example.com
```

Use `localhost` consistently. `127.0.0.1` is a different browser cookie host; mixing hosts during OAuth can lose the session state. API calls from the frontend use Vite’s proxy, so the browser sees a same-origin app.

## 5. Connect Slack

1. Open [Slack app management](https://api.slack.com/apps) and create an app for a workspace where you can install apps.
2. Enable **Incoming Webhooks**.
3. In **OAuth & Permissions**, configure the redirect URL: `http://localhost:4000/api/integrations/slack/callback`. Add the bot scope **incoming-webhook**.
4. Copy Client ID and Client Secret from Basic Information into `.env` as SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.
5. Restart API and worker so environment changes are loaded. Open **Integrations → Connect Slack**.
6. Complete the actual Slack consent and channel picker. The dashboard returns with Slack marked connected.

Slack workspace policies may require admin approval. If your Slack app setup requires HTTPS, use a single HTTPS origin that reverse-proxies both the frontend and `/api`, `/auth`, `/queues` to this app, set both WEB_URL and API_URL to that origin, register matching HTTPS callbacks with both providers, and configure Vite to allow that development hostname. Start OAuth from that same origin so its session cookie is present on callback; do not tunnel only the callback while signing in on localhost.

See [Slack’s OAuth authorization-code guide](https://docs.slack.dev/authentication/installing-with-oauth/). This app exchanges the code on the backend and stores the returned channel webhook encrypted in PostgreSQL. A handwritten webhook or a log line does not replace the OAuth/demo requirement.

## 6. Try the complete email flow

1. Compose a message and select an Ethereal sender.
2. Upload `examples/leads.csv`: it has four rows and three unique addresses. The UI reports duplicates and ignored non-email fields.
3. Choose a start time a minute ahead, delay **2 seconds**, hourly limit **2**.
4. Schedule the batch. See it in Scheduled and in the operator queue dashboard at `http://localhost:5173/queues`.
5. After two admissions, check the connected Slack channel for a real rate-limit alert. The remaining email is postponed into the next UTC hour.
6. In Sent, open a message to see its details and click **Open Ethereal preview** for messages confirmed sent. This does not deliver to a real recipient inbox.
7. Search by recipient, subject, or message text. Indexing is asynchronous; allow roughly ten seconds. Use sender/status filters as needed.
8. Disconnect Slack; subsequent limit events must not crash sending. Reconnect and trigger another limit using a different sender or a fresh hourly window.

Hourly counters are shared per sender. Setting a different limit on a later batch does not reset that sender’s current counter. Wait for the next UTC hour or use a new sender for repeat demonstrations.

## 7. Verify restart persistence

Schedule a batch several minutes in the future. Note its message IDs in the UI/queue dashboard. Stop the API and worker with Ctrl-C, keeping Docker services running. Start them again with `npm run dev`; the same delayed jobs should run at their due time. For a stronger test, restart the Docker services without deleting their volumes.

If a job was interrupted while SMTP was in progress, it becomes **Needs review** rather than being resent automatically. This explicitly handles SMTP’s delivery ambiguity; review Ethereal before deciding to resend. A confirmed sent job is never automatically reset.

## 8. Run checks

```sh
npm run build
npm run test:all
npm audit
TEST_REDIS_URL=redis://localhost:6379 npm test
```

The Redis-backed tests exercise atomic admission and queue/worker replacement. To run the PostgreSQL idempotency/ownership test, create a separate database whose name ends in `_test`, apply the migration to that database, then run the test:

```sh
docker compose exec postgres createdb -U reachflow reachflow_test
DATABASE_URL=postgres://reachflow:reachflow@localhost:5432/reachflow_test npm run db -w backend
TEST_DATABASE_URL=postgres://reachflow:reachflow@localhost:5432/reachflow_test npm test
```

Tests insert uniquely named fixtures and clean them up. Never point test configuration at a production database. Missing integration service URLs cause those tests to be explicitly skipped, not counted as passing.

## Troubleshooting

| Symptom                          | Check                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Cannot reach server              | Run `npm run doctor`, start Docker, then `npm run dev`.                                                 |
| Google redirect mismatch         | Exact callback URI, port, scheme, and hostname must match the Google client.                            |
| OAuth returns to login           | Use localhost consistently and check that Redis is running; confirm test-user access.                   |
| Compose has no senders           | Create an Ethereal account from Sending accounts after signing in.                                      |
| Slack connection cannot complete | Confirm both credentials, redirect URL, incoming-webhook scope, and workspace installation permissions. |
| Search returns no new messages   | Wait for indexing; check Elasticsearch health and worker output.                                        |
| Queue dashboard shows 403        | Add the signed-in email to ADMIN_EMAILS and restart the API.                                            |
| No messages are sent             | Confirm worker is running, inspect Bull Board, and check SMTP access / hourly counters.                 |
| Needs review status              | SMTP outcome is uncertain; inspect Ethereal before manually rescheduling.                               |
| Ports already in use             | Stop the old service or change env/Compose/proxy ports consistently.                                    |
