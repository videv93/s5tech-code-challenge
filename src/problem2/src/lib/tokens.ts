import { z } from 'zod';

export const PRICES_URL = 'https://interview.switcheo.com/prices.json';
const ICON_BASE = 'https://raw.githubusercontent.com/Switcheo/token-icons/main/tokens';

/**
 * The feed is validated rather than trusted. It is a third-party endpoint we do
 * not control; a shape change should surface as one readable error, not as
 * `undefined` propagating into a price calculation and rendering `NaN`.
 */
const priceEntrySchema = z.object({
  currency: z.string().min(1),
  date: z.string(),
  price: z.number(),
});

export const priceFeedSchema = z.array(priceEntrySchema);
export type PriceEntry = z.infer<typeof priceEntrySchema>;

export interface Token {
  symbol: string;
  price: number;
  /** When this price was quoted, for the "prices as of…" line. */
  quotedAt: string;
  iconUrl: string;
}

/**
 * The icon repository does not use the same casing as the price feed for the
 * Stride liquid-staking tokens: the feed says `STATOM`, the file is `stATOM.svg`.
 * Raw GitHub paths are case-sensitive, so without this map five tokens silently
 * fall back to the placeholder. Verified against the repository, not guessed.
 */
const ICON_FILENAME_OVERRIDES: Record<string, string> = {
  STATOM: 'stATOM',
  STOSMO: 'stOSMO',
  STLUNA: 'stLUNA',
  STEVMOS: 'stEVMOS',
  RATOM: 'rATOM',
};

export function iconUrlFor(symbol: string): string {
  return `${ICON_BASE}/${ICON_FILENAME_OVERRIDES[symbol.toUpperCase()] ?? symbol}.svg`;
}

/**
 * Turn the raw feed into the token list the UI works with.
 *
 * Two real properties of this feed drive the logic:
 *
 * 1. **It contains duplicates.** 36 entries, 32 distinct currencies — BUSD, for
 *    one, appears twice with different prices. Taking the last-seen entry would
 *    make the displayed rate depend on array order, so the most recent `date`
 *    wins, deterministically.
 * 2. **Not every token has a usable price.** The brief says as much. A token
 *    priced at zero or with a non-finite price cannot produce an exchange rate,
 *    so it is omitted rather than offered and then failing at quote time.
 */
export function buildTokenList(entries: PriceEntry[]): Token[] {
  const bySymbol = new Map<string, PriceEntry>();

  for (const entry of entries) {
    if (!Number.isFinite(entry.price) || entry.price <= 0) continue;

    const existing = bySymbol.get(entry.currency);
    if (!existing || new Date(entry.date).getTime() > new Date(existing.date).getTime()) {
      bySymbol.set(entry.currency, entry);
    }
  }

  return [...bySymbol.values()]
    .map((entry) => ({
      symbol: entry.currency,
      price: entry.price,
      quotedAt: entry.date,
      iconUrl: iconUrlFor(entry.currency),
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol, 'en', { sensitivity: 'base' }));
}

/** Shown as a quick-pick row above the search results. */
export const POPULAR_SYMBOLS = ['ETH', 'USDC', 'SWTH', 'WBTC', 'ATOM', 'OSMO'] as const;

export async function fetchTokens(signal?: AbortSignal): Promise<Token[]> {
  const response = await fetch(PRICES_URL, { signal });
  if (!response.ok) {
    throw new Error(`Price feed responded ${response.status} ${response.statusText}`);
  }

  const parsed = priceFeedSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('The price feed returned an unexpected shape');
  }

  const tokens = buildTokenList(parsed.data);
  if (tokens.length === 0) {
    throw new Error('The price feed contained no priceable tokens');
  }
  return tokens;
}
