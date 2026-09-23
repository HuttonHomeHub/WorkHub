import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

/** Query params for listing leave years, scoped to the caller (ADR-0016). */
export class ListLeaveYearsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['year', 'createdAt'], default: 'year' })
  @IsOptional()
  @IsIn(['year', 'createdAt'])
  sort: 'year' | 'createdAt' = 'year';
}
