import { Module } from '@nestjs/common';

import { ExcessConversionsController } from './excess-conversions.controller';
import { ExcessConversionsRepository } from './excess-conversions.repository';
import { ExcessConversionsService } from './excess-conversions.service';

/**
 * Excess conversions feature module (pattern: docs/REFERENCE_FEATURE.md). Wires
 * the layers: controller → service → repository. Prisma comes from the global
 * PrismaModule; nothing here is exported unless another module legitimately
 * needs this feature's service.
 */
@Module({
  controllers: [ExcessConversionsController],
  providers: [ExcessConversionsService, ExcessConversionsRepository],
  // Read by the hours calculation (time-summaries, same tool).
  exports: [ExcessConversionsService],
})
export class ExcessConversionsModule {}
