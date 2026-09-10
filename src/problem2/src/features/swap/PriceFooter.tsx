import { formatRelativeTime } from '@/lib/format';
import type { Token } from '@/lib/tokens';

interface PriceFooterProps {
  tokens: Token[];
  isFetching: boolean;
}

/**
 * Provenance. The feed is a static file of quotes from a fixed date, so a UI
 * that implies "live" would be lying — and a user comparing this rate against a
 * real exchange deserves to know why the numbers differ.
 */
export function PriceFooter({ tokens, isFetching }: PriceFooterProps) {
  const latest = tokens.reduce<string | null>((newest, token) => {
    if (!newest) return token.quotedAt;
    return new Date(token.quotedAt) > new Date(newest) ? token.quotedAt : newest;
  }, null);

  return (
    <p className="mt-3 text-center text-xs text-[var(--text-tertiary)]">
      {isFetching ? (
        'Refreshing prices…'
      ) : (
        <>
          {tokens.length} tokens · prices quoted {latest ? formatRelativeTime(latest) : 'unknown'}
        </>
      )}
    </p>
  );
}
