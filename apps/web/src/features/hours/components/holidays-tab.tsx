import { zodResolver } from '@hookform/resolvers/zod';
import { HOURS_YEAR_MAX, HOURS_YEAR_MIN } from '@repo/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { useFocusAfterRemoval } from '../hooks/use-focus-after-removal';
import {
  publicHolidayFormSchema,
  type PublicHolidayFormOutput,
  type PublicHolidayFormValues,
} from '../schemas/settings';

import { actionErrorMessage, LoadError, LoadingRows, SaveErrorAlert } from './request-states';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  useCreatePublicHoliday,
  useDeletePublicHoliday,
  useImportPublicHolidays,
  usePublicHolidays,
  useRestorePublicHoliday,
  type PublicHoliday,
} from '@/features/core/public-holidays';
import { formatDate } from '@/lib/format';

function ImportButton({ year }: { year: number }) {
  const importHolidays = useImportPublicHolidays();
  return (
    <Button
      wrap
      disabled={importHolidays.isPending}
      onClick={() =>
        importHolidays.mutate(year, {
          onSuccess: ({ added }) =>
            toast(
              added.length === 0
                ? {
                    variant: 'info',
                    title: `You already have every England and Wales bank holiday for ${String(year)}`,
                  }
                : {
                    title: `${String(added.length)} bank ${added.length === 1 ? 'holiday' : 'holidays'} added for ${String(year)}`,
                  },
            ),
          onError: (error) =>
            toast({
              variant: 'error',
              title: `We couldn't add the bank holidays for ${String(year)}`,
              description: actionErrorMessage(error, 'Try again in a moment.'),
            }),
        })
      }
    >
      {importHolidays.isPending
        ? 'Adding bank holidays…'
        : `Add England and Wales bank holidays for ${String(year)}`}
    </Button>
  );
}

function AddHolidayForm({ year }: { year: number }) {
  const create = useCreatePublicHoliday();
  const blank: PublicHolidayFormValues = { date: '', name: '' };
  const form = useForm<PublicHolidayFormValues, unknown, PublicHolidayFormOutput>({
    resolver: zodResolver(publicHolidayFormSchema),
    defaultValues: blank,
  });

  const submit = (values: PublicHolidayFormOutput) => {
    create.mutate(values, {
      onSuccess: (saved) => {
        toast({ title: `${saved.name} added` });
        form.reset(blank);
      },
    });
  };

  return (
    <Form {...form}>
      <form
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- RHF handleSubmit returns a promise by design
        onSubmit={form.handleSubmit(submit)}
        noValidate
        aria-labelledby="add-holiday-heading"
        className="grid max-w-(--width-form) grid-cols-1 gap-4"
      >
        <h3 id="add-holiday-heading" className="font-semibold">
          Add a holiday
        </h3>
        {create.isError ? (
          <SaveErrorAlert
            error={create.error}
            conflictMessage="There is already a holiday on that date."
          />
        ) : null}
        <div className="flex flex-wrap items-start gap-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="content-start">
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    className="w-44"
                    min={`${String(year)}-01-01`}
                    max={`${String(year)}-12-31`}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="min-w-0 grow basis-60 content-start">
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoComplete="off" className="max-w-(--width-prose)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div>
          <Button type="submit" variant="outline" disabled={create.isPending}>
            {create.isPending ? 'Adding…' : 'Add holiday'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

interface HolidaysTabProps {
  /** The year shown, from the URL. */
  year: number;
  onYearChange: (year: number) => void;
}

/**
 * Settings → Holidays: one year's public holidays (the year is in the URL),
 * the bundled England and Wales import, a manual add, and delete with undo.
 * Public holidays are a core entity (ADR-0020 §3), imported from
 * `features/core/public-holidays`.
 */
export function HolidaysTab({ year, onYearChange }: HolidaysTabProps) {
  const holidays = usePublicHolidays(year);
  const remove = useDeletePublicHoliday();
  const restore = useRestorePublicHoliday();
  const { listRef, removing } = useFocusAfterRemoval(holidays.data);

  const deleteHoliday = (row: PublicHoliday) => {
    removing(row.id);
    remove.mutate(row.id, {
      onSuccess: () =>
        toast({
          title: `${row.name} deleted`,
          action: {
            label: 'Undo',
            altText: `Undo deleting ${row.name}`,
            onAction: () =>
              restore.mutate(row.id, {
                onSuccess: () => toast({ title: `${row.name} restored` }),
                onError: (error) =>
                  toast({
                    variant: 'error',
                    title: `We couldn't restore ${row.name}`,
                    description: actionErrorMessage(error, 'Try again in a moment.'),
                  }),
              }),
          },
        }),
      onError: (error) =>
        toast({
          variant: 'error',
          title: `We couldn't delete ${row.name}`,
          description: actionErrorMessage(error, 'Try again in a moment.'),
        }),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-8">
      <section aria-labelledby="holidays-heading" className="grid grid-cols-1 gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous year"
              disabled={year <= HOURS_YEAR_MIN}
              onClick={() => onYearChange(year - 1)}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <h2 id="holidays-heading" className="text-lg font-semibold">
              Holidays in {year}
            </h2>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next year"
              disabled={year >= HOURS_YEAR_MAX}
              onClick={() => onYearChange(year + 1)}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
          <ImportButton year={year} />
        </div>
        <p className="text-muted-foreground max-w-(--width-prose) text-sm">
          A holiday on a working day credits the most leave in a day and counts against your leave
          allowance.
        </p>
        {holidays.isPending ? (
          <LoadingRows label={`Loading the holidays in ${String(year)}`} rows={8} />
        ) : holidays.isError ? (
          <LoadError
            message={`We couldn't load the holidays in ${String(year)}.`}
            onRetry={() => void holidays.refetch()}
          />
        ) : (
          <div ref={listRef} tabIndex={-1} className="outline-none">
            {holidays.data.length === 0 ? (
              <p className="text-sm">No holidays in {year} yet.</p>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full max-w-(--width-form) text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th scope="col" className="py-2 pr-4 font-medium">
                        Date
                      </th>
                      <th scope="col" className="py-2 pr-4 font-medium">
                        Name
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.data.map((row) => (
                      <tr key={row.id} data-row-id={row.id} className="border-b">
                        <th scope="row" className="py-2 pr-4 text-left font-normal tabular-nums">
                          {formatDate(row.date)}
                        </th>
                        <td className="py-2 pr-4">{row.name}</td>
                        <td className="py-2 text-right">
                          <Button variant="outline" size="sm" onClick={() => deleteHoliday(row)}>
                            Delete <span className="sr-only">{row.name}</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
      <AddHolidayForm key={year} year={year} />
    </div>
  );
}
