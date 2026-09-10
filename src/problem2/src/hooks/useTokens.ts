import { useQuery } from '@tanstack/react-query';
import { fetchTokens, type Token } from '@/lib/tokens';

export const TOKENS_QUERY_KEY = ['tokens'] as const;

/**
 * Prices are server state, not component state, so TanStack Query owns them:
 * caching, retry with backoff, deduplication across components, and a real
 * `isError` to design an error state around. Hand-rolling this with useEffect
 * means reimplementing all four, usually without the retry.
 */
export function useTokens() {
  return useQuery<Token[], Error>({
    queryKey: TOKENS_QUERY_KEY,
    queryFn: ({ signal }) => fetchTokens(signal),
    // The feed is a static file of historical quotes — refetching it on every
    // window focus would be pure noise.
    //
    // Retry policy is deliberately *not* set here: it belongs to the
    // QueryClient (see main.tsx), so a test can render against a client with
    // retries off without this hook overriding it.
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
