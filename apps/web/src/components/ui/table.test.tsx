import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from './table';

function renderTable({ scrollable = false } = {}) {
  render(
    <TableContainer scrollable={scrollable} aria-label="Hours by week">
      <Table aria-label="Hours by week">
        <TableHeader>
          <TableRow hover={false}>
            <TableHead>Week</TableHead>
            <TableHead numeric>Credited</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow tone="zebra">
            <TableRowHeader>Week of 5 Oct 2026</TableRowHeader>
            <TableCell numeric>40:30</TableCell>
          </TableRow>
          <TableRow tone="highlight" hover={false}>
            <TableRowHeader>Week of 12 Oct 2026</TableRowHeader>
            <TableCell numeric>18:30</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow hover={false}>
            <TableRowHeader>Total</TableRowHeader>
            <TableCell numeric>59:00</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </TableContainer>,
  );
  return screen.getByRole('table', { name: 'Hours by week' });
}

describe('Table', () => {
  it('is a real table with column and row headers', () => {
    const table = renderTable();
    expect(within(table).getByRole('columnheader', { name: 'Week' })).toHaveAttribute(
      'scope',
      'col',
    );
    expect(within(table).getByRole('rowheader', { name: 'Total' })).toHaveAttribute('scope', 'row');
  });

  it('right-aligns numbers in tabular numerals', () => {
    const table = renderTable();
    expect(within(table).getByRole('cell', { name: '40:30' })).toHaveClass(
      'text-right',
      'tabular-nums',
      'whitespace-nowrap',
    );
    expect(within(table).getByRole('columnheader', { name: 'Credited' })).toHaveClass('text-right');
  });

  it('gives rows a zebra stripe, a hover surface, or a highlight with a marker', () => {
    const table = renderTable();
    const [striped, highlighted] = within(table)
      .getAllByRole('row')
      .filter((row) => row.closest('tbody'));
    expect(striped).toHaveClass('even:bg-table-stripe', 'hover:bg-table-hover');
    expect(highlighted).toHaveClass('bg-highlight', 'row-marker');
    expect(highlighted).not.toHaveClass('hover:bg-table-hover');
  });

  it('makes a scrollable container a named, focusable region', () => {
    renderTable({ scrollable: true });
    const region = screen.getByRole('region', { name: 'Hours by week' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveClass('overflow-x-auto');
  });
});
