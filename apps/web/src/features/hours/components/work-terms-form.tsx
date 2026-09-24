import { zodResolver } from '@hookform/resolvers/zod';
import { WEEKDAYS, type Weekday } from '@repo/types';
import * as React from 'react';
import { useForm, type Control } from 'react-hook-form';

import {
  workTermsFormSchema,
  type WorkTermsFormOutput,
  type WorkTermsFormValues,
} from '../schemas/settings';

import { DurationInput } from './duration-input';
import { TimeInput } from './time-input';

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

const DAY_NAMES: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

interface WorkTermsFormProps {
  defaultValues: WorkTermsFormValues;
  /** Editing saved terms: their Monday cannot change (add new terms instead). */
  mode: 'create' | 'edit';
  isPending: boolean;
  /** A save error, shown in an alert at the top of the form. */
  errorAlert?: React.ReactNode;
  onSubmit: (values: WorkTermsFormOutput) => void;
  onCancel: () => void;
}

type TermsControl = Control<WorkTermsFormValues, unknown, WorkTermsFormOutput>;

/** A duration field with a visible label, its format hint and its error. */
function DurationField({
  control,
  name,
  label,
  description,
}: {
  control: TermsControl;
  name:
    | 'breakThresholdMinutes'
    | 'breakMinimumMinutes'
    | 'toilMonthlyCapMinutes'
    | 'conversionBlockMinutes'
    | 'leaveDayMaxMinutes'
    | 'flexiCreditCapMinutes'
    | 'flexiDebitCapMinutes';
  label: string;
  description?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="w-64 max-w-full content-start">
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <DurationInput
              ref={field.ref}
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
            />
          </FormControl>
          {/* Under the input with its format hint, so the group's inputs line up. */}
          {description ? (
            <FormDescription className="text-meta">{description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** One weekday's target or minimum, in the grid (labelled for screen readers). */
function WeekdayField({
  control,
  day,
  column,
}: {
  control: TermsControl;
  day: Weekday;
  column: 'targetMinutes' | 'minimumMinutes';
}) {
  return (
    <FormField
      control={control}
      name={`${column}.${day}`}
      render={({ field }) => (
        <FormItem className="gap-1">
          <FormLabel className="sr-only">
            {DAY_NAMES[day]} {column === 'targetMinutes' ? 'flexi target' : 'minimum'}
          </FormLabel>
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
  );
}

/**
 * The work terms form (feature doc → UI → Settings → Terms): an explicit-save
 * form with Cancel. The per-weekday grid has two columns, Flexi target (counts
 * towards flexi) and Minimum (warning only); clearing a target makes the day
 * non-working. Durations are typed and shown as `h:mm`.
 */
export function WorkTermsForm({
  defaultValues,
  mode,
  isPending,
  errorAlert,
  onSubmit,
  onCancel,
}: WorkTermsFormProps) {
  const form = useForm<WorkTermsFormValues, unknown, WorkTermsFormOutput>({
    resolver: zodResolver(workTermsFormSchema),
    defaultValues,
  });
  const gridHintId = React.useId();

  // Unsaved edits survive a reload only if the owner chooses; the browser asks
  // before leaving the page (in-app navigation guarding waits for AlertDialog).
  const { isDirty } = form.formState;
  React.useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  return (
    <Form {...form}>
      <form
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- RHF handleSubmit returns a promise by design
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid max-w-(--width-form) grid-cols-1 gap-6"
        noValidate
        aria-label={mode === 'create' ? 'New terms' : 'Edit terms'}
      >
        {errorAlert}
        <FormField
          control={form.control}
          name="effectiveFrom"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Applies from</FormLabel>
              <FormDescription>
                {mode === 'create'
                  ? 'A Monday. Weeks before it keep the terms they had.'
                  : 'To change the date, add new terms from that Monday instead.'}
              </FormDescription>
              <FormControl>
                <Input
                  type="date"
                  className="w-(--width-input-date)"
                  readOnly={mode === 'edit'}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <fieldset className="grid grid-cols-1 gap-2">
          <legend className="text-body mb-1 font-semibold">Working week</legend>
          <p id={gridHintId} className="text-muted-foreground text-small">
            Hours and minutes, e.g. 7:30. Clear a flexi target to make the day non-working.
          </p>
          <div className="relative overflow-x-auto">
            <table className="text-sm" aria-describedby={gridHintId}>
              <thead>
                <tr className="text-left">
                  <th
                    scope="col"
                    className="text-muted-foreground text-small py-1 pr-4 font-medium"
                  >
                    Day
                  </th>
                  <th scope="col" className="text-small py-1 pr-4 font-medium">
                    Flexi target
                    <span className="text-muted-foreground text-meta block font-normal">
                      counts towards flexi
                    </span>
                  </th>
                  <th scope="col" className="text-small py-1 font-medium">
                    Minimum
                    <span className="text-muted-foreground text-meta block font-normal">
                      warning only
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map((day) => (
                  <tr key={day} className="align-top">
                    <th scope="row" className="py-1 pr-4 text-left font-normal">
                      <span className="inline-flex h-(--control-md) items-center">
                        {DAY_NAMES[day]}
                      </span>
                    </th>
                    <td className="py-1 pr-4">
                      <WeekdayField control={form.control} day={day} column="targetMinutes" />
                    </td>
                    <td className="py-1">
                      <WeekdayField control={form.control} day={day} column="minimumMinutes" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3">
          <legend className="text-body mb-1 font-semibold">Breaks</legend>
          <p className="text-muted-foreground text-small">
            A day longer than the threshold has at least the minimum break deducted.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-4">
            <DurationField control={form.control} name="breakThresholdMinutes" label="Threshold" />
            <DurationField
              control={form.control}
              name="breakMinimumMinutes"
              label="Minimum break"
            />
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3">
          <legend className="text-body mb-1 font-semibold">Working band</legend>
          <p className="text-muted-foreground text-small">
            Time before the start or after the end raises a warning.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-4">
            {(['bandStart', 'bandEnd'] as const).map((name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem className="content-start">
                    <FormLabel>{name === 'bandStart' ? 'Starts' : 'Ends'}</FormLabel>
                    <FormControl>
                      <TimeInput
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
            ))}
          </div>
        </fieldset>

        <FormField
          control={form.control}
          name="paidOvertimeAllowed"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-3">
                <FormControl>
                  <Switch
                    ref={field.ref}
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </FormControl>
                <FormLabel>Paid overtime allowed</FormLabel>
              </div>
              <FormDescription>When off, all overtime is recorded as unpaid.</FormDescription>
            </FormItem>
          )}
        />

        <fieldset className="grid grid-cols-1 gap-3">
          <legend className="text-body mb-1 font-semibold">Limits</legend>
          <p className="text-muted-foreground text-small">
            TOIL over the monthly cap becomes overtime. A flexi balance past a cap raises a warning;
            nothing is forfeited unless you confirm it.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-4">
            <DurationField
              control={form.control}
              name="toilMonthlyCapMinutes"
              label="TOIL cap a month"
            />
            <DurationField
              control={form.control}
              name="conversionBlockMinutes"
              label="Conversion block"
              description="Conversion turns whole blocks into TOIL and overtime; the rest stays as flexi. Default 0:30."
            />
            <DurationField
              control={form.control}
              name="leaveDayMaxMinutes"
              label="Most leave in a day"
            />
            <DurationField
              control={form.control}
              name="flexiCreditCapMinutes"
              label="Flexi credit cap"
              description="Leave empty for no cap."
            />
            <DurationField
              control={form.control}
              name="flexiDebitCapMinutes"
              label="Flexi debit cap"
              description="Leave empty for no cap."
            />
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" isPending={isPending}>
            {mode === 'create' ? 'Save new terms' : 'Save changes'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
