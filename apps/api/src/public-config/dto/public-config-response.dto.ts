import { ApiProperty } from '@nestjs/swagger';

/** Settings the web client needs before anyone is signed in. Never include secrets. */
export class PublicConfigResponseDto {
  @ApiProperty({ description: 'Whether the public sign-up page is available (ADR-0018).' })
  signUpEnabled!: boolean;
}
