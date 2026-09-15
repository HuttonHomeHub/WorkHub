import { ApiProperty } from '@nestjs/swagger';

import type { Principal } from '../../common/auth/principal';

/** Public representation of the authenticated user. */
export class MeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty()
  name!: string;

  static from(principal: Principal): MeResponseDto {
    return { id: principal.userId, email: principal.email, name: principal.name };
  }
}
