import { Module } from '@nestjs/common';

import { LeaveYearsController } from './leave-years.controller';
import { LeaveYearsRepository } from './leave-years.repository';
import { LeaveYearsService } from './leave-years.service';

/**
 * Leave years feature module (pattern: docs/REFERENCE_FEATURE.md). Wires
 * the layers: controller → service → repository. Prisma comes from the global
 * PrismaModule; nothing here is exported unless another module legitimately
 * needs this feature's service.
 */
@Module({
  controllers: [LeaveYearsController],
  providers: [LeaveYearsService, LeaveYearsRepository],
  // Read by the hours calculation (time-summaries, same tool).
  exports: [LeaveYearsService],
})
export class LeaveYearsModule {}
