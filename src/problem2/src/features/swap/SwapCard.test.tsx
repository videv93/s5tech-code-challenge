import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { server, swapOrderResponse } from '@/test/server';
import { API_BASE_URL } from '@/lib/api';
import { PRICES_URL } from '@/lib/tokens';
import { SwapCard } from './SwapCard';

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
    // The default handler answers instantly, so the busy state would flash past
    // before it could be asserted. A short, explicit delay makes the in-flight
    // window deterministic rather than racing the event loop.
    server.use(
      http.post(`${API_BASE_URL}/api/v1/swap-orders`, async ({ request }) => {
        const body = (await request.json()) as Record<string, string>;
        await delay(120);
        return HttpResponse.json(swapOrderResponse(body), { status: 201 });
      }),
    );

    const { user } = await renderReady();

    await user.type(screen.getByLabelText(/you pay amount/i), '1');
    const submit = await screen.findByRole('button', { name: /swap eth for usdc/i });
    await user.click(submit);

    expect(await screen.findByRole('button', { name: /confirming swap/i })).toHaveAttribute(
      'aria-busy',
      'true',
    );

    expect(await screen.findByText(/order submitted/i, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(/make another swap/i)).toBeInTheDocument();
  }, 10_000);

  it('sends the server only what it should derive nothing from', async () => {
    let submitted: Record<string, unknown> = {};
    server.use(
      http.post(`${API_BASE_URL}/api/v1/swap-orders`, async ({ request }) => {
        submitted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(swapOrderResponse(submitted as Record<string, string>), {
          status: 201,
        });
      }),
    );

    const { user } = await renderReady();
    await user.type(screen.getByLabelText(/you pay amount/i), '1');
    await user.click(await screen.findByRole('button', { name: /swap eth for usdc/i }));
    await screen.findByText(/order submitted/i, {}, { timeout: 5000 });

    // toAmount is the server's to compute — sending it would let the client
    // submit an internally inconsistent order.
    expect(submitted['toAmount']).toBeUndefined();
    expect(submitted).toMatchObject({ fromCurrency: 'ETH', toCurrency: 'USDC', fromAmount: '1' });
    // Never exponential notation: the API's validator rejects it.
    expect(String(submitted['rate'])).not.toMatch(/e/i);
  }, 10_000);

  // The regression this pins: typing ".5" quoted fine and then failed on submit
  // with a 422, because the API requires a digit before the decimal point.
  it('canonicalises a half-typed amount before sending it', async () => {
    let submitted: Record<string, unknown> = {};
    server.use(
      http.post(`${API_BASE_URL}/api/v1/swap-orders`, async ({ request }) => {
        submitted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(swapOrderResponse(submitted as Record<string, string>), {
          status: 201,
        });
      }),
    );

    const { user } = await renderReady();
    const input = screen.getByLabelText(/you pay amount/i);
    await user.type(input, '.5');
    // The field keeps what the user typed…
    expect(input).toHaveValue('.5');

    await user.click(await screen.findByRole('button', { name: /swap eth for usdc/i }));
    await screen.findByText(/order submitted/i, {}, { timeout: 5000 });

    // …but the wire gets the canonical form the API will accept.
    expect(submitted['fromAmount']).toBe('0.5');
    expect(String(submitted['fromAmount'])).toMatch(/^\d+(\.\d{1,18})?$/);
  }, 10_000);

  it('shows the order id from the response, so the receipt is checkable', async () => {
    const { user } = await renderReady();
    await user.type(screen.getByLabelText(/you pay amount/i), '1');
    await user.click(await screen.findByRole('button', { name: /swap eth for usdc/i }));

    await screen.findByText(/order submitted/i, {}, { timeout: 5000 });
    const link = screen.getByRole('link', { name: /3f1e0e2c/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('/api/v1/swap-orders/'));
  }, 10_000);

  it('surfaces the service\'s own error message without clearing the form', async () => {
    server.use(
      http.post(`${API_BASE_URL}/api/v1/swap-orders`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'The request body or query failed validation',
              requestId: 'req-123',
            },
          },
          { status: 422 },
        ),
      ),
    );

    const { user } = await renderReady();
    await user.type(screen.getByLabelText(/you pay amount/i), '1');
    await user.click(await screen.findByRole('button', { name: /swap eth for usdc/i }));

    expect(await screen.findByText(/failed validation/i, {}, { timeout: 5000 })).toBeInTheDocument();
    // The amount survives, so the user can correct and resubmit.
    expect(screen.getByLabelText(/you pay amount/i)).toHaveValue('1');
  }, 10_000);

  it('says the funds are safe when the service is unreachable', async () => {
    server.use(http.post(`${API_BASE_URL}/api/v1/swap-orders`, () => HttpResponse.error()));

    const { user } = await renderReady();
    await user.type(screen.getByLabelText(/you pay amount/i), '1');
    await user.click(await screen.findByRole('button', { name: /swap eth for usdc/i }));

    expect(
      await screen.findByText(/your funds were not moved/i, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
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
