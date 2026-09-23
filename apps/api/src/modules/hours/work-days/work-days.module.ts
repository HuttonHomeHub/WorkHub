import { Module } from '@nestjs/common';

import { CoreModule } from '../../core/core.module';
import { WorkTermsModule } from '../work-terms/work-terms.module';

import { WorkDaysController } from './work-days.controller';
import { WorkDaysRepository } from './work-days.repository';
import { WorkDaysService } from './work-days.service';

/**
 * Work days feature module (pattern: docs/REFERENCE_FEATURE.md). Wires
 * the layers: controller → service → repository. Prisma comes from the global
 * PrismaModule; nothing here is exported unless another module legitimately
 * needs this feature's service.
 */
@Module({
  // Terms in force (same tool) and public holidays (core) validate a day.
  imports: [WorkTermsModule, CoreModule],
  controllers: [WorkDaysController],
  providers: [WorkDaysService, WorkDaysRepository],
})
export class WorkDaysModule {}
