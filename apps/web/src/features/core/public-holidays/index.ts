/**
 * Public surface of the core public-holidays entity (ADR-0020 §3): any tool
 * may import it, and it imports no tool.
 */
export {
  publicHolidayKeys,
  publicHolidaysQueryOptions,
  useCreatePublicHoliday,
  useDeletePublicHoliday,
  useImportPublicHolidays,
  usePublicHolidays,
  useRestorePublicHoliday,
  type PublicHoliday,
  type PublicHolidayInput,
} from './api/public-holidays';
