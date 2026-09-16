import type { LinkProps } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';

/**
 * A command a tool offers the command palette (ADR-0020 → Palette). The palette
 * is not built yet, so a command is declared by its id and label only; the
 * palette's own work adds how a command runs.
 */
export interface ToolCommand {
  /** Stable, namespaced id: `<tool id>.<action>` (for example `hours.go-to-today`). */
  id: string;
  /** Sentence-case label shown in the palette ("Hours: go to today"). */
  label: string;
}

/**
 * What a tool tells the app shell about itself (ADR-0020 → A tool, on both
 * sides). Each tool exports one from `features/<tool>/tool.ts`, and
 * `app/tools.ts` lists them in sidebar order.
 */
export interface ToolManifest {
  /** Stable, kebab-case tool id (`hours`). `core` is reserved. */
  id: string;
  /** Sentence-case sidebar label (`Hours`). */
  label: string;
  /** The Lucide icon shown beside the label in the sidebar. */
  icon: LucideIcon;
  /** The tool's home route. Every route under it marks the tool as current. */
  path: LinkProps['to'];
  /** Palette commands, starting with "Go to <tool>". */
  commands: readonly ToolCommand[];
}
