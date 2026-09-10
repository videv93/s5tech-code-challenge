import * as Popover from '@radix-ui/react-popover';
import { Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRESETS = [0.1, 0.5, 1] as const;
export const DEFAULT_SLIPPAGE = 0.5;

interface SlippageSettingsProps {
  value: number;
  onChange: (value: number) => void;
}

export function SlippageSettings({ value, onChange }: SlippageSettingsProps) {
  const isCustom = !PRESETS.includes(value as (typeof PRESETS)[number]);

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Swap settings, slippage tolerance ${value}%`}
        className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-panel)] hover:text-[var(--text-primary)]"
      >
        <Settings2 className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-72 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-4 shadow-xl"
        >
          <h3 className="text-sm font-semibold">Slippage tolerance</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            The swap is cancelled if the rate moves more than this against you.
          </p>

          <div className="mt-3 flex gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChange(preset)}
                aria-pressed={value === preset}
                className={cn(
                  'flex-1 rounded-lg border py-1.5 text-sm font-medium transition-colors',
                  value === preset
                    ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                    : 'border-[var(--border-subtle)] hover:bg-[var(--surface-panel)]',
                )}
              >
                {preset}%
              </button>
            ))}
            <div
              className={cn(
                'flex flex-1 items-center rounded-lg border px-2',
                isCustom ? 'border-brand-500' : 'border-[var(--border-subtle)]',
              )}
            >
              <input
                type="number"
                min={0.01}
                max={50}
                step={0.1}
                value={isCustom ? value : ''}
                placeholder="Custom"
                aria-label="Custom slippage tolerance, percent"
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next) && next > 0 && next <= 50) onChange(next);
                }}
                className="w-full bg-transparent text-sm outline-none tabular-nums"
              />
              <span className="text-sm text-[var(--text-tertiary)]">%</span>
            </div>
          </div>

          {/* Both ends of the range are hazardous in different ways, and neither
              is obvious to a first-time user. */}
          {value < 0.05 && (
            <p className="mt-3 text-xs text-[var(--color-warning-400)]">
              Very low tolerance — your swap will probably fail.
            </p>
          )}
          {value > 5 && (
            <p className="mt-3 text-xs text-[var(--color-warning-400)]">
              High tolerance — you could receive noticeably less than quoted.
            </p>
          )}

          <Popover.Arrow className="fill-[var(--surface-overlay)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
