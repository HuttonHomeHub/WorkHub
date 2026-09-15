# syntax=docker/dockerfile:1
# -----------------------------------------------------------------------------
# Multi-stage build for the WorkHub API (@repo/api).
# Built from the repository root so pnpm workspace packages resolve:
#   docker build -f apps/api/Dockerfile -t app-api .
#
# The runtime image also carries the Prisma CLI + prisma/ directory so the SAME
# image applies database migrations (`prisma migrate deploy`) — run as a
# one-shot service before the API starts (see docker-compose.prod.yml).
# -----------------------------------------------------------------------------

# --- Base: pinned Node + pnpm via corepack -----------------------------------
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# --- Dependencies: install with a cached pnpm store --------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @repo/api...

# --- Build: compile the API (and the packages it depends on) + Prisma client --
FROM deps AS build
COPY . .
# `@repo/api...` builds workspace dependencies (e.g. @repo/types) first.
# `deploy` installs a fresh @prisma/client into /out, so the client is generated
# again from a schema copied INTO /out — Prisma writes the client next to the
# @prisma/client it resolves from the schema's location. The first generate only
# serves the TypeScript build.
RUN pnpm --filter @repo/api prisma:generate \
    && pnpm --filter "@repo/api..." build \
    && pnpm --filter @repo/api --prod deploy --legacy /out \
    && cp -r apps/api/prisma /out/prisma \
    && cd /out && ./node_modules/.bin/prisma generate

# --- Runtime: minimal, non-root ----------------------------------------------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Run as the built-in unprivileged `node` user.
USER node
COPY --chown=node:node --from=build /out/dist ./dist
COPY --chown=node:node --from=build /out/node_modules ./node_modules
COPY --chown=node:node --from=build /out/package.json ./package.json
# Schema + migrations for `prisma migrate deploy`.
COPY --chown=node:node --from=build /out/prisma ./prisma
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
