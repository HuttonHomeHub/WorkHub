# Security policy

WorkHub is a private, self-hosted app maintained by one person.

## Reporting a vulnerability

**Please do not open a public issue.** Report it privately through GitHub's
[**Report a vulnerability**](https://github.com/HuttonHomeHub/WorkHub/security/advisories/new)
form (Security → Advisories), with:

- what the issue is and its impact;
- steps to reproduce or a proof of concept;
- the affected version or commit.

Reports are handled on a **best-effort basis** — there is no guaranteed response
time or disclosure timeline. Only the latest release is fixed. Please give a
reasonable chance to fix the issue before disclosing it, and do not access data
that is not yours or degrade a running instance while testing.

## Security standards

How WorkHub is secured — authentication, sessions, ownership, secrets, proxy
trust, rate limiting — is in
[`docs/SECURITY_STANDARDS.md`](docs/SECURITY_STANDARDS.md).
