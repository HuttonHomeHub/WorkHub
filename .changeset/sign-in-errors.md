---
'@repo/web': patch
'@repo/api': patch
---

Sign-in now says "Wrong email or password" only when the credentials really are wrong (401). Rate limiting gets its own message, and other failures — such as a request from an untrusted origin — show a neutral "couldn't sign you in" message instead of blaming the password. The default trusted origins also include `https://localhost:5173`, which VS Code port forwarding can use.
