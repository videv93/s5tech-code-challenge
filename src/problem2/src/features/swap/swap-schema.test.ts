import { describe, expect, it } from 'vitest';
import { buildSwapSchema, sanitiseAmountInput } from './swap-schema';

const schema = (overrides: Partial<Parameters<typeof buildSwapSchema>[0]> = {}) =>
  buildSwapSchema({
    hasFromToken: true,
    hasToToken: true,
    balance: '10',
    symbol: 'ETH',
    ...overrides,
  });

function messageFor(amount: string, options?: Parameters<typeof schema>[0]): string | undefined {
  const result = schema(options).safeParse({ amount });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('buildSwapSchema', () => {
  it('accepts an amount within balance', () => {
    expect(messageFor('5')).toBeUndefined();
  });

  it('accepts spending the entire balance', () => {
    expect(messageFor('10')).toBeUndefined();
  });

  it.each([
    ['', 'Enter an amount to swap'],
    ['0', 'Enter an amount greater than zero'],
    ['abc', 'Amounts can only contain digits and a decimal point'],
  ])('rejects %s', (amount, expected) => {
    expect(messageFor(amount)).toBe(expected);
  });

  // Actionable, not generic: the message names the shortfall.
  it('names the token and the balance when there is not enough', () => {
    expect(messageFor('20')).toBe('Not enough ETH — you have 10');
  });

  it('asks for the missing token before complaining about the amount', () => {
    expect(messageFor('5', { hasFromToken: false })).toBe('Choose the token you are paying with');
    expect(messageFor('5', { hasToToken: false })).toBe('Choose the token you want to receive');
  });
});

describe('sanitiseAmountInput', () => {
  it.each([
    ['12', '', '12'],
    ['0.5', '', '0.5'],
    ['.5', '', '.5'],
    ['1.', '1', '1.'], // a legitimate mid-typing state
    ['007', '', '7'],
  ])('accepts %s', (input, previous, expected) => {
    expect(sanitiseAmountInput(input, previous)).toBe(expected);
  });

  it.each([
    ['1.2.3', '1.2'],
    ['12a', '12'],
    ['-5', ''],
    ['1e5', '1'],
  ])('rejects %s by keeping the previous value', (input, previous) => {
    expect(sanitiseAmountInput(input, previous)).toBe(previous);
  });

  it('accepts a comma as a decimal separator', () => {
    expect(sanitiseAmountInput('1,5', '1')).toBe('1.5');
  });

  it('rejects more than 18 decimal places', () => {
    const tooPrecise = `0.${'1'.repeat(19)}`;
    expect(sanitiseAmountInput(tooPrecise, '0.1')).toBe('0.1');
  });

  it('allows clearing the field', () => {
    expect(sanitiseAmountInput('', '123')).toBe('');
  });
});
