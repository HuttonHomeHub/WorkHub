import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReferenceItemStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
  name!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: ReferenceItemStatus, default: ReferenceItemStatus.DRAFT })
  @IsOptional()
  @IsEnum(ReferenceItemStatus)
  status?: ReferenceItemStatus;
}
