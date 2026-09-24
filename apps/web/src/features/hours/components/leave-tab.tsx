import { zodResolver } from '@hookform/resolvers/zod';
import {
  BOUGHT_LEAVE_MINUTES,
  DEFAULT_LEAVE_ALLOWANCE_MINUTES,
  formatDuration,
  londonDateAt,
  yearOf,
} from '@repo/domain';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import type { LeaveYear } from '../api/keys';
import { useCreateLeaveYear, useLeaveYears, useUpdateLeaveYear } from '../api/leave-years';
import { useTimeBalances } from '../api/time-balances';
import {
  leaveAllowanceFormSchema,
  leaveYearFormSchema,
  type LeaveAllowanceFormOutput,
  type LeaveAllowanceFormValues,
  type LeaveYearFormOutput,
  type LeaveYearFormValues,
} from '../schemas/settings';

import { DurationInput } from './duration-input';
import { LoadError, LoadingRows, SaveErrorAlert, toastSaveError } from './request-states';
import { SectionCard } from './section-card';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

/** A year's allowance, edited in its row with its own Save (an explicit save). */
function AllowanceForm({ year, onReload }: { year: LeaveYear; onReload: () => void }) {
  const update = useUpdateLeaveYear();
  const form = useForm<LeaveAllowanceFormValues, unknown, LeaveAllowanceFormOutput>({
    resolver: zodResolver(leaveAllowanceFormSchema),
    defaultValues: { allowanceMinutes: formatDuration(year.allowanceMinutes) },
  });

  const submit = ({ allowanceMinutes }: LeaveAllowanceFormOutput) => {
    update.mutate(
      { row: year, allowanceMinutes },
      {
        onSuccess: (saved) => {
          form.reset({ allowanceMinutes: formatDuration(saved.allowanceMinutes) });
          toast({ title: `Allowance for ${String(saved.year)} saved` });
        },
        onError: (error) =>
          toastSaveError(
            `We couldn't save the allowance for ${String(year.year)}`,
            error,
            onReload,
          ),
      },
    );
  };

  return (
    <Form {...form}>
      <form
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- RHF handleSubmit returns a promise by design
        onSubmit={form.handleSubmit(submit)}
        noValidate
        className="flex flex-wrap items-start gap-2"
      >
        <FormField
          control={form.control}
          name="allowanceMinutes"
          render={({ field }) => (
            <FormItem className="gap-1">
              <FormLabel className="sr-only">Allowance for {year.year}</FormLabel>
              <FormControl>
                <DurationInput
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  hintVisibility="sr-only"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="outline" isPending={update.isPending}>
          Save <span className="sr-only">allowance for {year.year}</span>
        </Button>
      </form>
    </Form>
  );
}

/**
 * Bought leave saves as soon as it is switched (a single, reversible toggle),
 * with a quiet "Saved" beside it (docs/UX_STANDARDS.md → Forms).
 */
function BoughtLeaveSwitch({ year, onReload }: { year: LeaveYear; onReload: () => void }) {
  const update = useUpdateLeaveYear();
  const [status, setStatus] = React.useState('');
  return (
    <div className="flex items-center gap-2">
      <Switch
        aria-label={`Bought leave for ${String(year.year)}`}
        checked={
          update.isPending ? (update.variables.boughtLeave ?? year.boughtLeave) : year.boughtLeave
        }
        disabled={update.isPending}
        onCheckedChange={(boughtLeave) => {
          setStatus('');
          update.mutate(
            { row: year, boughtLeave },
            {
              onSuccess: () => setStatus('Saved'),
              onError: (error) =>
                toastSaveError(
                  `We couldn't change bought leave for ${String(year.year)}`,
                  error,
                  onReload,
                ),
            },
          );
        }}
      />
      <span role="status" className="text-muted-foreground text-meta">
        {status}
      </span>
    </div>
  );
}

/** The next year to offer: this year if it is missing, otherwise the year after the latest. */
function suggestedYear(years: LeaveYear[], thisYear: number): number {
  if (!years.some((row) => row.year === thisYear)) return thisYear;
  return Math.max(...years.map((row) => row.year)) + 1;
}

function AddLeaveYearForm({ defaultYear }: { defaultYear: number }) {
  const create = useCreateLeaveYear();
  const blank: LeaveYearFormValues = {
    year: String(defaultYear),
    allowanceMinutes: formatDuration(DEFAULT_LEAVE_ALLOWANCE_MINUTES),
    boughtLeave: false,
  };
  const form = useForm<LeaveYearFormValues, unknown, LeaveYearFormOutput>({
    resolver: zodResolver(leaveYearFormSchema),
    defaultValues: blank,
  });

  const submit = (values: LeaveYearFormOutput) => {
    create.mutate(values, {
      onSuccess: (saved) => {
        toast({ title: `Leave year ${String(saved.year)} added` });
        form.reset({ ...blank, year: String(saved.year + 1) });
      },
    });
  };

  return (
    <Form {...form}>
      <form
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- RHF handleSubmit returns a promise by design
        onSubmit={form.handleSubmit(submit)}
        noValidate
        aria-labelledby="add-leave-year-heading"
        className="bg-card grid grid-cols-1 gap-4 rounded-xl border p-4 shadow-xs"
      >
        <h3 id="add-leave-year-heading" className="text-h3">
          Add a leave year
        </h3>
        {create.isError ? (
          <SaveErrorAlert
            error={create.error}
            conflictMessage="That year is already set up. Change it in the table above."
          />
        ) : null}
        <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem className="content-start">
                <FormLabel>Year</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    autoComplete="off"
                    className="w-(--width-input-short)"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="allowanceMinutes"
            render={({ field }) => (
              <FormItem className="content-start">
                <FormLabel>Allowance</FormLabel>
                <FormControl>
                  <DurationInput
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="boughtLeave"
            render={({ field }) => (
              <FormItem className="content-start">
                <FormLabel>Bought leave</FormLabel>
                <FormControl>
                  <Switch
                    ref={field.ref}
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </FormControl>
                <FormDescription>Adds {formatDuration(BOUGHT_LEAVE_MINUTES)}.</FormDescription>
              </FormItem>
            )}
          />
        </div>
        <div>
          <Button type="submit" isPending={create.isPending}>
            Add leave year
          </Button>
        </div>
      </form>
    </Form>
  );
}

/**
 * A year's used and remaining leave, from the balances as of its last day
 * (rule 12 counts booked leave, so the whole year is in). Before any terms
 * exist nothing is tracked, so it shows "—".
 */
function LeaveUsage({ year }: { year: number }) {
  const balances = useTimeBalances(`${year}-12-31`);
  if (balances.isPending) {
    const pending = (
      <span aria-busy="true">
        <span aria-hidden>…</span>
        <span className="sr-only">Loading</span>
      </span>
    );
    return (
      <>
        <TableCell numeric>{pending}</TableCell>
        <TableCell numeric>{pending}</TableCell>
      </>
    );
  }
  const data = balances.data;
  const tracked = data !== undefined && data.trackingStart !== null;
  return (
    <>
      <TableCell numeric>{tracked ? formatDuration(data.leaveUsedMinutes) : '—'}</TableCell>
      <TableCell
        numeric
        className={tracked && data.leaveRemainingMinutes < 0 ? 'text-warning-text' : undefined}
      >
        {tracked ? formatDuration(data.leaveRemainingMinutes) : '—'}
      </TableCell>
    </>
  );
}

/**
 * Settings → Leave: a row per year with its allowance, the bought-leave toggle,
 * the year's total, and used and remaining hours from the balances API.
 */
export function LeaveTab() {
  const years = useLeaveYears();
  const [thisYear] = React.useState(() => yearOf(londonDateAt(new Date())));

  if (years.isPending) return <LoadingRows label="Loading your leave years" rows={3} />;
  if (years.isError) {
    return (
      <LoadError
        message="We couldn't load your leave years."
        onRetry={() => void years.refetch()}
      />
    );
  }

  const rows = years.data;
  const reload = () => void years.refetch();
  const notesId = 'leave-used-note';

  return (
    <div className="grid grid-cols-1 gap-6">
      <SectionCard
        headingId="leave-years-heading"
        title="Leave years"
        description="Leave years run from 1 January to 31 December. The allowance includes bank holidays."
        flush={rows.length > 0}
      >
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-small">
            No leave years yet. Add this year to track your allowance.
          </p>
        ) : (
          <>
            <TableContainer>
              <Table aria-describedby={notesId}>
                <TableHeader>
                  <TableRow hover={false}>
                    <TableHead>Year</TableHead>
                    <TableHead>Allowance</TableHead>
                    <TableHead>Bought leave</TableHead>
                    <TableHead numeric>Total</TableHead>
                    <TableHead numeric>Used</TableHead>
                    <TableHead numeric>Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} tone="zebra">
                      <TableRowHeader className="tabular-nums">{row.year}</TableRowHeader>
                      <TableCell>
                        <AllowanceForm key={row.version} year={row} onReload={reload} />
                      </TableCell>
                      <TableCell>
                        <BoughtLeaveSwitch year={row} onReload={reload} />
                      </TableCell>
                      <TableCell numeric>
                        {formatDuration(
                          row.allowanceMinutes + (row.boughtLeave ? BOUGHT_LEAVE_MINUTES : 0),
                        )}
                      </TableCell>
                      <LeaveUsage year={row.year} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <p id={notesId} className="text-muted-foreground text-small border-t px-4 py-3">
              Used counts leave you have booked for the year, bank holidays and leave adjustments.
              Remaining can go below zero.
            </p>
          </>
        )}
      </SectionCard>
      <AddLeaveYearForm key={rows.length} defaultYear={suggestedYear(rows, thisYear)} />
    </div>
  );
}
