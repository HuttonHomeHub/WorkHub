import { Module } from '@nestjs/common';

import { CoreModule } from '../../core/core.module';
import { ExcessConversionsModule } from '../excess-conversions/excess-conversions.module';
import { LeaveYearsModule } from '../leave-years/leave-years.module';
import { TimeAdjustmentsModule } from '../time-adjustments/time-adjustments.module';
import { WorkDaysModule } from '../work-days/work-days.module';
import { WorkTermsModule } from '../work-terms/work-terms.module';

import { HoursCalculationService } from './hours-calculation.service';
import { TimeBalancesController, TimeSummariesController } from './time-summaries.controller';

/**
 * The hours tool's computed read-models (ADR-0020 §4): `time-summaries` and
 * `time-balances`. No table and no repository — it reads the other hours
 * modules' exported services and core's public holidays, and runs
 * `@repo/domain`.
 */
@Module({
  imports: [
    WorkTermsModule,
    WorkDaysModule,
    ExcessConversionsModule,
    TimeAdjustmentsModule,
    LeaveYearsModule,
    CoreModule,
  ],
  controllers: [TimeSummariesController, TimeBalancesController],
  providers: [HoursCalculationService],
})
export class TimeSummariesModule {}
