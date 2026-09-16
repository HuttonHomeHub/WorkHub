import { describe, expect, it } from 'vitest';

import { tools } from './tools';

describe('tool registry', () => {
  it('lists Home first', () => {
    expect(tools[0]?.id).toBe('home');
    expect(tools[0]?.path).toBe('/');
  });

  it('gives every tool a unique, kebab-case id and never the reserved `core`', () => {
    const ids = tools.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(id).not.toBe('core');
    }
  });

  it('declares a "Go to" command first, with ids namespaced by the tool', () => {
    for (const tool of tools) {
      expect(tool.commands[0]?.label).toBe(`Go to ${tool.label}`);
      for (const command of tool.commands) {
        expect(command.id.startsWith(`${tool.id}.`)).toBe(true);
      }
    }
  });
});
