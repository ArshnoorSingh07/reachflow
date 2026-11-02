# Authentication and authorization

## Identity

Google OAuth and email/password accounts use the same Redis session, CSRF checks and ownership rules. No client-supplied identity or localStorage token grants API access. The optional demo workspace has been removed. DiceBear receives only first/last initials (AS for Arshnoor Singh), never a full name, email or provider ID.

The authorization-code flow uses PKCE S256, a random state, and an OpenID Connect nonce. Challenges are stored in Redis for ten minutes and consumed atomically with GETDEL. The backend verifies Google’s ID token signature/audience/expiry via google-auth-library, verifies nonce and verified-email claims, then rotates the session ID. Secrets and the code verifier remain on the server.

## Sessions

Sessions are stored in Redis and use the `reachflow.sid` HttpOnly, SameSite=Lax cookie, marked Secure in production. A session expires after one hour without a request or after 24 hours overall. Background dashboard polling counts as session activity; the absolute limit still forces reauthentication.

Each request reloads the account from PostgreSQL. Missing or disabled accounts and mismatched session_version values invalidate the session. The identity and role used by controllers come from that reload, not a stale profile in the cookie/session. Version increments revoke all existing sessions at their next request. The account menu supports both current-session sign-out and all-device sign-out.

`GET /api/me` returns the current user, role, a session-bound CSRF token, and session metadata. Frontend code keeps the CSRF token in memory, adds it to writes, and clears authentication on 401 responses. Old sessions created before this change must sign in again.

## Request protection

API writes require both `Origin: <WEB_URL>` and `X-CSRF-Token: <token returned by /api/me>`. Tokens are compared using constant-time byte comparison. Missing/invalid tokens or foreign origins return 403. Missing/expired authentication returns JSON 401. Cookies alone never authorize a write.

Google sign-in attempts are limited to 20 per IP per ten minutes; email scheduling and sender creation share a 30-per-user-per-minute limit. Redis counters make these limits consistent across server instances. Configure the trusted reverse proxy correctly in production so client IP handling is accurate.

## Authorization

| Action                                   | Member | Operator                  |
| ---------------------------------------- | ------ | ------------------------- |
| View/search own emails                   | Yes    | Yes                       |
| View another user’s emails               | No     | No through workspace APIs |
| Schedule with own senders                | Yes    | Yes                       |
| Use another user’s sender                | No     | No                        |
| Manage own Slack connection              | Yes    | Yes                       |
| Sign out/revoke own sessions             | Yes    | Yes                       |
| Bull Board queue visibility and controls | No     | Yes                       |

Operator emails are configured in ADMIN_EMAILS, normalized for case and whitespace, and evaluated on the server. A forged email or role in browser state/session profile does not grant operator access. Bull Board is a global operations surface; its mutation endpoints also enforce same-origin requests. Its bundled client does not use the custom workspace CSRF header, so Origin validation protects those operator mutations separately.

Every workspace query constrains data by the authenticated user ID. Email-detail lookup, list hydration after Elasticsearch search, batch creation, and sender access enforce ownership in PostgreSQL. Controllers do not accept a user ID from the browser to choose an owner.

## Setup and checks

Run `npm run db -w backend` to add the session-version and disabled-account columns to an existing installation. Add Google OAuth credentials as described in SETUP.md. Keep WEB_URL and the browser origin identical, use HTTPS for production, and never commit .env.

Security tests cover session expiry/revocation, missing/disabled accounts, stale-profile impersonation, operator authorization, CSRF/origin rejection, malformed tokens, and session-header handling. Integration tests also exercise PostgreSQL ownership/idempotency and Redis queue persistence. Real Google consent must still be verified with configured credentials; tests do not fabricate a successful provider login.

References: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Password accounts

POST /auth/register accepts email, password and optional firstName/lastName (required by the signup UI). Passwords use scrypt (N=32768,r=8,p=1), random 16-byte salts and constant-time verification. Registration requires 12–128 characters; POST /auth/login verifies existing credentials. Both validate WEB_URL Origin, use shared Redis IP/account rate limits and rotate sessions on success. Wrong login attempts return a generic error. Google and local accounts are not automatically linked by email. Local email ownership is unverified and password accounts never become operators through ADMIN_EMAILS. Password recovery/verification email flows are not included.
