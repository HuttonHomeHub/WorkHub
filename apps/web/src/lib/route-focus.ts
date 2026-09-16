import type { AnyRouter } from '@tanstack/react-router';

/**
 * Focus after a route change (WCAG 2.4.3, docs/ACCESSIBILITY.md → Focus).
 *
 * When an in-app navigation changes the **pathname**, focus moves to the new
 * page's `<main>` landmark, or, on a page without one (the public sign-in
 * pages), to its first heading. The link or button the owner used may no longer
 * exist, and focus would otherwise fall back to `<body>`.
 *
 * Focus is left alone:
 * - on the initial page load (including a redirect during it), so the browser
 *   starts at the top of the document as usual;
 * - when only search params or the hash change (`?week=` navigation), so a
 *   control that changes the URL keeps its focus.
 *
 * Call once, from the root route. Returns the unsubscribe function.
 */
export function subscribeRouteFocus(router: AnyRouter): () => void {
  return router.subscribe('onRendered', ({ fromLocation, pathChanged }) => {
    if (!fromLocation || !pathChanged) return;
    focusPageStart();
  });
}

function focusPageStart(): void {
  const target = document.querySelector<HTMLElement>('main') ?? document.querySelector('h1, h2');
  if (!target) return;
  // Focusable by script only, never a Tab stop. `<main>` in the app shell
  // already has it; a heading gets it here.
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}
