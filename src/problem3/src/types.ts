/**
 * [3] The set of supported chains is closed and known, so model it as a union
 * rather than `any`. Adding a chain to `BLOCKCHAIN_PRIORITY` now widens this
 * type automatically, and any `switch`/lookup that forgets the new member
 * becomes a compile error instead of a silent `-99`.
 */
export const BLOCKCHAIN_PRIORITY = {
  Osmosis: 100,
  Ethereum: 50,
  Arbitrum: 30,
  Zilliqa: 20,
  Neo: 20,
} as const satisfies Record<string, number>;

export type Blockchain = keyof typeof BLOCKCHAIN_PRIORITY;

/**
 * [2] The original `WalletBalance` had no `blockchain` field, yet the filter and
 * the comparator both read `balance.blockchain`. Under `strict` that is a
 * compile error; the code only "worked" because `getPriority(blockchain: any)`
 * accepted the resulting `any`. The field is part of the domain object, so it
 * belongs on the interface.
 */
export interface WalletBalance {
  currency: string;
  amount: number;
  blockchain: Blockchain;
}

/**
 * [11] Modelled as an *extension* of WalletBalance rather than a parallel
 * re-declaration, so the two can never drift apart, and so the compiler can
 * tell a formatted balance from an unformatted one — which is what makes the
 * original's unsound cast (mapping over `sortedBalances` while annotating the
 * callback parameter as `FormattedWalletBalance`) impossible to write here.
 */
export interface FormattedWalletBalance extends WalletBalance {
  /** Human-readable amount, e.g. "1,234.5678". */
  formatted: string;
  /** Fiat value at current prices, or `null` when the token has no price feed. */
  usdValue: number | null;
}

/** Map of currency symbol → USD price. Not every token has a price. */
export type PriceMap = Readonly<Record<string, number | undefined>>;
