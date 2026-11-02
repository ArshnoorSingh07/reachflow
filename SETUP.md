# Local setup from scratch

Run commands from the repository root (`reachflow/`).

## 1. Install the prerequisites

Use Node.js 22.12 or newer and Docker with Compose v2. On macOS, install and launch Docker Desktop using [Docker’s official instructions](https://docs.docker.com/desktop/setup/install/mac-install/). On other platforms, use the corresponding Docker installation. Confirm the Docker engine is running before starting the infrastructure.

## 2. Prepare configuration and services

```sh
npm ci
npm run setup
npm run infra:up
npm run db -w backend
npm run search:init -w backend
npm run doctor
```

`setup` creates `.env` with generated session and encryption keys if the file does not exist. It never overwrites an existing file. Keep its ENCRYPTION_KEY stable: changing it makes previously stored SMTP/webhook credentials unreadable.

PostgreSQL, Redis, and Elasticsearch run in Docker with persistent named volumes. Ports are bound to your local machine. The `infra:up` command waits for health checks. Elasticsearch may take a minute to become ready. OAuth credentials are deliberately blank until you add your own.

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
3. Use an HTTPS app URL for Slack OAuth. In **OAuth & Permissions**, register `https://YOUR-APP-HOST/api/integrations/slack/callback` and add the bot scope **incoming-webhook**. The standard Slack web-app flow rejects the localhost HTTP callback.
4. Copy Client ID and Client Secret from Basic Information into `.env` as SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.
5. Configure and start the HTTPS instance described below so environment changes are loaded. Open that HTTPS URL, sign in, and choose **Integrations → Connect Slack**.
6. Complete the actual Slack consent and channel picker. The dashboard returns with Slack marked connected.

Slack workspace policies may require admin approval. Use one HTTPS origin that serves both the built frontend and backend routes. Set WEB_URL and API_URL to that origin for the HTTPS instance; register the Google JavaScript origin and `/auth/google/callback` URI for that host as well. Start Google sign-in and Connect Slack from that same HTTPS origin so its session cookie is present on callback. The ordinary localhost instance can remain separate for development. A temporary Cloudflare hostname changes when its tunnel is recreated, requiring updated provider callbacks. Keep a named tunnel or permanent HTTPS deployment for a stable callback URL.

For a temporary local demo, install `cloudflared` from Cloudflare’s official distribution and start a tunnel in its own terminal:

```sh
cloudflared tunnel --url http://127.0.0.1:4100
```

Build the app, then start a separate API instance using the HTTPS origin printed by the tunnel (replace both placeholders):

```sh
npm run build
NODE_ENV=production PORT=4100 API_URL=https://YOUR-TUNNEL-HOST WEB_URL=https://YOUR-TUNNEL-HOST node --env-file=.env backend/dist/server.js
```

Keep the worker from `npm run dev` running, or start it separately with `npm run start:worker -w backend`. Register the exact tunnel callbacks with Google and Slack before signing in. Leave Docker, the tunnel, and the API/worker running during the demo. A quick tunnel is temporary and can expire; never commit its current hostname as a permanent application address.

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
TEST_DATABASE_URL=postgres://reachflow:reachflow@localhost:5432/reachflow_test TEST_REDIS_URL=redis://localhost:6379 npm run test:all
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

## Authentication upgrade

Existing users must sign in again after the session upgrade. Run `npm run db -w backend` before starting the upgraded API. The account menu now supports signing out all devices; access checks reload account identity and revocation state on every request. See docs/AUTHENTICATION.md for details.

## Screenshot feature setup

Run `npm run db -w backend` to apply the additional password, rich-message, attachment and message-folder columns/tables, then restart with `npm run dev`. No new credentials are needed. Google OAuth still uses the existing configuration. For local email login, first choose **or sign up through email**, provide first/last names and a 12-character-or-longer password, then register. A local account is separate from the Google account, even with the same email address. DiceBear shows first/last initials; a one-word name uses one initial.

### Reconnecting after a temporary tunnel stops

The localhost app cannot reuse an expired tunnel callback. Start a new HTTPS instance/tunnel, add its exact Google and Slack callbacks in provider settings, then open that HTTPS URL, sign in and connect Slack in the workspace that owns the app. API_URL and WEB_URL must both match that host in the HTTPS process. The local app now detects HTTP OAuth configuration and explains the HTTPS requirement instead of redirecting into a failing Slack consent flow. A saved webhook remains usable on localhost after a successful connection, provided it belongs to the same user in the same database.
