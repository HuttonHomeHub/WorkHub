import { Moon, Sun } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';

interface AppShellProps {
  /** Right-hand header content (user menu, sign-out, …). */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}

/**
 * The authenticated app shell: sticky header + content container. Grows a
 * sidebar/navigation as features land (docs/FRONTEND_ARCHITECTURE.md).
 */
export function AppShell({ actions, children }: AppShellProps) {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <span className="font-semibold">Blank App</span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {actions}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
