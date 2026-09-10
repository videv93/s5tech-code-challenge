import { z } from 'zod';
import { compare, isPositive, isValidDecimal } from '@/lib/decimal';

export interface SwapFormValues {
  amount: string;
}

/**
 * The rules depend on runtime state — which token is selected and how much of it
 * the user holds — so the schema is built per render rather than declared once.
 *
 * Messages are written to be actionable. "Invalid input" tells the user nothing;
 * "You only have 12.4 ETH" tells them exactly what to do next.
 */
export function buildSwapSchema(options: {
  hasFromToken: boolean;
  hasToToken: boolean;
  balance: string;
  symbol: string | null;
}) {
  return z.object({
    amount: z
      .string()
      .superRefine((value, ctx) => {
        const addIssue = (message: string) =>
          ctx.addIssue({ code: 'custom', message });

        if (value.trim() === '') return addIssue('Enter an amount to swap');
        if (!options.hasFromToken) return addIssue('Choose the token you are paying with');
        if (!options.hasToToken) return addIssue('Choose the token you want to receive');
        if (!isValidDecimal(value)) return addIssue('Amounts can only contain digits and a decimal point');
        if (!isPositive(value)) return addIssue('Enter an amount greater than zero');

        if (compare(value, options.balance) === 1) {
          return addIssue(
            `Not enough ${options.symbol ?? 'balance'} — you have ${options.balance}`,
          );
        }
      }),
  });
}

/**
 * Keystroke-level sanitising, distinct from validation.
 *
 * Validation says whether a *committed* value is acceptable; this decides what
 * the field is even allowed to contain while the user is mid-type. It must let
 * through the transient states real typing produces — "0.", "." — which is why
 * the field is `type="text"` with `inputMode="decimal"` rather than
 * `type="number"`.
 */
export function sanitiseAmountInput(raw: string, previous: string): string {
  if (raw === '') return '';

  const normalised = raw.replace(',', '.');
  if (!/^\d*\.?\d*$/.test(normalised)) return previous;

  // Reject a second decimal point rather than silently truncating the number.
  if ((normalised.match(/\./g)?.length ?? 0) > 1) return previous;

  // Cap the fractional part at 18 places — no token has more, and a longer
  // string is almost always a paste accident.
  const [, fraction] = normalised.split('.');
  if (fraction && fraction.length > 18) return previous;

  // "007" is never what anyone means; "0.5" is.
  return normalised.replace(/^0+(?=\d)/, '');
}
