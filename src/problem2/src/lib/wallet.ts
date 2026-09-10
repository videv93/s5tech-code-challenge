import type { Token } from './tokens';

/**
 * A deterministic mock wallet.
 *
 * The brief says to simulate the backend, and balances are what make the form
 * genuinely interactive: without them there is no "Max", no percentage buttons,
 * and no insufficient-balance error to design for. Deriving them from a hash of
 * the symbol keeps them stable across reloads — a wallet whose contents shuffle
 * on every refresh would make the UI impossible to demo or test.
 */
const WALLET_ADDRESS = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

/** Roughly $50–$8,000 of each token, so amounts look plausible against price. */
export function mockBalanceFor(token: Token): string {
  const seed = hash(token.symbol);
  // A few tokens you simply do not hold — the zero-balance case has to be
  // reachable, or the empty state and the "Max" button never get exercised.
  if (seed % 13 === 0) return '0';
  const usdValue = 50 + (seed % 7950);
  const units = usdValue / token.price;
  const decimals = units >= 1000 ? 2 : units >= 1 ? 4 : 8;
  return units.toFixed(decimals).replace(/\.?0+$/, '');
}

export function buildWallet(tokens: Token[]): Record<string, string> {
  return Object.fromEntries(tokens.map((token) => [token.symbol, mockBalanceFor(token)]));
}

export const walletAddress = WALLET_ADDRESS;
