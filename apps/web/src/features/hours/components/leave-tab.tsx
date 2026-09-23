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
        <Button type="submit" variant="outline" disabled={update.isPending}>
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
      <span role="status" className="text-muted-foreground text-xs">
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
        className="grid max-w-(--width-form) grid-cols-1 gap-4"
      >
        <h3 id="add-leave-year-heading" className="font-semibold">
          Add a leave year
        </h3>
        {create.isError ? (
          <SaveErrorAlert
            error={create.error}
            conflictMessage="That year is already set up. Change it in the table above."
          />
        ) : null}
        <div className="flex flex-wrap items-start gap-4">
          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem className="content-start">
                <FormLabel>Year</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" autoComplete="off" className="w-24" {...field} />
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
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Adding…' : 'Add leave year'}
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
  const cell = (value: string) => <span className="inline-flex h-9 items-center">{value}</span>;
  if (balances.isPending) {
    return (
      <>
        <td className="py-2 pr-4 text-right">{cell('…')}</td>
        <td className="py-2 text-right">{cell('…')}</td>
      </>
    );
  }
  const data = balances.data;
  const tracked = data !== undefined && data.trackingStart !== null;
  return (
    <>
      <td className="py-2 pr-4 text-right tabular-nums">
        {cell(tracked ? formatDuration(data.leaveUsedMinutes) : '—')}
      </td>
      <td className="py-2 text-right tabular-nums">
        {cell(tracked ? formatDuration(data.leaveRemainingMinutes) : '—')}
      </td>
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
    <div className="grid grid-cols-1 gap-8">
      <section aria-labelledby="leave-years-heading" className="grid grid-cols-1 gap-3">
        <h2 id="leave-years-heading" className="text-lg font-semibold">
          Leave years
        </h2>
        <p className="text-muted-foreground max-w-(--width-prose) text-sm">
          Leave years run from 1 January to 31 December. The allowance includes bank holidays.
        </p>
        {rows.length === 0 ? (
          <p className="text-sm">No leave years yet. Add this year to track your allowance.</p>
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full max-w-(--width-form) text-sm" aria-describedby={notesId}>
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Year
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Allowance
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Bought leave
                    </th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">
                      Total
                    </th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">
                      Used
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Remaining
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b align-top">
                      <th scope="row" className="py-2 pr-4 text-left font-normal">
                        <span className="inline-flex h-9 items-center">{row.year}</span>
                      </th>
                      <td className="py-2 pr-4">
                        <AllowanceForm key={row.version} year={row} onReload={reload} />
                      </td>
                      <td className="py-2 pr-4">
                        <span className="inline-flex h-9 items-center">
                          <BoughtLeaveSwitch year={row} onReload={reload} />
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        <span className="inline-flex h-9 items-center">
                          {formatDuration(
                            row.allowanceMinutes + (row.boughtLeave ? BOUGHT_LEAVE_MINUTES : 0),
                          )}
                        </span>
                      </td>
                      <LeaveUsage year={row.year} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p id={notesId} className="text-muted-foreground max-w-(--width-prose) text-sm">
              Used counts leave you have booked for the year, bank holidays and leave adjustments.
              Remaining can go below zero.
            </p>
          </>
        )}
      </section>
      <AddLeaveYearForm key={rows.length} defaultYear={suggestedYear(rows, thisYear)} />
    </div>
  );
}
