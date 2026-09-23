import { Module } from '@nestjs/common';

import { WorkTermsController } from './work-terms.controller';
import { WorkTermsRepository } from './work-terms.repository';
import { WorkTermsService } from './work-terms.service';

/**
 * Work terms feature module (pattern: docs/REFERENCE_FEATURE.md). Wires
 * the layers: controller → service → repository. Prisma comes from the global
 * PrismaModule; nothing here is exported unless another module legitimately
 * needs this feature's service.
 */
@Module({
  controllers: [WorkTermsController],
  providers: [WorkTermsService, WorkTermsRepository],
  // Other hours modules read the terms in force (same tool, ADR-0020 §3).
  exports: [WorkTermsService],
})
export class WorkTermsModule {}
