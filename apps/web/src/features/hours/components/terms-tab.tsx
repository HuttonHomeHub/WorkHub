import { addDays, formatDuration, londonDateAt, weekStartOf } from '@repo/domain';
import { WEEKDAYS } from '@repo/types';
import * as React from 'react';

import type { WorkTerm } from '../api/keys';
import {
  useCreateWorkTerm,
  useDeleteWorkTerm,
  useRestoreWorkTerm,
  useUpdateWorkTerm,
  useWorkTerms,
} from '../api/work-terms';
import { useFocusAfterRemoval } from '../hooks/use-focus-after-removal';
import { workTermsFormValues, type WorkTermsFormOutput } from '../schemas/settings';

import { actionErrorMessage, LoadError, LoadingRows, SaveErrorAlert } from './request-states';
import { WorkTermsForm } from './work-terms-form';

import { Button } from '@/components/ui/button';
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
import { formatDate } from '@/lib/format';

/** The Monday new terms default to: next week's, or this week's for the first terms. */
function defaultMonday(hasTerms: boolean): string {
  const thisMonday = weekStartOf(londonDateAt(new Date()));
  return hasTerms ? addDays(thisMonday, 7) : thisMonday;
}

function weeklyTarget(terms: WorkTerm): number {
  return WEEKDAYS.reduce((sum, day) => sum + (terms.targetMinutes[day] ?? 0), 0);
}

/**
 * Settings → Terms: the form for new terms (or for editing the latest), and
 * every saved set of terms, latest first, each deletable with undo.
 */
export function TermsTab() {
  const terms = useWorkTerms();
  const create = useCreateWorkTerm();
  const update = useUpdateWorkTerm();
  const remove = useDeleteWorkTerm();
  const restore = useRestoreWorkTerm();
  const { listRef, removing } = useFocusAfterRemoval(terms.data);
  // The terms being edited, or null for new terms. A fresh `formKey` resets the form.
  const [editing, setEditing] = React.useState<WorkTerm | null>(null);
  const [formKey, setFormKey] = React.useState(0);

  const resetForm = React.useCallback(() => {
    setEditing(null);
    create.reset();
    update.reset();
    setFormKey((key) => key + 1);
  }, [create, update]);

  if (terms.isPending) return <LoadingRows label="Loading your terms" rows={8} />;
  if (terms.isError) {
    return (
      <LoadError message="We couldn't load your terms." onRetry={() => void terms.refetch()} />
    );
  }

  const rows = terms.data;
  const latest = rows[0] ?? null;

  const submit = (values: WorkTermsFormOutput) => {
    if (editing) {
      const { effectiveFrom: _unchanged, ...changes } = values;
      update.mutate(
        { id: editing.id, body: { ...changes, version: editing.version } },
        {
          onSuccess: () => {
            toast({ title: 'Terms updated' });
            resetForm();
          },
        },
      );
    } else {
      create.mutate(values, {
        onSuccess: (saved) => {
          toast({ title: `Terms from ${formatDate(saved.effectiveFrom)} saved` });
          resetForm();
        },
      });
    }
  };

  const deleteTerms = (row: WorkTerm) => {
    removing(row.id);
    if (editing?.id === row.id) resetForm();
    remove.mutate(row.id, {
      onSuccess: () => {
        toast({
          title: `Terms from ${formatDate(row.effectiveFrom)} deleted`,
          action: {
            label: 'Undo',
            altText: 'Undo deleting these terms',
            onAction: () =>
              restore.mutate(row.id, {
                onSuccess: () => toast({ title: 'Terms restored' }),
                onError: (error) =>
                  toast({
                    variant: 'error',
                    title: "We couldn't restore the terms",
                    description: actionErrorMessage(error, 'Try again in a moment.'),
                  }),
              }),
          },
        });
      },
      onError: (error) =>
        toast({
          variant: 'error',
          title: "We couldn't delete the terms",
          description: actionErrorMessage(error, 'Try again in a moment.'),
        }),
    });
  };

  const mutation = editing ? update : create;
  const formDefaults = editing
    ? workTermsFormValues(editing.effectiveFrom, editing)
    : workTermsFormValues(defaultMonday(latest !== null), latest);

  return (
    <div className="grid grid-cols-1 gap-6">
      <section
        aria-labelledby="terms-form-heading"
        className="bg-card grid grid-cols-1 gap-5 rounded-xl border p-4 shadow-xs"
      >
        <div className="grid grid-cols-1 gap-1">
          <h2 id="terms-form-heading" className="text-h3">
            {editing ? `Edit terms from ${formatDate(editing.effectiveFrom)}` : 'New terms'}
          </h2>
          {latest === null ? (
            <p className="text-muted-foreground text-small">
              Set your working terms to start tracking hours. The first terms&apos; Monday is when
              tracking starts.
            </p>
          ) : null}
        </div>
        <WorkTermsForm
          key={`${editing?.id ?? 'new'}-${String(formKey)}`}
          mode={editing ? 'edit' : 'create'}
          defaultValues={formDefaults}
          isPending={mutation.isPending}
          errorAlert={
            mutation.isError ? (
              <SaveErrorAlert
                error={mutation.error}
                conflictMessage={
                  editing
                    ? 'These terms were changed somewhere else. Reload the latest, then make your change again.'
                    : 'Terms already start on that Monday. Edit them, or choose another Monday.'
                }
                {...(editing
                  ? {
                      onReload: () => {
                        void terms.refetch().then(({ data }) => {
                          const fresh = data?.find((row) => row.id === editing.id) ?? null;
                          update.reset();
                          setEditing(fresh);
                          setFormKey((key) => key + 1);
                        });
                      },
                    }
                  : {})}
              />
            ) : null
          }
          onSubmit={submit}
          onCancel={resetForm}
        />
      </section>

      <section
        aria-labelledby="terms-list-heading"
        className="bg-card grid grid-cols-1 overflow-hidden rounded-xl border shadow-xs"
      >
        <h2 id="terms-list-heading" className="text-h3 p-4">
          Saved terms
        </h2>
        <div ref={listRef} tabIndex={-1} className="border-t outline-none">
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-small p-4">No terms saved yet.</p>
          ) : (
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow hover={false}>
                    <TableHead>Applies from</TableHead>
                    <TableHead numeric>Weekly target</TableHead>
                    <TableHead>Paid overtime</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} data-row-id={row.id} tone="zebra">
                      <TableRowHeader className="font-normal">
                        {formatDate(row.effectiveFrom)}
                        {row === latest ? (
                          <span className="text-muted-foreground"> (current)</span>
                        ) : null}
                      </TableRowHeader>
                      <TableCell numeric>{formatDuration(weeklyTarget(row))}</TableCell>
                      <TableCell>{row.paidOvertimeAllowed ? 'Allowed' : 'Not allowed'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          {row === latest ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                create.reset();
                                update.reset();
                                setEditing(row);
                              }}
                            >
                              Edit{' '}
                              <span className="sr-only">
                                terms from {formatDate(row.effectiveFrom)}
                              </span>
                            </Button>
                          ) : null}
                          <Button variant="outline" size="sm" onClick={() => deleteTerms(row)}>
                            Delete{' '}
                            <span className="sr-only">
                              terms from {formatDate(row.effectiveFrom)}
                            </span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </div>
      </section>
    </div>
  );
}
