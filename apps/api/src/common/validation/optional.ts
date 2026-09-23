import { ValidateIf } from 'class-validator';

/**
 * Optional but not nullable: an omitted property skips validation, and an
 * explicit `null` is validated (and fails, so 422). `@IsOptional()` skips
 * `null` too, which would let it reach the service and Prisma as a 500. Use
 * `@IsOptional()` only for properties where `null` means something (clear a
 * cap). Update DTOs get the same behaviour from
 * `PartialType(Create…Dto, { skipNullProperties: false })`.
 */
export function IsOmittable(): PropertyDecorator {
  return ValidateIf((_object: object, value: unknown) => value !== undefined);
}
