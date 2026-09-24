import { formatTimeOfDay, parseTimeOfDay } from '@repo/domain';

import { cn } from '@/lib/utils';

/** The hours a week's timelines span, in minutes after midnight. */
export interface TimelineScale {
  from: number;
  to: number;
}

/**
 * The Timeline column's cells: hidden until the week card (`@container`) is
 * 64rem wide (a 1920px window), where the column takes the spare width.
 */
export const TIMELINE_CELL = 'hidden w-full min-w-40 px-3 @5xl:table-cell';

const HOUR = 60;
const DAY = 24 * HOUR;

/**
 * The scale for a week's timelines: the working band, widened to whole hours
 * to take in every typed start and end (an end past midnight reaches 24:00).
 */
export function timelineScale(
  band: { bandStartMinutes: number; bandEndMinutes: number },
  times: readonly { start: string; end: string }[],
): TimelineScale {
  let from = band.bandStartMinutes;
  let to = band.bandEndMinutes;
  for (const { start, end } of times) {
    const s = parseTimeOfDay(start);
    const e = parseTimeOfDay(end);
    if (s === null || e === null) continue;
    from = Math.min(from, s);
    to = Math.max(to, e <= s ? DAY : e);
  }
  return { from: Math.floor(from / HOUR) * HOUR, to: Math.min(DAY, Math.ceil(to / HOUR) * HOUR) };
}

/** A scale's label: "07:00–19:00". */
export function scaleLabel(scale: TimelineScale): string {
  return `${formatTimeOfDay(scale.from)}–${scale.to === DAY ? '24:00' : formatTimeOfDay(scale.to)}`;
}

interface DayTimelineProps {
  /** The typed start and end ("07:30"); nothing is drawn unless both read. */
  start: string;
  end: string;
  scale: TimelineScale;
  /** A day still to come: drawn lighter. */
  upcoming: boolean;
}

/**
 * A day's span drawn to scale on a slim track (the week view's Timeline
 * column). It repeats the Start and End fields as a picture, named for
 * screen readers ("07:30 to 15:30"). The bar's position is the one inline
 * style: a data value, as ProgressBar's width.
 */
export function DayTimeline({ start, end, scale, upcoming }: DayTimelineProps) {
  const s = parseTimeOfDay(start);
  const e = parseTimeOfDay(end);
  const width = scale.to - scale.from;
  if (s === null || e === null || width <= 0) return null;
  const endAt = e <= s ? DAY : e;
  const left = Math.max(0, (s - scale.from) / width);
  const right = Math.min(1, (endAt - scale.from) / width);
  const percent = (value: number) => `${String(Math.round(value * 1000) / 10)}%`;
  return (
    <div
      role="img"
      aria-label={`${formatTimeOfDay(s)} to ${formatTimeOfDay(e)}`}
      className="bg-muted relative h-2.5 w-full rounded-full"
    >
      <div
        className={cn(
          'absolute inset-y-0 rounded-full',
          upcoming ? 'bg-timeline-upcoming' : 'bg-primary',
        )}
        style={{ left: percent(left), width: percent(Math.max(0, right - left)) }}
      />
    </div>
  );
}
