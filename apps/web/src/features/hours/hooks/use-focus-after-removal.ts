import * as React from 'react';

/**
 * Moves focus to the next row after the focused row is removed, or to the
 * list itself when it is now empty — never to `<body>` (docs/ACCESSIBILITY.md
 * → Focus, 2.4.3).
 *
 * Give the list container `ref={listRef}` and `tabIndex={-1}`, and each row
 * `data-row-id={row.id}`; call `removing(id)` just before removing a row. Focus
 * lands on the first button in the row that takes its place.
 */
export function useFocusAfterRemoval<T extends { id: string }>(rows: readonly T[] | undefined) {
  const listRef = React.useRef<HTMLDivElement>(null);
  // The id to focus next; '' for the list itself; null when nothing is pending.
  const pending = React.useRef<string | null>(null);

  React.useEffect(() => {
    const target = pending.current;
    if (target === null || !listRef.current) return;
    // Wait until the row has actually gone from the rendered list.
    const row = target
      ? listRef.current.querySelector<HTMLElement>(`[data-row-id="${target}"] button`)
      : null;
    if (target && !row) return;
    pending.current = null;
    (row ?? listRef.current).focus();
  }, [rows]);

  const removing = React.useCallback(
    (id: string) => {
      const list = rows ?? [];
      const index = list.findIndex((row) => row.id === id);
      const next = list[index + 1] ?? list[index - 1];
      pending.current = next ? next.id : '';
    },
    [rows],
  );

  return { listRef, removing };
}
