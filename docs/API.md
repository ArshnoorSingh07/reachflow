# API reference

Development API origin: `http://localhost:4000`; frontend requests use the Vite proxy. Production can serve the built frontend directly through Express. All endpoints below use JSON except OAuth redirects and the Bull Board web UI.

Authenticated APIs require the HttpOnly `reachflow.sid` session cookie obtained through Google or email/password sign-in. Mutations require an Origin header matching WEB_URL and X-CSRF-Token from GET /api/me, including when using Postman. Unauthenticated API requests return 401; invalid origin returns 403. There is no mock-login endpoint.

| Method | Path                             | Purpose                                                                                    |
| ------ | -------------------------------- | ------------------------------------------------------------------------------------------ |
| GET    | /health                          | API liveness                                                                               |
| GET    | /api/config                      | Public non-secret UI limits and OAuth configuration flags                                  |
| GET    | /auth/google                     | Start real Google OAuth                                                                    |
| GET    | /auth/google/callback            | Google authorization-code callback                                                         |
| GET    | /api/me                          | Current profile (or null), operator access flag                                            |
| POST   | /api/logout                      | Destroy session                                                                            |
| GET    | /api/senders                     | Workspace sender ID/name/email list                                                        |
| POST   | /api/senders                     | Provision an Ethereal test mailbox; body `{ "name": "Partnerships" }`; maximum 10 per user |
| GET    | /api/integrations                | `{ "slack": true/false }`                                                                  |
| GET    | /api/integrations/slack/connect  | Start real Slack OAuth and channel selection                                               |
| GET    | /api/integrations/slack/callback | Store encrypted webhook returned by OAuth                                                  |
| DELETE | /api/integrations/slack          | Disconnect this user’s webhook                                                             |
| POST   | /api/schedule                    | Create an idempotent delayed batch                                                         |
| GET    | /api/emails                      | List/search/filter messages with pagination                                                |
| GET    | /api/emails/:id                  | Message body, sender, timestamps, outcome, preview URL; owner only                         |
| GET    | /api/stats                       | Counts: scheduled, sent, failed, sentToday                                                 |
| GET    | /queues                          | Bull Board; only emails listed in ADMIN_EMAILS                                             |

## Schedule a batch

Required headers:

```text
Content-Type: application/json
Origin: http://localhost:5173
X-CSRF-Token: token-returned-by-api-me
Idempotency-Key: a-unique-client-generated-uuid
```

Example body (replace sender ID and start time with current values):

```json
{
  "senderId": "550e8400-e29b-41d4-a716-446655440000",
  "subject": "A quick idea for your team",
  "body": "Hi there,\n\nWould you be open to a conversation?",
  "recipients": ["one@example.com", "two@example.com"],
  "startAt": "2026-11-03T09:00:00+05:30",
  "delayMs": 2000,
  "hourlyLimit": 200
}
```

Returns **202** with `{ "batchId": "..." }`. Duplicate recipients in a batch are removed. Repeating an identical request with the same key/user returns the same batch; changing content with that key returns **409**. The DB transaction commits before queue reconciliation; a temporarily unavailable queue does not erase an accepted batch.

Input bounds: subject 1–200 characters; plain-text body 1–50000; 1–10000 recipients; delay at least MIN_SEND_DELAY_MS and at most 3600000; hourly limit 1–MAX_EMAILS_PER_HOUR_PER_SENDER. New batches require a current/future start time with a one-minute clock tolerance. An existing idempotent request can still be retrieved after its original start time.

## List and search

```text
GET /api/emails?view=scheduled&page=1&q=hello&sender=<uuid>&status=scheduled
```

`view` is `scheduled` or `sent`; default scheduled. `page` is a positive integer, 12 rows per page. `q` searches recipient, subject, and body via Elasticsearch. `sender` and `status` are optional. The sent view includes sent, failed, and uncertain outcomes; scheduled includes scheduled and sending.

```json
{
  "rows": [
    {
      "id": "...",
      "recipient": "one@example.com",
      "subject": "A quick idea for your team",
      "status": "scheduled",
      "scheduled_at": "2026-11-03T03:30:00.000Z",
      "sent_at": null,
      "sender_name": "Partnerships",
      "sender_email": "account@ethereal.email"
    }
  ],
  "total": 1,
  "page": 1
}
```

Lists without a search query read PostgreSQL directly. Search indexing is eventually consistent. The current search path returns up to 10000 matching IDs, sufficient for an assignment-sized batch; large multi-batch search should move to Elasticsearch PIT/search_after. Ownership is checked again in PostgreSQL before records are returned.

## Outcomes

- `scheduled`: persisted and awaiting its slot.
- `sending`: SMTP attempt is in progress.
- `sent`: SMTP accepted the message and the DB recorded success.
- `failed`: permanent SMTP rejection or retryable work exhausted its attempts.
- `uncertain`: interrupted SMTP or ambiguous send result. Requires manual Ethereal review; never blindly retried.

Validation errors return **400**, unknown/foreign resources **404**, idempotency conflicts **409**, search outages **503**, and unexpected errors **500** with a generic client message. Responses use `{ "error": "..." }`. OAuth failures redirect to the relevant UI with a safe error indicator.

## Screenshot feature extensions

- `POST /auth/register`: `{email,password,firstName?,lastName?}`; requires trusted Origin, password length 12–128, returns 201 and establishes a session.
- `POST /auth/login`: `{email,password}`; requires trusted Origin, returns 200 and establishes a session. Fetch `/api/me` afterward for CSRF/profile data.
- `POST /api/schedule` additionally accepts `bodyHtml` (sanitized, up to 150,000 characters) and `attachments: [{name,type,data}]` (base64, maximum 5 files and 5 MB total decoded bytes). A validated plaintext alternative is generated from HTML for SMTP/search. All content participates in the idempotency hash.
- `GET /api/emails?view=starred|archived|trash` adds durable message folders. Existing scheduled/sent views omit archived/trash records.
- `PATCH /api/emails/:id`: `{starred:boolean}` or `{action:"archive"|"delete"|"restore"}`. Requires ownership, Origin and CSRF. Archive/delete/restore reject pending sends with 409. Deletion moves completed mail to recoverable Trash.
- `GET /api/emails/:id` includes sanitized `body_html`, message flags and attachment metadata (`id,name,content_type,size`).
- `GET /api/emails/:id/attachments/:attachmentId` requires the owning session and downloads the file. `?inline=1` permits image previews only; responses include nosniff and sandbox CSP.
