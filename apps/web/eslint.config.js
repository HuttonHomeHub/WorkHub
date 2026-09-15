import react from '@repo/config/eslint/react';

export default [
  // TanStack Router generates this file; it is not hand-maintained code.
  { ignores: ['src/routeTree.gen.ts'] },
  ...react,
];
