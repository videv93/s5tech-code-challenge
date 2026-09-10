import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { PRICES_URL } from '@/lib/tokens';
import { SwapCard } from './SwapCard';

/** Settlement is randomised; pin it so the flow tests are deterministic. */
function forceSwapOutcome(outcome: 'success' | 'failure') {
  vi.spyOn(Math, 'random').mockReturnValue(outcome === 'success' ? 0.9 : 0.01);
}

async function renderReady() {
  const user = userEvent.setup();
  const utils = renderWithProviders(<SwapCard />);
  await screen.findByRole('button', { name: /change token, currently eth/i });
  return { user, ...utils };
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loading and failure of the price feed', () => {
  it('shows a labelled loading state first', () => {
    renderWithProviders(<SwapCard />);
    expect(screen.getByRole('status', { name: /loading token prices/i })).toBeInTheDocument();
  });

  it('explains the failure and offers a retry rather than showing a bad rate', async () => {
    server.use(http.get(PRICES_URL, () => new HttpResponse(null, { status: 500 })));

    renderWithProviders(<SwapCard />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/couldn’t load token prices/i)).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('recovers when the retry succeeds', async () => {
    let attempt = 0;
    server.use(
      http.get(PRICES_URL, () => {
        attempt += 1;
        return attempt === 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(FIXTURE);
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<SwapCard />);
    await user.click(await screen.findByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('button', { name: /change token, currently eth/i })).toBeInTheDocument();
  });

  it('rejects a feed whose shape is wrong instead of rendering NaN', async () => {
    server.use(http.get(PRICES_URL, () => HttpResponse.json([{ nope: true }])));

    renderWithProviders(<SwapCard />);

    expect(await screen.findByText(/unexpected shape/i)).toBeInTheDocument();
  });
});

describe('quoting', () => {
  it('starts on a usable default pair instead of two empty selectors', async () => {
    await renderReady();
    expect(screen.getByRole('button', { name: /change token, currently eth/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change token, currently usdc/i })).toBeInTheDocument();
  });

  it('quotes the destination amount as the user types', async () => {
    const { user } = await renderReady();
    await user.type(screen.getByLabelText(/you pay amount/i), '1');

    await waitFor(() => {
      expect(screen.getByLabelText(/you receive amount/i)).not.toHaveValue('');
    });
    expect(screen.getByText(/^1 ETH = /)).toBeInTheDocument();
  });

  it('shows the USD value of both legs', async () => {
    const { user } = await renderReady();
    await user.type(screen.getByLabelText(/you pay amount/i), '1');

    // ETH at 1645.9337 in the fixture. The same figure can legitimately appear
    // more than once (the pay leg's value and, at parity, the receive leg's).
    expect((await screen.findAllByText('$1,645.93')).length).toBeGreaterThan(0);
  });

  it('discloses fee, minimum received and price impact on request', async () => {
    const { user } = await renderReady();
    await user.type(screen.getByLabelText(/you pay amount/i), '1');
    await user.click(screen.getByRole('button', { name: /^1 ETH = / }));

    expect(screen.getByText(/minimum received/i)).toBeInTheDocument();
    expect(screen.getByText(/price impact/i)).toBeInTheDocument();
    expect(screen.getByText(/network fee/i)).toBeInTheDocument();
  });
});

describe('validation', () => {
  it('does not nag before the field has been touched', async () => {
    await renderReady();
    expect(screen.queryByText(/enter an amount to swap/i)).not.toBeInTheDocument();
  });

  it('refuses to swap more than the balance, naming the shortfall', async () => {
    const { user } = await renderReady();
    await user.type(screen.getByLabelText(/you pay amount/i), '99999');
    await user.tab();

    // The message appears twice by design — once in the live region for screen
    // readers, once as the submit button's label for everyone else.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/not enough eth/i);
    expect(screen.getByLabelText(/you pay amount/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps the submit button disabled while the amount is invalid', async () => {
    const { user } = await renderReady();
    await user.type(screen.getByLabelText(/you pay amount/i), '99999');
    await user.tab();

    await waitFor(() => expect(screen.getByRole('button', { name: /not enough eth/i })).toBeDisabled());
  });

  it('ignores characters that cannot be part of an amount', async () => {
    const { user } = await renderReady();
    const input = screen.getByLabelText(/you pay amount/i);
    await user.type(input, '1a.2b');
    expect(input).toHaveValue('1.2');
  });

  it('announces errors to assistive technology', async () => {
    const { user } = await renderReady();
    await user.type(screen.getByLabelText(/you pay amount/i), '99999');
    await user.tab();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/not enough eth/i);
  });
});

describe('the amount shortcuts', () => {
  it('fills exactly the balance on Max, which then validates', async () => {
    const { user } = await renderReady();
    await user.click(screen.getByRole('button', { name: 'MAX' }));

    const input = screen.getByLabelText(/you pay amount/i);
    expect(input).not.toHaveValue('');
    // The whole point: Max must not produce an over-balance error.
    expect(screen.queryByText(/not enough/i)).not.toBeInTheDocument();
  });

  it('fills a fraction of the balance on a percentage', async () => {
    const { user } = await renderReady();
    await user.click(screen.getByRole('button', { name: 'MAX' }));
    const max = (screen.getByLabelText(/you pay amount/i) as HTMLInputElement).value;

    await user.click(screen.getByRole('button', { name: '50%' }));
    const half = (screen.getByLabelText(/you pay amount/i) as HTMLInputElement).value;

    expect(Number(half)).toBeCloseTo(Number(max) / 2, 8);
  });
});

describe('the direction toggle', () => {
  it('exchanges the two tokens', async () => {
    const { user } = await renderReady();
    await user.click(screen.getByRole('button', { name: /swap the pay and receive tokens/i }));

    expect(await screen.findByRole('button', { name: /change token, currently usdc/i })).toBeInTheDocument();
    const [payButton] = screen.getAllByRole('button', { name: /change token, currently usdc/i });
    expect(payButton).toBeInTheDocument();
  });
});

describe('the token picker', () => {
  it('filters as the user searches', async () => {
    const { user } = await renderReady();
    await user.click(screen.getByRole('button', { name: /change token, currently eth/i }));
    await user.type(await screen.findByLabelText(/search tokens/i), 'swt');

    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('SWTH');
  });

  it('says so when nothing matches', async () => {
    const { user } = await renderReady();
    await user.click(screen.getByRole('button', { name: /change token, currently eth/i }));
    await user.type(await screen.findByLabelText(/search tokens/i), 'zzzz');

    expect(await screen.findByText(/no token matches/i)).toBeInTheDocument();
  });

  // Disabled, not hidden: a vanishing row reads as a bug.
  it('shows the other leg’s token as unavailable rather than hiding it', async () => {
    const { user } = await renderReady();
    await user.click(screen.getByRole('button', { name: /change token, currently eth/i }));

    const usdcOption = (await screen.findAllByRole('option')).find((option) =>
      option.textContent?.includes('USDC'),
    );
    expect(usdcOption).toBeDisabled();
    expect(usdcOption).toHaveTextContent(/in use/i);
  });

  it('changes the selected token', async () => {
    const { user } = await renderReady();
    await user.click(screen.getByRole('button', { name: /change token, currently eth/i }));
    await user.type(await screen.findByLabelText(/search tokens/i), 'swth');
    await user.click((await screen.findAllByRole('option'))[0]!);

    expect(await screen.findByRole('button', { name: /change token, currently swth/i })).toBeInTheDocument();
  });
});

describe('submitting', () => {
  it('shows a busy state, then a receipt with the exact amounts', async () => {
    forceSwapOutcome('success');
    const { user } = await renderReady();

    await user.type(screen.getByLabelText(/you pay amount/i), '1');
    const submit = await screen.findByRole('button', { name: /swap eth for usdc/i });
    await user.click(submit);

    expect(await screen.findByRole('button', { name: /confirming swap/i })).toHaveAttribute(
      'aria-busy',
      'true',
    );

    expect(await screen.findByText(/swap complete/i, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(/make another swap/i)).toBeInTheDocument();
  }, 10_000);

  it('reports a failed settlement without clearing the form', async () => {
    forceSwapOutcome('failure');
    const { user } = await renderReady();

    await user.type(screen.getByLabelText(/you pay amount/i), '1');
    await user.click(await screen.findByRole('button', { name: /swap eth for usdc/i }));

    expect(
      await screen.findByText(/your funds were not moved/i, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/you pay amount/i)).toHaveValue('1');
  }, 10_000);

  it('cannot be submitted with an empty amount', async () => {
    await renderReady();
    expect(screen.getByRole('button', { name: /enter an amount/i })).toBeDisabled();
  });
});

const FIXTURE = [
  { currency: 'ETH', date: '2023-08-29T07:10:40.000Z', price: 1645.9337 },
  { currency: 'USDC', date: '2023-08-29T07:10:30.000Z', price: 0.989832 },
  { currency: 'SWTH', date: '2023-08-29T07:10:40.000Z', price: 0.00414 },
];
