import { Module } from '@nestjs/common';

import { PublicHolidaysModule } from './public-holidays/public-holidays.module';

/**
 * Shared core records (ADR-0020 §2): facts about the owner's work that more
 * than one tool needs. It exports each entity module, so a tool that imports
 * CoreModule can inject the services those modules export. Core never imports
 * a tool.
 */
@Module({
  imports: [PublicHolidaysModule],
  exports: [PublicHolidaysModule],
})
export class CoreModule {}
