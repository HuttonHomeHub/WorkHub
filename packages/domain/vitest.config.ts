import { defineConfig } from 'vitest/config';

// Unit tests for the pure domain rules. Fixed dates only: nothing here reads
// the wall clock (docs/features/hours-tracker.md → Calculation rules).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
