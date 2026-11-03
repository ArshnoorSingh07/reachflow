# Verification

Last verified: November 3, 2026.

## Automated checks

- Production frontend and backend builds pass.
- 25 backend tests and 17 frontend tests pass, with no skips when the PostgreSQL and Redis test URLs are supplied.
- Coverage includes session authorization, CSRF, password hashing, input validation, HTML sanitization, private attachments, idempotency, concurrent rate limiting, delayed-job persistence, notification races, authenticated Elasticsearch requests, and UI interactions.

See SETUP.md for the isolated test database configuration. Run `npm run test:all` with TEST_DATABASE_URL and TEST_REDIS_URL set. Without them, infrastructure integration tests are skipped.

## Local HTTPS checks completed

- Real Google OAuth login and dashboard redirect.
- Slack OAuth connection; disconnect/reconnect confirmed by the account owner.
- A real worker reached an hourly limit of one and Slack accepted one authorized alert.
- Ethereal captured SMTP messages and generated previews.
- Future jobs survived API and worker replacement without duplicate sends.
- Multiple senders, minimum send spacing, next-hour quota deferral, and idempotent scheduling retries.
- User-scoped Elasticsearch indexing and search.
- A 1,000-recipient future batch was persisted and queued without sending all messages.
- Private routes, cross-user isolation, session revocation, and secure HTTPS session cookies.

## Hosted deployment checks

Verified on the Azure deployment on November 3, 2026:

- Valid public HTTPS and HTTP-to-HTTPS redirect.
- API, worker, PostgreSQL, Redis, Elasticsearch, and Caddy running independently.
- Email/password registration, authenticated sessions, secure cookies, CSRF enforcement, and logout.
- Anonymous access to private APIs rejected.
- Ethereal sender creation and scheduled delivery with a generated preview.
- Rich-text content, attachment retrieval, and Elasticsearch search.
- A future email remained queued through API and worker restarts and was sent afterward.

## Limits

Ethereal captures test messages; it does not deliver to recipient inboxes. Google and Slack OAuth require valid credentials and callback URLs registered for the deployment origin. Azure hosting consumes subscription credits. The UI follows the supplied Figma screenshots; an exact pixel comparison has not been certified.
