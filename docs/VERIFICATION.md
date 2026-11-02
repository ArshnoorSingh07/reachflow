# Verification

Last verified: November 2, 2026.

## Automated checks

- Production frontend and backend builds pass.
- 25 backend tests and 17 frontend tests pass, with no skips when the PostgreSQL and Redis test URLs are supplied.
- Coverage includes session authorization, CSRF, password hashing, input validation, HTML sanitization, private attachments, idempotency, concurrent rate limiting, delayed-job persistence, notification races, authenticated Elasticsearch requests, and UI interactions.

See SETUP.md for the isolated test database configuration. Run `npm run test:all` with TEST_DATABASE_URL and TEST_REDIS_URL set. Without them, infrastructure integration tests are skipped.

## Live checks completed

- Real Google OAuth login and dashboard redirect.
- Slack OAuth connection; disconnect/reconnect confirmed by the account owner.
- A real worker reached an hourly limit of one and Slack accepted one authorized alert.
- Ethereal captured SMTP messages and generated previews.
- Future jobs survived API and worker replacement without duplicate sends.
- Multiple senders, minimum send spacing, next-hour quota deferral, and idempotent scheduling retries.
- User-scoped Elasticsearch indexing and search.
- A 1,000-recipient future batch was persisted and queued without sending all messages.
- Private routes, cross-user isolation, session revocation, and secure HTTPS session cookies.

## Limits

Ethereal captures test messages; it does not deliver to recipient inboxes. Live OAuth and Slack checks require valid local credentials and registered callback URLs. Temporary HTTPS tunnels can expire and are not permanent hosting. Recheck callbacks before recording the demo. The UI follows the supplied Figma screenshots; an exact pixel comparison has not been certified.
