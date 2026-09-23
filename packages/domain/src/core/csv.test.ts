import { describe, expect, it } from 'vitest';

import { toCsv } from './csv.js';

describe('toCsv', () => {
  it('writes RFC 4180 CSV with CRLF and a BOM', () => {
    expect(
      toCsv([
        ['a', 'b'],
        [1, null],
      ]),
    ).toBe('﻿a,b\r\n1,\r\n');
    expect(toCsv([['a']], { bom: false })).toBe('a\r\n');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(toCsv([['a,b', 'say "hi"', 'two\nlines']], { bom: false })).toBe(
      '"a,b","say ""hi""","two\nlines"\r\n',
    );
  });

  it('guards text that a spreadsheet would run as a formula', () => {
    const row = ['=SUM(A1:A2)', '+1', '-1', '@cmd', '\tx', 'safe', '−2:00'];
    expect(toCsv([row], { bom: false })).toBe("'=SUM(A1:A2),'+1,'-1,'@cmd,'\tx,safe,−2:00\r\n");
  });

  it('never prefixes numbers, and drops non-finite ones', () => {
    expect(toCsv([[-2.17, 7.5, Number.NaN]], { bom: false })).toBe('-2.17,7.5,\r\n');
  });
});
