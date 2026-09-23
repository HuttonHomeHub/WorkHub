import { zodResolver } from '@hookform/resolvers/zod';
import { formatSignedDuration, londonDateAt } from '@repo/domain';
import type { TimeAdjustmentBalance, TimeAdjustmentReason } from '@repo/types';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import type { TimeAdjustment } from '../api/keys';
import {
  useCreateTimeAdjustment,
  useDeleteTimeAdjustment,
  useRestoreTimeAdjustment,
  useTimeAdjustments,
} from '../api/time-adjustments';
import { useWorkTerms } from '../api/work-terms';
import { useFocusAfterRemoval } from '../hooks/use-focus-after-removal';
import {
  timeAdjustmentFormSchema,
  type TimeAdjustmentFormOutput,
  type TimeAdjustmentFormValues,
} from '../schemas/settings';

import { DurationInput } from './duration-input';
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
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from '@/components/ui/toast';
import { formatDate } from '@/lib/format';

export const BALANCE_LABELS: Record<TimeAdjustmentBalance, string> = {
  FLEXI: 'Flexi',
  TOIL: 'TOIL',
  LEAVE: 'Leave',
};

export const REASON_LABELS: Record<TimeAdjustmentReason, string> = {
  OPENING_BALANCE: 'Opening balance',
  FORFEIT: 'Confirmed forfeit',
  CORRECTION: 'Correction',
};

function AddAdjustmentForm({ defaultDate }: { defaultDate: string }) {
  const create = useCreateTimeAdjustment();
  const blank: TimeAdjustmentFormValues = {
    effectiveDate: defaultDate,
    balance: 'FLEXI',
    reason: 'OPENING_BALANCE',
    minutes: '',
  };
  const form = useForm<TimeAdjustmentFormValues, unknown, TimeAdjustmentFormOutput>({
    resolver: zodResolver(timeAdjustmentFormSchema),
    defaultValues: blank,
  });

  const submit = (values: TimeAdjustmentFormOutput) => {
    create.mutate(values, {
      onSuccess: (saved) => {
        toast({
          title: `${BALANCE_LABELS[saved.balance]} adjustment of ${formatSignedDuration(saved.minutes)} added`,
        });
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
        aria-labelledby="add-adjustment-heading"
        className="grid max-w-(--width-form) grid-cols-1 gap-4"
      >
        <h3 id="add-adjustment-heading" className="font-semibold">
          Add an adjustment
        </h3>
        {create.isError ? (
          <SaveErrorAlert
            error={create.error}
            conflictMessage="That adjustment could not be added. Reload the page and try again."
          />
        ) : null}
        <div className="flex flex-wrap items-start gap-4">
          <FormField
            control={form.control}
            name="effectiveDate"
            render={({ field }) => (
              <FormItem className="content-start">
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" className="w-44" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="balance"
            render={({ field }) => (
              <FormItem className="content-start">
                <FormLabel>Balance</FormLabel>
                <FormControl>
                  <NativeSelect className="w-36" {...field}>
                    {Object.entries(BALANCE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem className="content-start">
                <FormLabel>Reason</FormLabel>
                <FormControl>
                  <NativeSelect className="w-44" {...field}>
                    {Object.entries(REASON_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="minutes"
            render={({ field }) => (
              <FormItem className="content-start">
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <DurationInput
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    signed
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <p className="text-muted-foreground max-w-(--width-prose) text-sm">
          For flexi and TOIL, a positive amount is time in credit. For leave, a positive amount adds
          to the leave remaining; use a negative one for leave taken before tracking started.
        </p>
        <div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Adding…' : 'Add adjustment'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/**
 * Settings → Balances: opening flexi, TOIL and leave balances (dated on the
 * tracking start), confirmed forfeits and corrections, each deletable with undo.
 */
export function BalancesTab() {
  const adjustments = useTimeAdjustments();
  const terms = useWorkTerms();
  const remove = useDeleteTimeAdjustment();
  const restore = useRestoreTimeAdjustment();
  const { listRef, removing } = useFocusAfterRemoval(adjustments.data);
  const [today] = React.useState(() => londonDateAt(new Date()));

  if (adjustments.isPending) return <LoadingRows label="Loading your adjustments" rows={3} />;
  if (adjustments.isError) {
    return (
      <LoadError
        message="We couldn't load your adjustments."
        onRetry={() => void adjustments.refetch()}
      />
    );
  }

  // The tracking start is the earliest terms' Monday (terms are listed latest first).
  const trackingStart = terms.data?.at(-1)?.effectiveFrom ?? null;
  const rows = adjustments.data;

  const deleteAdjustment = (row: TimeAdjustment) => {
    removing(row.id);
    const what = `${BALANCE_LABELS[row.balance]} ${REASON_LABELS[row.reason].toLowerCase()}`;
    remove.mutate(row.id, {
      onSuccess: () =>
        toast({
          title: `${what} deleted`,
          action: {
            label: 'Undo',
            altText: 'Undo deleting this adjustment',
            onAction: () =>
              restore.mutate(row.id, {
                onSuccess: () => toast({ title: `${what} restored` }),
                onError: (error) =>
                  toast({
                    variant: 'error',
                    title: "We couldn't restore the adjustment",
                    description: actionErrorMessage(error, 'Try again in a moment.'),
                  }),
              }),
          },
        }),
      onError: (error) =>
        toast({
          variant: 'error',
          title: "We couldn't delete the adjustment",
          description: actionErrorMessage(error, 'Try again in a moment.'),
        }),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-8">
      <section aria-labelledby="adjustments-heading" className="grid grid-cols-1 gap-3">
        <h2 id="adjustments-heading" className="text-lg font-semibold">
          Balance adjustments
        </h2>
        <p className="text-muted-foreground max-w-(--width-prose) text-sm">
          {trackingStart
            ? `Date opening balances on your tracking start, ${formatDate(trackingStart)}. `
            : 'Date opening balances on your tracking start, the Monday of your first terms. '}
          Record a flexi forfeit here once you have confirmed it.
        </p>
        <div ref={listRef} tabIndex={-1} className="outline-none">
          {rows.length === 0 ? (
            <p className="text-sm">No adjustments yet.</p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full max-w-(--width-form) text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Date
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Balance
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Reason
                    </th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">
                      Amount
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} data-row-id={row.id} className="border-b">
                      <th scope="row" className="py-2 pr-4 text-left font-normal">
                        {formatDate(row.effectiveDate)}
                      </th>
                      <td className="py-2 pr-4">{BALANCE_LABELS[row.balance]}</td>
                      <td className="py-2 pr-4">{REASON_LABELS[row.reason]}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatSignedDuration(row.minutes)}
                      </td>
                      <td className="py-2 text-right">
                        <Button variant="outline" size="sm" onClick={() => deleteAdjustment(row)}>
                          Delete{' '}
                          <span className="sr-only">
                            {BALANCE_LABELS[row.balance]} adjustment of{' '}
                            {formatSignedDuration(row.minutes)} on {formatDate(row.effectiveDate)}
                          </span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      <AddAdjustmentForm key={trackingStart ?? today} defaultDate={trackingStart ?? today} />
    </div>
  );
}
