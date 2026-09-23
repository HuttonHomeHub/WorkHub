import { Module } from '@nestjs/common';

import { TimeAdjustmentsController } from './time-adjustments.controller';
import { TimeAdjustmentsRepository } from './time-adjustments.repository';
import { TimeAdjustmentsService } from './time-adjustments.service';

/**
 * Time adjustments feature module (pattern: docs/REFERENCE_FEATURE.md). Wires
 * the layers: controller → service → repository. Prisma comes from the global
 * PrismaModule; nothing here is exported unless another module legitimately
 * needs this feature's service.
 */
@Module({
  controllers: [TimeAdjustmentsController],
  providers: [TimeAdjustmentsService, TimeAdjustmentsRepository],
})
export class TimeAdjustmentsModule {}
