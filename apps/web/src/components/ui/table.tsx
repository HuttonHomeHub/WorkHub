import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Table parts — the one look for a data table until `DataTable` is built
 * (docs/DESIGN_SYSTEM.md → Table; docs/UX_STANDARDS.md → Tables and grids):
 * a real `<table>` with 13px meta-weight headers on a quiet header band,
 * 32px+ rows divided by hairlines, a zebra stripe and a hover surface,
 * numeric columns right-aligned in tabular numerals, and a totals footer.
 *
 * `TableContainer` owns horizontal scrolling, so a wide table never scrolls
 * the page. Pass `scrollable` (with an `aria-label`) when the table has no
 * focusable content, so the keyboard can scroll it (WCAG 2.1.1).
 */
function TableContainer({
  className,
  scrollable = false,
  ...props
}: React.ComponentPropsWithoutRef<'div'> & { scrollable?: boolean }) {
  return (
    <div
      className={cn('relative overflow-x-auto', scrollable && 'focus-ring-inset', className)}
      {...(scrollable ? { role: 'region', tabIndex: 0 } : {})}
      {...props}
    />
  );
}

function Table({ className, ...props }: React.ComponentPropsWithoutRef<'table'>) {
  return <table className={cn('text-body w-full border-collapse', className)} {...props} />;
}

function TableHeader({ className, ...props }: React.ComponentPropsWithoutRef<'thead'>) {
  return <thead className={cn('bg-muted/60 [&_tr]:border-b', className)} {...props} />;
}

/** The rows. The last row drops its rule: the card's edge or the footer's rule follows it. */
function TableBody({ className, ...props }: React.ComponentPropsWithoutRef<'tbody'>) {
  return <tbody className={cn('[&>tr:last-child]:border-b-0', className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentPropsWithoutRef<'tfoot'>) {
  return (
    <tfoot
      className={cn('bg-muted/60 border-t font-medium [&>tr]:border-b-0', className)}
      {...props}
    />
  );
}

const tableRowVariants = cva('border-b transition-colors', {
  variants: {
    /**
     * A row's surface: `zebra` stripes every even row; `stripe` sets it on
     * one row (for rows that pair up, such as a row and its notes); and
     * `highlight` marks the current row (today) with an accent tint and a
     * marker bar, never by colour alone.
     */
    tone: {
      default: '',
      zebra: 'even:bg-table-stripe',
      stripe: 'bg-table-stripe',
      highlight: 'bg-highlight row-marker',
    },
    /** A hover surface, for rows the owner scans or acts on. */
    hover: {
      true: 'hover:bg-table-hover',
      false: '',
    },
  },
  defaultVariants: { tone: 'default', hover: true },
});

interface TableRowProps
  extends React.ComponentPropsWithoutRef<'tr'>, VariantProps<typeof tableRowVariants> {
  ref?: React.Ref<HTMLTableRowElement>;
}

function TableRow({ className, tone, hover, ...props }: TableRowProps) {
  return <tr className={cn(tableRowVariants({ tone, hover }), className)} {...props} />;
}

const cellVariants = cva('px-3 align-middle first:pl-4 last:pr-4', {
  variants: {
    /** Numbers: right-aligned, tabular numerals, one line. */
    numeric: {
      true: 'text-right whitespace-nowrap tabular-nums',
      false: 'text-left',
    },
  },
  defaultVariants: { numeric: false },
});

type CellProps<Element extends 'th' | 'td'> = React.ComponentPropsWithoutRef<Element> &
  VariantProps<typeof cellVariants>;

/** A column header (`scope="col"` by default): meta-sized, medium, muted. */
function TableHead({ className, numeric, scope = 'col', ...props }: CellProps<'th'>) {
  return (
    <th
      scope={scope}
      className={cn(
        cellVariants({ numeric }),
        'text-muted-foreground text-small h-(--row-height) py-1.5 align-bottom font-medium whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}

/** A row header (`scope="row"`): the row's name, such as its date. */
function TableRowHeader({ className, numeric, ...props }: CellProps<'th'>) {
  return (
    <th
      scope="row"
      className={cn(cellVariants({ numeric }), 'h-(--row-height) py-1.5 font-medium', className)}
      {...props}
    />
  );
}

function TableCell({ className, numeric, ...props }: CellProps<'td'>) {
  return (
    <td
      className={cn(cellVariants({ numeric }), 'h-(--row-height) py-1.5', className)}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
  tableRowVariants,
};
