import { House } from 'lucide-react';

import { hoursTool } from '@/features/hours/tool';
import type { ToolManifest } from '@/lib/tool-manifest';

/**
 * The signed-in home page. It belongs to no tool, so its manifest lives here in
 * the composition root rather than under `features/`.
 */
const homeTool: ToolManifest = {
  id: 'home',
  label: 'Home',
  icon: House,
  path: '/',
  commands: [{ id: 'home.go', label: 'Go to Home' }],
};

/**
 * Every tool, in sidebar order (ADR-0020). `app/` is the web's composition
 * root, so this is the one module that imports each feature's `tool.ts`.
 */
export const tools: readonly ToolManifest[] = [homeTool, hoursTool];
