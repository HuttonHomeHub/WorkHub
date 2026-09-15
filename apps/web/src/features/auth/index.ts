/** Public surface of the auth feature (docs/FRONTEND_ARCHITECTURE.md). */
export { ensureSession, sessionQueryOptions, useSession, useSignOut } from './api/session';
export type { SessionUser } from './api/session';
export { SignInForm } from './components/sign-in-form';
export { SignUpForm } from './components/sign-up-form';
