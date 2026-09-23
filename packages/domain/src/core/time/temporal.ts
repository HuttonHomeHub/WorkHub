/**
 * The one import of the Temporal API (ADR-0020 §5). Everything in
 * `@repo/domain` takes `Temporal` from here, never from `globalThis`, so the web,
 * the API and the tests behave identically. Moving to native Temporal once Node
 * ships it is a change to this file only.
 */
export { Temporal } from 'temporal-polyfill';
