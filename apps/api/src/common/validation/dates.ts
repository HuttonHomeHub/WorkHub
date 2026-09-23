import { isHoursDate, isMonday, TIME_OF_DAY_PATTERN } from '@repo/types';
import { ValidateBy, type ValidationOptions } from 'class-validator';

/**
 * Validators for calendar dates and times of day on the wire (docs/API.md →
 * Dates, money and other values). The rules live in `@repo/types`, so the web
 * forms apply the same ones (ADR-0017).
 */

/** A real `YYYY-MM-DD` date in 2000–2100. */
export function IsHoursDate(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isHoursDate',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isHoursDate(value),
        defaultMessage: (args) =>
          `${args?.property ?? 'value'} must be a date (YYYY-MM-DD) in 2000–2100`,
      },
    },
    options,
  );
}

/** A `YYYY-MM-DD` date that is a Monday. */
export function IsMondayDate(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isMondayDate',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isMonday(value),
        defaultMessage: (args) => `${args?.property ?? 'value'} must be a Monday (YYYY-MM-DD)`,
      },
    },
    options,
  );
}

/** A 24-hour time of day, `HH:MM`. */
export function IsTimeOfDay(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isTimeOfDay',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && TIME_OF_DAY_PATTERN.test(value),
        defaultMessage: (args) => `${args?.property ?? 'value'} must be a 24-hour time (HH:MM)`,
      },
    },
    options,
  );
}
