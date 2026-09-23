import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import * as React from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * AlertDialog — a modal that stops the owner **only** before something that
 * cannot be undone, such as discarding unsaved changes
 * (docs/DESIGN_SYSTEM.md → Dialog / AlertDialog, docs/UX_STANDARDS.md →
 * Undo over confirm). Anything reversible acts at once and offers undo instead.
 * Its confirm button names the action ("Discard changes"), never "OK".
 *
 * Keyboard contract: focus moves to **Cancel** when it opens and is trapped
 * inside; Tab and Shift+Tab cycle the buttons; Enter or Space presses the
 * focused one; Esc cancels. Focus returns to the element that had it when the
 * dialog opened (its trigger, or the control whose action opened it). It is labelled by its title and described by
 * its description; the page behind is inert and does not scroll. Clicking
 * outside does nothing: the owner must choose.
 */
function AlertDialog(props: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root {...props} />;
}

/** The overlay and the dialog panel, portalled above everything but toasts (`--z-modal`). */
function AlertDialogContent({
  className,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  // An AlertDialog opened by code (a navigation blocker) has no trigger for
  // Radix to return focus to, so remember what had focus when it opened.
  const returnTo = React.useRef<HTMLElement | null>(null);
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="bg-foreground/40 fixed inset-0 z-(--z-modal)" />
      <AlertDialogPrimitive.Content
        onOpenAutoFocus={(event) => {
          returnTo.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          onOpenAutoFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          const target = returnTo.current;
          returnTo.current = null;
          if (!event.defaultPrevented && target?.isConnected && target !== document.body) {
            event.preventDefault();
            target.focus();
          }
        }}
        className={cn(
          'bg-popover text-popover-foreground fixed top-1/2 left-1/2 z-(--z-modal) grid max-h-svh w-full max-w-(--width-dialog) -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-lg border p-6 shadow-lg',
          className,
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

/** The dialog's title (it names the dialog): a question, "Discard changes?". */
function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title className={cn('text-lg font-semibold', className)} {...props} />
  );
}

/** What happens if the owner goes ahead (it describes the dialog). */
function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

/** The buttons, right-aligned; they wrap at the reflow floor. */
function AlertDialogFooter({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('flex flex-wrap justify-end gap-2', className)} {...props} />;
}

/** Keeps things as they are and closes the dialog. It has focus when the dialog opens. */
function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: 'outline', wrap: true }), className)}
      {...props}
    />
  );
}

/** Goes ahead with the irreversible action; label it with the action's verb. */
function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants({ variant: 'destructive', wrap: true }), className)}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
};
