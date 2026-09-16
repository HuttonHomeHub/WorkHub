# Operations

> The owner's runbook for running WorkHub on their own server: first deploy,
> reverse proxy, upgrades and rollback, backups and restore, secrets, logs and
> monitoring, disaster recovery and troubleshooting. How a release and its
> images are produced is in [RELEASING.md](RELEASING.md); how the pieces fit
> together is in [ARCHITECTURE.md](ARCHITECTURE.md#runtime-topology).

WorkHub runs as one Docker Compose stack
([`docker-compose.prod.yml`](../docker-compose.prod.yml)) on one host, behind
the owner's reverse proxy, which terminates TLS:

| Service   | Image                                     | Role                                                                  |
| --------- | ----------------------------------------- | --------------------------------------------------------------------- |
| `db`      | `postgres:17-alpine`                      | PostgreSQL; data in the volume `workhub-db-data`; no host port        |
| `migrate` | `ghcr.io/huttonhomehub/workhub/api:<tag>` | One-shot `prisma migrate deploy`; must exit 0 before `api` starts     |
| `api`     | `ghcr.io/huttonhomehub/workhub/api:<tag>` | NestJS API on port 3000, internal only                                |
| `web`     | `ghcr.io/huttonhomehub/workhub/web:<tag>` | nginx: the SPA plus `/api/*` proxy; the **only** published port, 8080 |

> **Status.** The stack, images and account CLI exist. **Backups are not
> automated yet** and **login hardening is not built** — read
> [Before exposing it to the internet](#before-exposing-it-to-the-internet)
> before pointing a public hostname at it. Procedures marked **(planned)**
> describe the agreed design, not something that runs today.

## Conventions in this runbook

- The stack lives in **`/opt/workhub`** on the host, owned by the user that
  runs Docker (the _deploy user_). Adjust the path if yours differs.
- Every compose command needs both the file and the env file. Define this
  helper in the deploy user's shell (for example in `~/.bashrc`):

  ```bash
  wh() { docker compose -f /opt/workhub/docker-compose.prod.yml --env-file /opt/workhub/.env.production "$@"; }
  ```

  Scripts (such as a backup job) should spell the full command out instead.

- `X.Y.Z` is a released version, such as `0.2.0` — never with a `v`
  ([RELEASING.md](RELEASING.md#image-tags)).

## Host prerequisites

- **Docker Engine** with the **Compose plugin** (`docker compose version`;
  Compose v2.24 or later).
- **CPU architecture: amd64 only, today.** The release workflow builds
  `linux/amd64` images; on an arm64 host `pull` fails with _no matching manifest_.
  Multi-arch images are in PRODUCT.md's [Next](PRODUCT.md#next) list.
- **Disk:** room for the images, the database, local backup dumps and container
  logs (capped at 10 MB × 5 files per service). Alert before the disk fills —
  see [Monitoring](#monitoring).
- **Time sync:** `timedatectl` shows `System clock synchronized: yes`. Session
  expiry, TLS certificates and backup schedules depend on it.
- **A reverse proxy** that terminates TLS and forwards `X-Forwarded-For` and
  `X-Forwarded-Proto` ([Reverse proxy](#reverse-proxy)).
- `openssl`, `curl` and `jq` for the commands below.

### Access to the images on GHCR

The images are `ghcr.io/huttonhomehub/workhub/api` and
`ghcr.io/huttonhomehub/workhub/web`. GHCR packages start **private** even when
the repository is public. Either:

- **Make both packages public (recommended — the repository is public, and the
  images contain nothing the source does not):** GitHub → HuttonHomeHub →
  Packages → `workhub/api` → Package settings → Change visibility → Public;
  repeat for `workhub/web`. The host then pulls without credentials.
- **Or log the host in** with a classic personal access token that has only the
  `read:packages` scope:

  ```bash
  read -rs GHCR_TOKEN && printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin && unset GHCR_TOKEN
  ```

  Docker stores the credential in `~/.docker/config.json` of the deploy user;
  rotate the token when it expires.

## First deploy

### 1. Fetch the compose file for the release

Use the compose file **from the release you deploy**, so the file and the images
match:

```bash
sudo install -d -o "$USER" -m 750 /opt/workhub && cd /opt/workhub
VERSION=X.Y.Z
curl -fsSL -o docker-compose.prod.yml \
  "https://raw.githubusercontent.com/HuttonHomeHub/WorkHub/refs/tags/@repo/api@${VERSION}/docker-compose.prod.yml"
```

### 2. Create `.env.production`

The production block at the bottom of [`.env.example`](../.env.example) documents
each variable. **Don't copy the whole file**: its development block sets
`POSTGRES_PASSWORD=app`, which compose would accept. Write a file with only the
production variables, generating the secrets in place:

```bash
cd /opt/workhub
umask 077
cat > .env.production <<EOF
# Public origin the reverse proxy serves — scheme and host, no trailing slash.
APP_ORIGIN=https://workhub.example.com
# Released version to run (no v).
IMAGE_TAG=X.Y.Z
# Where the web container's port is published (see Reverse proxy).
WEB_BIND_ADDRESS=127.0.0.1
WEB_PORT=8080
# Proxy hops trusted in X-Forwarded-For: the Docker networks, plus your proxy if it runs elsewhere.
AUTH_TRUSTED_PROXIES=172.16.0.0/12
LOG_LEVEL=info
# Secrets. Hex for the database password: it is placed inside DATABASE_URL, where / + = would break it.
POSTGRES_PASSWORD=$(openssl rand -hex 32)
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
EOF
chmod 600 .env.production
```

- Replace `APP_ORIGIN` and `IMAGE_TAG`; review the rest.
- **Store a copy of `.env.production` in your password manager now.** It is not
  in any backup of the database, and disaster recovery needs it.
- `POSTGRES_USER` and `POSTGRES_DB` default to `app`; leave them unless you have a
  reason — the commands below read them from the container's environment.
- The API refuses to start in production with a `BETTER_AUTH_SECRET` shorter
  than 32 characters or containing a placeholder
  ([SECURITY_STANDARDS.md](SECURITY_STANDARDS.md#secrets)).

### 3. Pull and start

```bash
wh pull
wh up -d
wh ps -a
```

`migrate` should show **Exited (0)**; `db`, `api` and `web` should be **Up**
and, after a minute, **(healthy)**. If `up` reports that `migrate` didn't
complete successfully, see [Troubleshooting](#migrate-failed).

### 4. Create the owner account

Public sign-up is closed (ADR-0018). Create the account inside the `api`
container; it prompts for the password twice without echoing it:

```bash
wh exec api node dist/cli/user.js create --email you@example.com --name "Your Name"
```

- Reset a password (also signs out that account's sessions):
  `wh exec api node dist/cli/user.js reset-password --email you@example.com`.
- Never run `db:seed` in production; it refuses to.

### 5. Verify

On the host, before the proxy is involved:

```bash
# The API answers through nginx, and sign-up is disabled.
curl -fsS http://127.0.0.1:8080/api/v1/config          # {"data":{"signUpEnabled":false}}

# Readiness, including the database (not reachable through nginx yet).
wh exec api node -e "fetch('http://127.0.0.1:3000/health/ready').then(async r => console.log(r.status, await r.text()))"

# Swagger UI is off in production.
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/api/docs   # 404

# nginx security headers on the SPA.
curl -sI http://127.0.0.1:8080/ | grep -iE 'x-content-type-options|x-frame-options|referrer-policy'
```

Signing in from `http://127.0.0.1:8080` fails with _Invalid origin_ — expected,
because only `APP_ORIGIN` is trusted. Once the [reverse proxy](#reverse-proxy) is
up, open `APP_ORIGIN`, sign in, and check the site's `Strict-Transport-Security`
header: `curl -sI https://workhub.example.com/ | grep -i strict-transport`.

## Before exposing it to the internet

WorkHub is designed to be internet-facing, but **it is not ready to be exposed
yet**. Until every item below exists, reach it only over a LAN or VPN and don't
publish a DNS name that routes the internet to it:

- [ ] **Passkeys** as a second factor, with CLI recovery —
      [SECURITY_STANDARDS.md](SECURITY_STANDARDS.md#passkeys--required-before-exposure). _Not built._
- [ ] **An explicit session policy** (absolute lifetime, idle timeout, sign out
      everywhere) — [SECURITY_STANDARDS.md](SECURITY_STANDARDS.md#sessions--required-before-exposure). _Not built._
- [ ] **A per-account brute-force posture** —
      [SECURITY_STANDARDS.md](SECURITY_STANDARDS.md#rate-limiting-and-brute-force). _Not built._
- [ ] **Auth security events** in the logs —
      [OBSERVABILITY.md](OBSERVABILITY.md#auth-security-events). _Not built._
- [ ] **Automated, encrypted, off-site backups with a heartbeat, and a restore
      drill done at least once** — [Backups](#backups-and-restore). _Not
      automated._
- [ ] An external uptime check and a disk-space alert — [Monitoring](#monitoring).
- [ ] Strong generated secrets in `.env.production` (mode 600) and a copy in the
      password manager.
- [ ] `WEB_BIND_ADDRESS` is not `0.0.0.0`; the host firewall allows only SSH and
      the proxy's ports.

Login hardening and backups are scheduled in PRODUCT.md's
[Next](PRODUCT.md#next) list.

## Reverse proxy

Any proxy works if it:

1. terminates TLS for `APP_ORIGIN` and sends HSTS;
2. forwards **every path unchanged** to the web container — no path stripping,
   and no separate route for `/api` (nginx in the web container proxies it);
3. sets `X-Forwarded-For` and `X-Forwarded-Proto`; and
4. connects from an address inside `AUTH_TRUSTED_PROXIES`.

Rule 4 matters: the API skips only trusted hops in `X-Forwarded-For` when it
works out the client IP for rate limiting
([SECURITY_STANDARDS.md](SECURITY_STANDARDS.md#proxy-trust)). An untrusted proxy
makes every visitor share one rate-limit bucket, so one guesser locks everyone
out with 429s.

Docker's published ports bypass host firewalls such as ufw, which is why the web
port binds to `127.0.0.1` by default. Widen `WEB_BIND_ADDRESS` only as far as
the proxy needs.

### Caddy on the same host (recommended)

Caddy gets and renews certificates automatically and forwards
`X-Forwarded-For`/`X-Forwarded-Proto` by default. `/etc/caddy/Caddyfile`:

```caddyfile
workhub.example.com {
	header Strict-Transport-Security "max-age=31536000"
	reverse_proxy 127.0.0.1:8080
}
```

`sudo systemctl reload caddy`. Keep the defaults `WEB_BIND_ADDRESS=127.0.0.1`
and `AUTH_TRUSTED_PROXIES=172.16.0.0/12`: traffic reaches nginx through Docker's
port proxy from the bridge gateway, which is inside that range. Add
`includeSubDomains` to HSTS only if every subdomain is served over HTTPS.

### Caddy or another proxy in a container on the same host

Attach the proxy container to the stack's network and target the service name,
so no host port is involved. In the proxy's own compose file:

```yaml
services:
  caddy:
    # …
    networks: [workhub]
networks:
  workhub:
    name: workhub_default
    external: true
```

and `reverse_proxy web:8080` in the Caddyfile. Start WorkHub first — the
network belongs to its stack, and `wh down` removes it (restart the proxy
afterwards). The alternative is `WEB_BIND_ADDRESS=172.17.0.1` (the default
bridge gateway) with `reverse_proxy 172.17.0.1:8080`.

### Traefik

Traefik discovers containers from labels. Keep the labels in a server-side
override file next to the compose file, `/opt/workhub/docker-compose.traefik.yml`,
and add `-f /opt/workhub/docker-compose.traefik.yml` to the `wh` helper:

```yaml
services:
  web:
    networks: [default, proxy]
    labels:
      traefik.enable: 'true'
      traefik.docker.network: proxy
      traefik.http.routers.workhub.rule: Host(`workhub.example.com`)
      traefik.http.routers.workhub.entrypoints: websecure
      traefik.http.routers.workhub.tls.certresolver: letsencrypt
      traefik.http.routers.workhub.middlewares: workhub-hsts
      traefik.http.middlewares.workhub-hsts.headers.stsSeconds: '31536000'
      traefik.http.services.workhub.loadbalancer.server.port: '8080'
networks:
  proxy:
    external: true # the network your Traefik container is attached to
```

The entrypoint and certificate resolver names must match your Traefik
configuration. Traefik sets the forwarded headers by default.

### Proxy on another machine

- Set `WEB_BIND_ADDRESS` to this host's **LAN or VPN address** that the proxy
  can reach — not `0.0.0.0` on an internet-facing host — and allow only the
  proxy's address to that port in the network firewall.
- Add the proxy's address to the trusted list:
  `AUTH_TRUSTED_PROXIES=172.16.0.0/12,192.0.2.10/32`.
- IPs and CIDRs only; names such as `loopback` are not accepted.

### When Docker's networks are not in 172.16.0.0/12

Docker allocates bridge networks from `172.17.0.0/16`–`172.31.0.0/16` first and
then from `192.168.0.0/16`. A busy host, or a custom `default-address-pools` in
`/etc/docker/daemon.json`, can put `workhub_default` outside the default trusted
range. Check:

```bash
docker network inspect workhub_default --format '{{range .IPAM.Config}}{{.Subnet}} {{.Gateway}}{{end}}'
```

If the subnet is not inside `172.16.0.0/12`, add it (for example
`AUTH_TRUSTED_PROXIES=172.16.0.0/12,192.168.16.0/20`) and `wh up -d`.

## Routine upgrade

A release is described in [RELEASING.md](RELEASING.md); this is the server side.
The app is briefly unavailable while the containers restart — accepted for one
owner, so upgrade when you are not using it.

1. **Read the release notes** — `apps/api/CHANGELOG.md` and
   `apps/web/CHANGELOG.md` at the new tag. Note any migration
   (`apps/api/prisma/migrations/` changed since your version) and any change to
   `docker-compose.prod.yml` or `.env.example`.
2. **Take a backup** named after the version you are leaving
   ([Manual backup](#manual-backup)). Required whenever the release contains a
   migration ([DATABASE.md](DATABASE.md#migration-safety)); cheap enough to do
   every time.
3. **Update the compose file** if it changed, as in
   [First deploy](#1-fetch-the-compose-file-for-the-release), and add any new
   variables to `.env.production`.
4. **Set the tag and pull:**

   ```bash
   cd /opt/workhub
   sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=X.Y.Z/' .env.production
   wh pull
   ```

5. **Restart:** `wh up -d`. Compose runs `migrate` with the new image and starts
   `api` only if it exits 0.
6. **Check the migration:**

   ```bash
   wh ps -a migrate            # Exited (0)
   wh logs migrate             # "All migrations have been successfully applied." or "No pending migrations to apply."
   ```

7. **Health check:** `wh ps` shows everything healthy; through the proxy,
   `curl -fsS https://workhub.example.com/api/v1/config`; sign in and open a
   page that reads data.

### Rollback

- **No migration in the release:** set `IMAGE_TAG` back to the previous version,
  `wh pull && wh up -d`.
- **A migration ran:** Prisma migrations are forward-only — there are no down
  migrations ([DATABASE.md](DATABASE.md#migration-safety)). Restore the dump you
  took in step 2, then run the previous version:

  ```bash
  cd /opt/workhub
  wh stop web api
  wh exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
  wh exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error --single-transaction' \
    < /var/backups/workhub/<pre-upgrade>.dump
  sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<previous>/' .env.production
  wh up -d
  ```

  Anything written after the dump is lost.

## Backups and restore

The database volume `workhub-db-data` is the **only** stateful part of the stack.
The rest can be rebuilt from the images, the compose file and
`.env.production` (kept in the password manager).

> **Status.** Automated backups are **planned, not built** (PRODUCT.md
> [Next](PRODUCT.md#next)). Until they exist, take manual backups before every
> upgrade and regularly, and copy them off the host yourself.

### Manual backup

```bash
sudo install -d -o "$USER" -m 700 /var/backups/workhub
wh exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "/var/backups/workhub/workhub-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

- `-Fc` is PostgreSQL's compressed custom format, restored with `pg_restore`.
- Check that the file is a readable archive, not an error message:
  `wh exec -T db pg_restore --list < /var/backups/workhub/<file>.dump | head`.
- A dump on the same disk is not a backup. Copy it off the host, encrypted.

### Automated backups (planned)

The agreed design, to be built as the backups item in PRODUCT.md's Next list:

- **Nightly** on the host (a systemd timer or cron): `pg_dump -Fc` as above into
  `/var/backups/workhub`, keeping the last couple of dumps locally.
- **Encrypted off-site copy** with [restic](https://restic.net) to S3-compatible
  storage or Backblaze B2. The restic repository password lives in the password
  manager — without it the backups cannot be read.
- **Retention:** `restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune`,
  and a periodic `restic check`.
- **Heartbeat:** after the off-site copy succeeds, the job pings a
  dead-man's-switch monitor (for example healthchecks.io); a missed ping alerts
  the owner ([OBSERVABILITY.md](OBSERVABILITY.md#alerts-that-matter)).
- **Pre-migration dump** as part of the upgrade path, not only by hand
  (BACKLOG.md).
- A data export for the owner's own use sits alongside
  ([DATABASE.md](DATABASE.md#data-export-planned)).

### Restore drill

Rehearse a restore into a **throwaway** database and API — never the live
stack — after setting up backups, after a PostgreSQL major upgrade, and every
few months. Run it on any Docker host that can pull the images:

```bash
DUMP=/var/backups/workhub/<file>.dump
TAG=X.Y.Z          # the version that wrote the dump
IMAGE=ghcr.io/huttonhomehub/workhub/api:$TAG
DB_URL='postgresql://app:drill@drill-db:5432/app?schema=public'

docker network create workhub-drill
docker run -d --name drill-db --network workhub-drill \
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=app postgres:17-alpine
until docker exec drill-db pg_isready -U app -d app; do sleep 1; done

# 1. Restore.
docker exec -i drill-db pg_restore -U app -d app --exit-on-error --single-transaction < "$DUMP"

# 2. The schema matches the release: "Database schema is up to date!"
docker run --rm --network workhub-drill -e DATABASE_URL="$DB_URL" "$IMAGE" \
  node_modules/.bin/prisma migrate status

# 3. The data is there.
docker exec drill-db psql -U app -d app -c 'SELECT count(*) AS users FROM users;'

# 4. The API boots against it and the owner can sign in.
docker run -d --name drill-api --network workhub-drill -p 127.0.0.1:3999:3000 \
  -e NODE_ENV=production -e DATABASE_URL="$DB_URL" \
  -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  -e BETTER_AUTH_URL=http://localhost:3999 -e CORS_ORIGINS=http://localhost:3999 \
  "$IMAGE"
sleep 10 && curl -fsS http://127.0.0.1:3999/health/ready
read -rs PW && jq -n --arg email you@example.com --arg password "$PW" '{$email, $password}' \
  | curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3999/api/auth/sign-in/email \
      -H 'Content-Type: application/json' -H 'Origin: http://localhost:3999' --data @-   # 200
unset PW

# 5. Clean up.
docker rm -f drill-api drill-db && docker network rm workhub-drill
```

Record the date, the dump used and anything that surprised you. A restore that
has never been rehearsed is not a backup.

## PostgreSQL major upgrade

A new PostgreSQL major cannot start on the old major's data directory. Upgrade
by **dump and restore into a new volume**; never point the new major at
`workhub-db-data`, never delete or rename it until the new one is proven.

1. The release that moves `postgres:17-alpine` to the next major also gives the
   volume a new explicit name in `docker-compose.prod.yml` (for example
   `workhub-db-data-pg18`) and checks the new image's data directory and mount
   path in its release notes.
2. Before upgrading, on the current version: take a [manual backup](#manual-backup)
   and run the [restore drill](#restore-drill) against the **new** Postgres image
   to prove the dump restores.
3. `wh down` (volumes are kept — never add `-v`).
4. Fetch the new compose file and set `IMAGE_TAG`.
5. `wh up -d db` — the new volume is created and initialised with
   `POSTGRES_PASSWORD` from `.env.production`.
6. Restore the dump:
   `wh exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error --single-transaction' < <file>.dump`.
7. `wh up -d`, then verify as after a [routine upgrade](#routine-upgrade).
8. Keep `workhub-db-data` until backups from the new major have run and been
   drill-restored; then `docker volume rm workhub-db-data`.

**Rollback:** restore the previous compose file (old image, old volume name) and
`wh up -d` — the old volume is untouched.

## Secrets

| Secret               | Generate                    | Notes                                                            |
| -------------------- | --------------------------- | ---------------------------------------------------------------- |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`   | ≥ 32 characters, no placeholder; signs session cookies           |
| `POSTGRES_PASSWORD`  | `openssl rand -hex 32`      | Hex, because it is interpolated into `DATABASE_URL`              |
| GHCR token           | GitHub → Developer settings | Only if the packages are private; `read:packages` scope only     |
| restic password      | password manager            | **(planned)** — losing it makes every off-site backup unreadable |

`.env.production` stays mode 600, owned by the deploy user, and never leaves
the host except into the password manager. Rules:
[SECURITY_STANDARDS.md](SECURITY_STANDARDS.md#secrets).

### Rotate `BETTER_AUTH_SECRET`

Rotating it **signs out every session** — also the way to force
re-authentication everywhere.

```bash
cd /opt/workhub
sed -i "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(openssl rand -base64 32)|" .env.production
wh up -d        # recreates api with the new secret
```

Update the copy in the password manager.

### Rotate `POSTGRES_PASSWORD`

The Postgres image applies `POSTGRES_PASSWORD` **only when the volume is first
initialised**; changing the env file alone breaks `migrate` and `api` with an
authentication error. Change the role first, then the file:

```bash
cd /opt/workhub
NEW=$(openssl rand -hex 32)
printf "ALTER USER CURRENT_USER WITH PASSWORD '%s';\n" "$NEW" \
  | wh exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$NEW|" .env.production
unset NEW
wh up -d        # recreates migrate and api with the new DATABASE_URL
```

Connections over the container's local socket don't need the password, so the
`ALTER USER` works before the file changes; the SQL goes through stdin, so the
password never appears in a process list. Update the password manager.

## Logs

The containers log to Docker's `json-file` driver, rotated at **10 MB × 5 files
per service** (`docker-compose.prod.yml`); older lines are gone. The API writes
one Pino JSON object per line. What is logged, and what isn't (notably
`/api/auth/*` today): [OBSERVABILITY.md](OBSERVABILITY.md#logging).

```bash
wh logs -f --since 30m api          # follow the API
wh logs --tail 200 web              # nginx access and error log
wh logs migrate                     # the last migration run

# Everything for one request: the id is the x-correlation-id response header.
ID=<correlation-id>
wh logs --no-log-prefix api | jq -cR --arg id "$ID" 'fromjson? | select(.req.id == $id or .correlationId == $id)'

# Errors in the last day.
wh logs --no-log-prefix --since 24h api | jq -cR 'fromjson? | select(.level >= 50)'
```

Pino levels are numbers: 30 info, 40 warn, 50 error, 60 fatal. Ship logs
elsewhere if you need longer history; that is the owner's choice, not part of
the stack.

## Monitoring

The alerts that matter, all checked from **outside the host** so a dead server
still alerts ([OBSERVABILITY.md](OBSERVABILITY.md#alerts-that-matter)):

1. **Uptime:** an external monitor requests
   `https://workhub.example.com/api/v1/config` every few minutes and alerts
   after two failures. Use this endpoint, not `/health/ready`: nginx does not
   proxy `/health/*`, so that path returns the SPA with 200 whatever the API's
   state (BACKLOG.md). `/api/v1/config` proves the proxy, nginx and the API
   answer; it does not prove the database is up.
2. **Backup heartbeat (planned):** the nightly job pings a dead-man's switch;
   a missed ping alerts.
3. **Disk space:** alert well before the disk fills (for example at 80%) — a
   full disk stops Postgres. A daily cron job that pings a heartbeat monitor
   only while `df` is under the threshold does this without extra software.

Check container health by hand with `wh ps`; a container stuck in
`(unhealthy)` is covered under [Troubleshooting](#container-unhealthy).

## Disaster recovery

The host is lost, or its disk is. You need the password manager (for
`.env.production`, the restic password and any GHCR token) and the latest
off-site backup.

1. Provision a new host with the [prerequisites](#host-prerequisites) and GHCR
   access.
2. Recreate `/opt/workhub`: fetch the compose file for the version you were
   running, and restore `.env.production` from the password manager (mode 600).
3. Fetch the latest dump — with restic (planned) `restic restore latest --target /tmp/workhub-restore`,
   or wherever you copied manual dumps.
4. `wh pull && wh up -d db`, and wait for `wh ps` to show `db` healthy.
5. Restore:
   `wh exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error --single-transaction' < <file>.dump`.
6. `wh up -d`, and verify as in [First deploy](#5-verify).
7. Point the reverse proxy (and DNS, if the address changed) at the new host.
8. Re-enable backups and monitoring; sign in and check recent data is present.

## Troubleshooting

### `migrate` failed

`wh up -d` stops with _service "migrate" didn't complete successfully_, and `api`
does not start.

- `wh logs migrate` shows the Prisma error:
  - **P1001** (can't reach database) — `db` is not healthy yet or has failed;
    see `wh logs db`.
  - **P1000** (authentication failed) — `POSTGRES_PASSWORD` in `.env.production`
    no longer matches the role; see [Rotate `POSTGRES_PASSWORD`](#rotate-postgres_password).
  - **P3009** (a failed migration is recorded) or an SQL error — a migration
    failed part-way. Don't hand-edit the schema: restore the pre-upgrade dump and
    run the previous version ([Rollback](#rollback)), then fix the migration in a
    new release.
- Inspect state without changing it:
  `wh run --rm migrate node_modules/.bin/prisma migrate status`.

### Sign-in fails with `Invalid origin`

The browser's origin is not in the API's trusted origins. In production the only
trusted origin is `APP_ORIGIN` (it sets `CORS_ORIGINS` and `BETTER_AUTH_URL`).

- `wh logs api | grep -i 'invalid origin'` shows the origin that was refused.
- `APP_ORIGIN` must match what the browser shows exactly: `https`, the same host,
  a port only if the URL has one, **no trailing slash**. Fix it and `wh up -d`.

### 429 Too Many Requests for everyone

All visitors share one rate-limit bucket because the API does not trust the hop
in front of it, so it cannot see the real client IP.

- Check the proxy connects from an address in `AUTH_TRUSTED_PROXIES` — another
  host's address must be added explicitly ([Proxy on another machine](#proxy-on-another-machine)).
- Check the Docker network subnet
  ([not in 172.16.0.0/12](#when-dockers-networks-are-not-in-1721600012)).
- Check the proxy sets `X-Forwarded-For` and doesn't pass through a
  client-supplied one untrusted.
- Better Auth allows 3 sign-in attempts per 10 seconds per IP; a 429 on sign-in
  after rapid retries is expected
  ([SECURITY_STANDARDS.md](SECURITY_STANDARDS.md#rate-limiting-and-brute-force)).

### The API won't start: secret rejected or variable missing

- `wh up` refuses with _required variable … is missing a value_ — the command
  was run without `--env-file .env.production` (use `wh`), or the variable is
  missing from the file.
- `api` restarts in a loop and `wh logs api` shows
  _Invalid environment configuration: BETTER_AUTH_SECRET …_ — the secret is
  shorter than 32 characters or contains a placeholder marker. Generate one
  ([Rotate `BETTER_AUTH_SECRET`](#rotate-better_auth_secret)).
- `P1013`/invalid database URL — `POSTGRES_PASSWORD` contains `/`, `+` or `=`
  (for example from `openssl rand -base64`). Rotate it to a hex value.

### Container unhealthy

```bash
wh ps
docker inspect --format '{{json .State.Health}}' workhub-api-1 | jq '.Log[-3:]'
```

- `api` checks `GET /health` inside the container: unhealthy means the process
  is not answering on port 3000 — read `wh logs api`.
- `web` checks that nginx serves `/`: read `wh logs web` (a bad template
  substitution or a crash loop).
- `db` checks `pg_isready`: read `wh logs db`; check free disk space first.

### The web container returns the SPA for an API path

nginx proxies only paths under `/api/`; everything else falls back to
`index.html` with 200.

- `/health` and `/health/ready` are not proxied by design today (BACKLOG.md) —
  check them inside the container ([Verify](#5-verify)).
- `/api` without the trailing slash is not an API path.
- If real API calls (`/api/v1/…`, `/api/auth/…`) come back as HTML, the reverse
  proxy is rewriting or stripping the path, or routing `/api` somewhere other
  than the web container. Forward every path unchanged to the web container.

### 502 Bad Gateway just after `up`

nginx starts before the API is ready (`web` does not wait for `api` to be
healthy — BACKLOG.md). It clears within a few seconds of `api` turning healthy;
if not, read `wh logs api`.
