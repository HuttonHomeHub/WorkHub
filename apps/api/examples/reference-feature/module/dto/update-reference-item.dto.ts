import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReferenceItemStatus } from '@prisma/client';
import { NO_CONTROL_CHARACTERS_PATTERN } from '@repo/types';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { IsOmittable } from '../../../common/validation/optional';

/**
 * Request body for updating a reference item. `version` is the expected current
 * version for optimistic locking (see docs/DATABASE.md) — a mismatch yields 409.
 * Omitted fields are unchanged. `null` clears a nullable field (`description`)
 * and is a 422 on any other (`IsOmittable`, not `IsOptional`, which would let
 * it reach Prisma as a 500).
 */
export class UpdateReferenceItemDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 120 })
  @IsOmittable()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(NO_CONTROL_CHARACTERS_PATTERN, { message: 'name must be a single line of text' })
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ enum: ReferenceItemStatus })
  @IsOmittable()
  @IsEnum(ReferenceItemStatus)
  status?: ReferenceItemStatus;

  @ApiProperty({ minimum: 1, description: 'Expected current version (optimistic locking).' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647) // INT4: a larger value would overflow in the query (500)
  version!: number;
}
