import { Module } from '@nestjs/common';

import { PublicHolidayImportsController } from './public-holiday-imports.controller';
import { PublicHolidaysController } from './public-holidays.controller';
import { PublicHolidaysRepository } from './public-holidays.repository';
import { PublicHolidaysService } from './public-holidays.service';

/**
 * Public holidays feature module (pattern: docs/REFERENCE_FEATURE.md). Wires
 * the layers: controller → service → repository. Prisma comes from the global
 * PrismaModule; nothing here is exported unless another module legitimately
 * needs this feature's service.
 */
@Module({
  controllers: [PublicHolidaysController, PublicHolidayImportsController],
  providers: [PublicHolidaysService, PublicHolidaysRepository],
  // Core: tools use the service's owner-scoped reads (ADR-0020 §3).
  exports: [PublicHolidaysService],
})
export class PublicHolidaysModule {}
