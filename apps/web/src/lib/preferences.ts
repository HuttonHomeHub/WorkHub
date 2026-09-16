import { z } from 'zod';

/**
 * Persisted UI preferences (docs/FRONTEND_ARCHITECTURE.md → Persisted UI
 * preferences): per-browser settings in `localStorage`, never server or URL
 * state. This module owns every key, the stored format and the validation.
 *
 * Each value is stored as `{ "version": 1, "value": … }`. A missing, corrupt,
 * invalid or old-version value reads as the default, and storage that is
 * unavailable (blocked site data, a sandboxed frame) never throws.
 *
 * `index.html` reads `workhub:sidebar` before first paint. Keep its inline
 * script in step with the sidebar entry below.
 */

/** Bump when a stored shape changes; older values then fall back to defaults. */
export const PREFERENCES_VERSION = 1;

/** Every persisted preference and the shape of its value. */
export interface Preferences {
  sidebar: { collapsed: boolean };
}

/** The name of a persisted preference. */
export type PreferenceName = keyof Preferences;

interface PreferenceDefinition<T> {
  key: string;
  schema: z.ZodType<T>;
  defaultValue: T;
}

const definitions: { [N in PreferenceName]: PreferenceDefinition<Preferences[N]> } = {
  sidebar: {
    key: 'workhub:sidebar',
    schema: z.object({ collapsed: z.boolean() }),
    defaultValue: { collapsed: false },
  },
};

/** The `localStorage` key for a preference (for tests and the pre-paint script). */
export function preferenceKey(name: PreferenceName): string {
  return definitions[name].key;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Reads a preference, falling back to its default for anything unusable. */
export function readPreference<N extends PreferenceName>(name: N): Preferences[N] {
  const definition = definitions[name];
  try {
    const raw = storage()?.getItem(definition.key);
    if (raw == null) return definition.defaultValue;
    const stored: unknown = JSON.parse(raw);
    const envelope = z
      .object({ version: z.literal(PREFERENCES_VERSION), value: definition.schema })
      .safeParse(stored);
    return envelope.success ? envelope.data.value : definition.defaultValue;
  } catch {
    return definition.defaultValue;
  }
}

/** Writes a preference. Fails silently when storage is unavailable or full. */
export function writePreference<N extends PreferenceName>(name: N, value: Preferences[N]): void {
  try {
    storage()?.setItem(
      definitions[name].key,
      JSON.stringify({ version: PREFERENCES_VERSION, value }),
    );
  } catch {
    // A preference is a convenience: losing one must never break the app.
  }
}
