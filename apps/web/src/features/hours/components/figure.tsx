import type * as React from 'react';

/**
 * One labelled figure in an aside panel's `<dl>`: the term left in muted
 * text, the value right-aligned in tabular numerals.
 */
export function Figure({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 py-0.5">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="ml-auto text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}
