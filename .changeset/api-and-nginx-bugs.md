---
'@repo/api': patch
'@repo/web': patch
---

A malformed list cursor now returns 400 instead of 500, and a request body over the size limit returns 413 `PAYLOAD_TOO_LARGE` instead of 500, with a correlation id in the response and the log. The web container now proxies `/health` and `/health/ready` to the API, so an uptime monitor can check readiness through the site, and static assets keep the security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`).
