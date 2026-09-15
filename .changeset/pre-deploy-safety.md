---
'@repo/api': patch
---

Only trust forwarded client addresses from configured proxies; reject placeholder auth secrets in production.

- **Rate limiting:** the API honours `X-Forwarded-For` only from the proxies listed in `AUTH_TRUSTED_PROXIES`, so a client can no longer pick its own address (and rate-limit bucket).
- **Configuration:** in production `BETTER_AUTH_SECRET` must be at least 32 characters and must not be a placeholder (for example the `.env.example` value); the API refuses to start otherwise.
