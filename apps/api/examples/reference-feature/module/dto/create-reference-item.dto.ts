import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReferenceItemStatus } from '@prisma/client';
import { NO_CONTROL_CHARACTERS_PATTERN } from '@repo/types';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { IsOmittable } from '../../../common/validation/optional';

/**
 * Request body for creating a reference item. Validated by the global pipe.
 * Note there is NO owner field: the owner is always the authenticated principal
 * (ADR-0016) — never trust the client to name the owner.
 */
export class CreateReferenceItemDto {
  @ApiProperty({ minLength: 1, maxLength: 120, example: 'Reference item' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(NO_CONTROL_CHARACTERS_PATTERN, { message: 'name must be a single line of text' })
  name!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: ReferenceItemStatus, default: ReferenceItemStatus.DRAFT })
  @IsOmittable()
  @IsEnum(ReferenceItemStatus)
  status?: ReferenceItemStatus;
}
