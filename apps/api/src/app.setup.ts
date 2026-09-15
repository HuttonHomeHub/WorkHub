import { VersioningType, type INestApplication } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import { AUTH_INSTANCE, type AuthInstance } from './common/auth/auth.instance';
import { AppConfigService } from './config/app-config.service';

/**
 * Applies the HTTP wiring shared by `main.ts` and the e2e tests: security
 * headers, the Better Auth handler, body parsing, CORS, prefix/versioning.
 * The app MUST be created with `bodyParser: false` — Better Auth's handler
 * needs the raw request body, so it is mounted BEFORE the JSON parser.
 * See docs/BACKEND_ARCHITECTURE.md.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(AppConfigService);

  // Honour X-Forwarded-* only from the configured proxy hops (web nginx, the
  // operator's reverse proxy) — the same AUTH_TRUSTED_PROXIES list Better Auth
  // uses. Trusting every peer would let a client pick its own `req.ip`, and so
  // its own throttler bucket. With none configured (e.g. `pnpm dev`, where the
  // Vite proxy connects from loopback), `req.ip` is the connecting peer.
  const instance = app.getHttpAdapter().getInstance() as Express;
  const trustedProxies = config.authTrustedProxies;
  instance.set('trust proxy', trustedProxies.length > 0 ? trustedProxies : false);

  // Security headers.
  app.use(helmet());

  // Better Auth owns /api/auth/* (sign-up, sign-in, session, sign-out — ADR-0003).
  // Mounted as raw Express middleware so it runs before body parsing and outside
  // the Nest router (its routes are version-neutral and public by design).
  const authHandler = toNodeHandler(app.get<AuthInstance>(AUTH_INSTANCE));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/auth/')) {
      void authHandler(req, res);
      return;
    }
    next();
  });

  // JSON bodies for the rest of the API.
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS — credentials on, explicit allow-list (cookie-based auth).
  app.enableCors({ origin: config.corsOrigins, credentials: true });

  // All routes under /api, URI-versioned (/api/v1/...). Health probes stay at
  // the root (/health, /health/ready) for container orchestration.
  app.setGlobalPrefix('api', { exclude: ['health', 'health/ready'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
}
