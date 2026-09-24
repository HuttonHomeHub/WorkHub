import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
  it('reads the type scale as font sizes, so a text colour survives beside one', () => {
    expect(cn('text-body text-foreground')).toBe('text-body text-foreground');
    expect(cn('text-muted-foreground text-meta')).toBe('text-muted-foreground text-meta');
  });

  it('lets a later size replace an earlier one', () => {
    expect(cn('text-body', 'text-small')).toBe('text-small');
  });
});
