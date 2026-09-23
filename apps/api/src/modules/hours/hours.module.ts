import { Module } from '@nestjs/common';

import { ExcessConversionsModule } from './excess-conversions/excess-conversions.module';
import { LeaveYearsModule } from './leave-years/leave-years.module';
import { TimeAdjustmentsModule } from './time-adjustments/time-adjustments.module';
import { TimeSummariesModule } from './time-summaries/time-summaries.module';
import { WorkDaysModule } from './work-days/work-days.module';
import { WorkTermsModule } from './work-terms/work-terms.module';

/**
 * The hours tool's API (ADR-0020 §1): one module per entity, grouped here
 * and registered once in AppModule. A tool may import CoreModule for shared
 * records, never another tool's modules.
 */
@Module({
  imports: [
    WorkTermsModule,
    LeaveYearsModule,
    TimeAdjustmentsModule,
    WorkDaysModule,
    ExcessConversionsModule,
    TimeSummariesModule,
  ],
})
export class HoursModule {}
