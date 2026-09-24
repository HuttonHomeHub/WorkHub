import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge taught the design system's own utilities, so `text-body` is
 * read as a font size (not a colour that would override `text-foreground`)
 * and `focus-ring` is left alone (DESIGN_SYSTEM.md → Typography).
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['meta', 'small', 'body', 'lead', 'h3', 'h2', 'h1'],
    },
  },
});

/** Merge class names with Tailwind-aware conflict resolution (shadcn/ui `cn`). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
