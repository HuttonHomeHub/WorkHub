/**
 * `@repo/domain`: pure rules both apps run (ADR-0020 §5) — no Nest, React or
 * Prisma imports, no I/O and no wall clock.
 */
export * from './core/csv.js';
export * from './core/time/index.js';
export * from './hours/index.js';
