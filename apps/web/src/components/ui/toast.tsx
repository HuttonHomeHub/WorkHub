import * as ToastPrimitive from '@radix-ui/react-toast';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import * as React from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Toasts (docs/DESIGN_SYSTEM.md → Toast, docs/UX_STANDARDS.md → Feedback).
 * One `Toaster` renders them, bottom-right above everything (`--z-toast`);
 * anything raises one with `toast()`, from a component or a mutation callback.
 *
 * Lifetimes: success and info 4s; a toast with an action (an undo) 8s; errors
 * persist until dismissed. Every toast is announced through a polite live
 * region and never takes focus.
 *
 * Keyboard contract: the toaster sits in the tab order straight after the
 * page's content, so Tab reaches a toast's action and its dismiss button; a
 * toast's timer pauses while focus or the pointer is in the toaster (and while
 * the window is in the background). Esc dismisses the focused toast. There is
 * no hotkey to jump to the toaster: Radix's default F8 is switched off, because
 * the palette's Ctrl/Cmd+K is the app's only custom shortcut.
 */

type ToastVariant = 'success' | 'error' | 'info';

interface ToastAction {
  /** The button's text, a verb: "Undo". */
  label: string;
  /** Describes how else to do it, for screen readers (Radix requires it). */
  altText: string;
  onAction: () => void;
}

interface ToastOptions {
  /** Past tense for a success: "Terms deleted". */
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** One action, such as Undo. A toast with an action lasts 8s. */
  action?: ToastAction;
}

interface ToastItem extends ToastOptions {
  id: number;
}

/** How long each kind of toast stays (docs/UX_STANDARDS.md → Timing). */
const TOAST_DURATION_MS = { brief: 4_000, withAction: 8_000 } as const;

function durationOf(item: Pick<ToastItem, 'variant' | 'action'>): number {
  if (item.variant === 'error') return Infinity;
  return item.action ? TOAST_DURATION_MS.withAction : TOAST_DURATION_MS.brief;
}

// A tiny external store, so `toast()` works outside React (in a mutation's
// callbacks) and one Toaster renders every toast.
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = (): ToastItem[] => items;

/** Shows a toast and returns its id. */
function toast(options: ToastOptions): number {
  const id = nextId++;
  items = [...items, { variant: 'success', ...options, id }];
  emit();
  return id;
}

/** Removes one toast, or every toast when no id is given. */
function dismissToast(id?: number): void {
  items = id === undefined ? [] : items.filter((item) => item.id !== id);
  emit();
}

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info } as const;

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: '[&>svg]:text-success',
  error: 'border-destructive/50 [&>svg]:text-destructive',
  info: '[&>svg]:text-info',
};

interface ToasterProps {
  /** Names the toaster's landmark region: "Notifications". */
  label: string;
  /** Names each toast's close button: "Dismiss notification". */
  dismissLabel: string;
}

/** Renders the toasts. Mount it once, after `<main>` (AppShell does). */
function Toaster({ label, dismissLabel }: ToasterProps) {
  const toasts = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return (
    <ToastPrimitive.Provider swipeDirection="right" label={label}>
      {toasts.map((toastItem) => {
        const { id, title, description, variant = 'success', action } = toastItem;
        const Icon = ICONS[variant];
        return (
          <ToastPrimitive.Root
            key={id}
            type="background"
            duration={durationOf(toastItem)}
            onOpenChange={(open) => {
              if (!open) dismissToast(id);
            }}
            className={cn(
              'bg-popover text-popover-foreground focus-visible:ring-ring pointer-events-auto flex items-start gap-3 rounded-md border p-3 text-sm shadow-md outline-none focus-visible:ring-2 [&>svg]:mt-0.5 [&>svg]:size-4',
              VARIANT_CLASSES[variant],
            )}
          >
            <Icon aria-hidden />
            <div className="grid min-w-0 flex-1 gap-1">
              <ToastPrimitive.Title className="font-medium">{title}</ToastPrimitive.Title>
              {description ? (
                <ToastPrimitive.Description className="text-muted-foreground">
                  {description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {action ? (
                <ToastPrimitive.Action
                  altText={action.altText}
                  onClick={action.onAction}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  {action.label}
                </ToastPrimitive.Action>
              ) : null}
              <ToastPrimitive.Close
                aria-label={dismissLabel}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                  'text-muted-foreground',
                )}
              >
                <X aria-hidden />
              </ToastPrimitive.Close>
            </div>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport
        hotkey={[]}
        label={label}
        className="pointer-events-none fixed right-0 bottom-0 z-(--z-toast) flex max-h-svh w-full max-w-(--width-toast) flex-col gap-2 p-4 outline-none"
      />
    </ToastPrimitive.Provider>
  );
}

export { dismissToast, toast, Toaster, type ToastOptions, type ToastVariant };
