import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TokenIconProps {
  symbol: string;
  src: string;
  size?: number;
  className?: string;
}

/**
 * Token icons come from a third-party repository, and not every symbol in the
 * price feed has a file there. A broken-image glyph in the middle of a swap form
 * looks like the app is broken, so the fallback is a deterministic monogram —
 * same symbol, same colour, every time.
 */
export function TokenIcon({ symbol, src, size = 32, className }: TokenIconProps) {
  // Storing *which* src failed, rather than a boolean, means a token change
  // clears the failure by itself — no effect, no cascading render, and no way
  // for a stale monogram to stick to a newly selected token.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;

  const hue = (symbol.charCodeAt(0) * 37 + (symbol.charCodeAt(1) ?? 0) * 11) % 360;

  if (failed) {
    return (
      <span
        role="img"
        aria-label={`${symbol} icon`}
        className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', className)}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.36,
          background: `oklch(0.72 0.14 ${hue} / 0.22)`,
          color: `oklch(0.52 0.16 ${hue})`,
        }}
      >
        {symbol.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={cn('shrink-0 rounded-full bg-[var(--surface-panel)] object-contain', className)}
      style={{ width: size, height: size }}
    />
  );
}
