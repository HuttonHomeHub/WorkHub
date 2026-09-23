import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { EXPORTED_TABLES } from './export';

describe('EXPORTED_TABLES', () => {
  it('covers every model an owner owns, so a new table is never left out', () => {
    const owned = Prisma.dmmf.datamodel.models
      .filter((model) => model.fields.some((field) => field.name === 'ownerId'))
      .map((model) => model.name)
      .sort();
    const exported = Object.values(EXPORTED_TABLES)
      .map((table) => table.model)
      .sort();
    expect(exported).toEqual(owned);
  });
});
