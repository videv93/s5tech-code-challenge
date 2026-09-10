import { describe, expect, it } from 'vitest';
import { buildTokenList, iconUrlFor } from './tokens';
import { PRICE_FIXTURE } from '@/test/server';

describe('buildTokenList', () => {
  const tokens = buildTokenList(PRICE_FIXTURE);

  // The real feed ships 36 entries for 32 currencies.
  it('de-duplicates repeated currencies', () => {
    const busd = tokens.filter((token) => token.symbol === 'BUSD');
    expect(busd).toHaveLength(1);
  });

  it('keeps the most recent quote, not the last one in the array', () => {
    const busd = tokens.find((token) => token.symbol === 'BUSD');
    expect(busd?.price).toBe(1.0);
    expect(busd?.quotedAt).toBe('2023-08-29T09:00:00.000Z');
  });

  it('is order-independent', () => {
    const reversed = buildTokenList([...PRICE_FIXTURE].reverse());
    expect(reversed.find((t) => t.symbol === 'BUSD')?.price).toBe(1.0);
  });

  // The brief: "not every token has a price, those that do not can be omitted".
  it('omits tokens with no usable price', () => {
    expect(tokens.map((token) => token.symbol)).not.toContain('GHOST');
  });

  it('sorts alphabetically, case-insensitively', () => {
    const symbols = tokens.map((token) => token.symbol);
    expect(symbols).toEqual([...symbols].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
  });

  it('returns an empty list rather than throwing on empty input', () => {
    expect(buildTokenList([])).toEqual([]);
  });
});

describe('iconUrlFor', () => {
  it('uses the symbol directly when the filename matches', () => {
    expect(iconUrlFor('ETH')).toContain('/ETH.svg');
  });

  // Raw GitHub paths are case-sensitive and the icon repo disagrees with the
  // feed's casing for the Stride tokens — without the map these 404 silently.
  it.each([
    ['STATOM', 'stATOM'],
    ['STOSMO', 'stOSMO'],
    ['STLUNA', 'stLUNA'],
    ['STEVMOS', 'stEVMOS'],
    ['RATOM', 'rATOM'],
  ])('maps %s to the %s.svg filename the repository actually uses', (symbol, filename) => {
    expect(iconUrlFor(symbol)).toContain(`/${filename}.svg`);
  });
});
