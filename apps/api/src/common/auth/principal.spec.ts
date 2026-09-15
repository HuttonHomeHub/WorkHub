import { describe, expect, it } from 'vitest';

import { Principal } from './principal';

const USER = '33333333-3333-7333-8333-333333333333';
const OTHER_USER = '44444444-4444-7444-8444-444444444444';

/** Unit tests for the ownership model (ADR-0016). */
describe('Principal', () => {
  const principal = new Principal(USER, 'user@example.com', 'Test User');

  it('owns a resource whose ownerId matches its userId', () => {
    expect(principal.owns({ ownerId: USER })).toBe(true);
  });

  it('does not own a resource belonging to another user (IDOR defence)', () => {
    expect(principal.owns({ ownerId: OTHER_USER })).toBe(false);
  });
});
