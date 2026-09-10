import { BLOCKCHAIN_PRIORITY, type Blockchain } from './types';

/** Priority assigned to a chain that is not in the supported set. */
export const UNSUPPORTED_PRIORITY = -99;

/**
 * [4][5] Hoisted out of the component (it closes over nothing, so re-creating it
 * on every render was pure waste) and reduced from a linear `switch` to a
 * constant-time object lookup.
 *
 * [3] `blockchain` is typed as `Blockchain | string` rather than `any`: callers
 * holding a well-typed balance get full checking, while genuinely unknown input
 * from the network still falls through to the documented default instead of
 * throwing.
 */
export function getPriority(blockchain: Blockchain | (string & {})): number {
  return BLOCKCHAIN_PRIORITY[blockchain as Blockchain] ?? UNSUPPORTED_PRIORITY;
}

/** A chain the UI knows how to rank. */
export function isSupportedBlockchain(blockchain: string): blockchain is Blockchain {
  return blockchain in BLOCKCHAIN_PRIORITY;
}
