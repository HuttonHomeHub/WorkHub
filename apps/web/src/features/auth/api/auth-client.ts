import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth client (ADR-0003). No baseURL: the app is always same-origin
 * with the API (dev proxy / nginx), so requests go to `/api/auth/*` on the
 * current origin. Sessions live in an http-only cookie — never in JS storage.
 */
export const authClient = createAuthClient();
