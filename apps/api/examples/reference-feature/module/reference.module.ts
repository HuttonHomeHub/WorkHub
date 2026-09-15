import { Module } from '@nestjs/common';

import { ReferenceController } from './reference.controller';
import { ReferenceRepository } from './reference.repository';
import { ReferenceService } from './reference.service';

/**
 * Reference items feature module (pattern: docs/REFERENCE_FEATURE.md). Wires
 * the layers: controller → service → repository. Prisma comes from the global
 * PrismaModule; nothing here is exported unless another module legitimately
 * needs this feature's service.
 */
@Module({
  controllers: [ReferenceController],
  providers: [ReferenceService, ReferenceRepository],
})
export class ReferenceModule {}
