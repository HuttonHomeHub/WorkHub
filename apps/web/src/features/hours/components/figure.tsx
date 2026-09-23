import type * as React from 'react';

/**
 * One labelled figure in an aside panel's `<dl>`: the term left, the value
 * right-aligned in tabular numerals.
 */
export function Figure({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  );
}
