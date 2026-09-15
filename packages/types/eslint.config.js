import base from '@repo/config/eslint/base';

export default [
  // Generated from apps/api/openapi.json by `pnpm contract:generate` (ADR-0017).
  { ignores: ['src/openapi.gen.ts'] },
  ...base,
];
