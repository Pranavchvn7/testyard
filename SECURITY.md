# Security policy

## Reporting a vulnerability
Please **do not open a public issue** for security problems. Use GitHub's private reporting:
*Security → Report a vulnerability* on this repository. Include steps to reproduce and the impact you see.
You will get a first answer within 7 days.

## What is deliberately "insecure" (it is a practice site)
TestYard exists to be tested, so a few behaviours look risky on purpose. They hold no real data and are isolated per visitor:

| Behaviour | Why it exists |
|---|---|
| Public demo account `practice@testyard.dev` / `SecretPass1!` and Basic auth `admin` / `admin` on `/api/auth/basic` | Login and auth practice. Accounts live only inside one sandbox and have no privileges. |
| OTP code is returned in the API response | Lets you automate an OTP flow without email access. |
| Session token is kept in `localStorage` (`ty.token`) | So UI and API tests can share a login. A real app should use an httpOnly cookie. |
| `Access-Control-Allow-Origin: *` | The API is public and uses bearer tokens, not cookies. Restrict with `CORS_ORIGIN` when self-hosting privately. |
| `/api/echo`, `/api/headers`, `/api/ip`, `/api/openapi.json` | Documented practice endpoints. Credentials and proxy headers are redacted. |
| Intentionally broken images, flaky endpoint, uncaught-error buttons | Error-handling practice. |

**Never enter real personal data.** Sandbox data lives in server memory only, is wiped after 2 hours of inactivity (the shared default sandbox every 30 minutes) and can be deleted at any time with `POST /api/reset` or `DELETE /api/auth/profile`.

## Hardening that is on by default
Strict CSP (no inline scripts), `X-Frame-Options: DENY`, HSTS, `nosniff`, Referrer-Policy and Permissions-Policy; scrypt password hashing with constant-time comparison; per-IP and per-account rate limits; request-size and concurrency caps; no stack traces in responses (errors carry a correlation id instead); static files served from `public/` only, no dotfiles; zero runtime dependencies. When running behind a proxy, set `TRUST_PROXY_HOPS` correctly, otherwise rate limiting cannot see real client IPs.

## Secrets
The project needs none. If you add any, keep them in environment variables, never in the repository. If a secret is ever committed, rotate it immediately: removing it from the latest commit does not remove it from git history.
