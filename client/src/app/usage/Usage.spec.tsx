import { screen } from '@testing-library/react';
import { vi } from 'vitest';

import { environment } from '../../environments/environment';
import { setTokenSource } from '../core/services/api-fetch';
import { renderWithMantine } from '../../test-utils';
import { Usage, toMeter } from './Usage';
import { UsageDto, UsagePeriodDto } from './usage.model';

/** Port of the Angular client's `usage/usage.component.spec.ts`. */
describe('toMeter', () => {
  it('turns amber from 80% and red when the budget is used up', () => {
    expect(toMeter({ used: 5, limit: 10, tokens: 2000 })).toEqual({
      used: 5,
      limit: 10,
      tokens: 2000,
      percent: 50,
      level: 'ok',
    });
    expect(toMeter({ used: 8, limit: 10, tokens: 0 }).level).toBe('warn');
    expect(toMeter({ used: 10, limit: 10, tokens: 0 }).level).toBe('over');
  });

  it('never fills the bar past 100%', () => {
    expect(toMeter({ used: 15, limit: 10, tokens: 0 }).percent).toBe(100);
  });

  it('has no bar without a limit', () => {
    expect(toMeter({ used: 0, limit: null, tokens: 123456 }).percent).toBe(0);
  });
});

describe('Usage', () => {
  const period = (
    name: UsagePeriodDto['period'],
    used: number,
    limit: number | null,
    tokens: number,
  ): UsagePeriodDto => ({
    period: name,
    start: '2026-11-18',
    end: '2026-11-19',
    resetsAt: '2026-11-19T00:00:00+00:00',
    user: { used, limit, tokens },
    company: { used: used * 2, limit: limit === null ? null : limit * 3, tokens: tokens * 2 },
  });

  const usage: UsageDto = {
    companyName: 'Harbor Staffing',
    models: [
      {
        provider: 'Claude',
        model: 'claude-sonnet-5-5',
        isCurrent: true,
        isUnlimited: false,
        periods: [
          period('day', 0.425, 0.5, 33000),
          period('week', 0.425, 1.25, 33000),
          period('month', 0.425, 3, 33000),
        ],
      },
      {
        provider: 'Ollama',
        model: 'qwen3:4b-instruct',
        isCurrent: false,
        isUnlimited: true,
        periods: [period('day', 0, null, 7000), period('week', 0, null, 7000), period('month', 0, null, 7000)],
      },
    ],
  };

  beforeEach(() => {
    setTokenSource(null);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(url).toBe(environment.usageApiRoot);
        return new Response(JSON.stringify(usage));
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows each model, the current one first, in dollars with the tokens', async () => {
    renderWithMantine(<Usage />);

    const claude = await screen.findByRole('region', { name: 'Claude claude-sonnet-5-5' });
    const models = screen.getAllByRole('region', { name: /claude-sonnet-5-5|qwen3/ });
    expect(models.map((m) => m.getAttribute('aria-label'))).toEqual([
      'Claude claude-sonnet-5-5',
      'Ollama qwen3:4b-instruct',
    ]);
    expect(claude).toHaveTextContent('Quinn uses this now');
    expect(claude).toHaveTextContent('Harbor Staffing');
    expect(claude).toHaveTextContent('$0.425 of $0.50');
    expect(claude).toHaveTextContent('33,000 tokens');
  });

  it('warns when a budget is nearly used up', async () => {
    renderWithMantine(<Usage />);

    const claude = await screen.findByRole('region', { name: 'Claude claude-sonnet-5-5' });
    expect(claude.querySelector('.usage__meter--warn')).toHaveTextContent('You');
  });

  it('shows an unlimited model with its tokens, without bars or reset times', async () => {
    renderWithMantine(<Usage />);

    const ollama = await screen.findByRole('region', { name: 'Ollama qwen3:4b-instruct' });
    expect(ollama).toHaveTextContent('No limits');
    expect(ollama).toHaveTextContent('7,000 tokens');
    expect(ollama).not.toHaveTextContent('$');
    expect(ollama.querySelector('[role="progressbar"]')).toBeNull();
    expect(ollama.querySelector('.usage__resets')).toBeNull();
  });
});
