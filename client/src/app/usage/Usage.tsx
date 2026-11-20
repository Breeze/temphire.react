import { Alert, Badge, Button, Center, Loader, Progress } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { environment } from '../../environments/environment';
import { getJson } from '../core/services/api-fetch';
import { describe } from '../core/services/error-handler';
import { UsageDto, UsageMeterDto, UsagePeriodDto } from './usage.model';

import './Usage.css';

/** A meter, ready to show: the dollars and tokens, the share used, and how worried to look. */
export interface Meter {
  /** Dollars spent. */
  used: number;
  /** The dollar limit; none when null. */
  limit: number | null;
  tokens: number;
  /** 0-100, for the progress bar; 0 when there is no limit. */
  percent: number;
  level: 'ok' | 'warn' | 'over';
}

const PERIOD_TITLES: Record<UsagePeriodDto['period'], string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
};

/** The share at which a meter turns amber. */
const WARN_AT = 80;

/** Turns a meter from the server into what the page shows.  Same as the Angular client's. */
export function toMeter(meter: UsageMeterDto): Meter {
  if (meter.limit === null || meter.limit <= 0) {
    return { used: meter.used, limit: meter.limit, tokens: meter.tokens, percent: 0, level: 'ok' };
  }

  const percent = Math.min(100, (meter.used / meter.limit) * 100);
  return {
    used: meter.used,
    limit: meter.limit,
    tokens: meter.tokens,
    percent,
    level: meter.used >= meter.limit ? 'over' : percent >= WARN_AT ? 'warn' : 'ok',
  };
}

const BAR_COLORS: Record<Meter['level'], string> = { ok: 'temphire', warn: 'orange', over: 'red' };

// The Angular template formatted with pipes (`currency`, `number`, `date`); here plain `Intl`
// formatters do the same, created once.
const spent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 3 });
const budget = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const count = new Intl.NumberFormat('en-US');
const when = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * The usage page, from the user menu: what Quinn's answers cost the user and their company today,
 * this week and this month, in dollars against the budgets, with the tokens they took - model by
 * model, since each model has prices and budgets of its own (a local Ollama model typically costs
 * nothing and has no limits).  When a budget of the model Quinn uses is used up, Quinn refuses new
 * questions until it starts over.
 *
 * Port of the Angular client's `usage/usage.component.ts`.  The numbers are the server's
 * (`UsageController`); this page only shows them.  It reads them when it opens and on Refresh.
 *
 * **Loading data.**  Angular used `httpResource`, a signal that fetches whenever its URL changes
 * and has `reload()`.  React has no built-in equivalent, so the page keeps the result in state and
 * fetches in an effect.  Refresh bumps a counter that the effect depends on, which runs it again.
 * The `cancelled` flag drops an answer that arrives after the page has gone, or after a newer
 * request was started - the job `httpResource` did by itself.
 */
export function Usage() {
  const [usage, setUsage] = useState<UsageDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getJson<UsageDto>(environment.usageApiRoot)
      .then((result) => {
        if (!cancelled) {
          setUsage(result);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(describe(e).detail);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloads]);

  const company = usage?.companyName ?? 'Your company';

  return (
    <div className="usage">
      <header className="usage__header">
        <div>
          <h1 className="usage__title">Quinn usage</h1>
          <p className="usage__intro">
            What Quinn's answers cost, at each model's prices: the text sent to the model and the
            text it wrote, counted in tokens. When a budget is used up, Quinn takes no new questions
            until it starts over.
          </p>
        </div>
        <Button
          variant="outline"
          leftSection={<IconRefresh size={16} />}
          disabled={loading}
          onClick={() => {
            // Loading starts here, with the click, rather than in the effect: setting state in an
            // effect's body renders twice (React's `set-state-in-effect` lint rule).
            setLoading(true);
            setReloads((n) => n + 1);
          }}
        >
          Refresh
        </Button>
      </header>

      {error ? (
        <Alert color="red">{error}</Alert>
      ) : usage ? (
        usage.models.map((model) => (
          <section
            key={`${model.provider}/${model.model}`}
            className="usage__model"
            aria-label={`${model.provider} ${model.model}`}
          >
            <div className="usage__model-header">
              <h2 className="usage__model-name">
                {model.provider} <span className="usage__model-id">{model.model}</span>
              </h2>
              {model.isCurrent && <Badge tt="none" className="usage__tag--current">Quinn uses this now</Badge>}
              {model.isUnlimited && (
                <Badge tt="none" color="gray" variant="light">
                  No limits
                </Badge>
              )}
            </div>

            <div className="usage__periods">
              {model.periods.map((period) => (
                <section
                  key={period.period}
                  className="usage__period temphire-card"
                  aria-label={PERIOD_TITLES[period.period]}
                >
                  <h2 className="usage__period-title">{PERIOD_TITLES[period.period]}</h2>

                  {[
                    { who: 'You', meter: toMeter(period.user) },
                    { who: company, meter: toMeter(period.company) },
                  ].map(({ who, meter }) => (
                    <div key={who} className={`usage__meter usage__meter--${meter.level}`}>
                      <div className="usage__meter-label">
                        <span className="usage__who">{who}</span>
                        <span className="usage__numbers">
                          {meter.limit !== null
                            ? `${spent.format(meter.used)} of ${budget.format(meter.limit)}`
                            : model.isUnlimited
                              ? 'no limit'
                              : `${spent.format(meter.used)}, no limit`}
                        </span>
                      </div>
                      <span className="usage__tokens">{count.format(meter.tokens)} tokens</span>
                      {meter.limit !== null && (
                        <Progress
                          value={meter.percent}
                          color={BAR_COLORS[meter.level]}
                          aria-label={`${who}: ${Math.round(meter.percent)}% used`}
                        />
                      )}
                    </div>
                  ))}

                  {!model.isUnlimited && (
                    <p className="usage__resets">
                      Starts over {when.format(new Date(period.resetsAt))}{' '}
                      <span className="usage__utc">(midnight UTC)</span>
                    </p>
                  )}
                </section>
              ))}
            </div>
          </section>
        ))
      ) : (
        <Center p="xl">
          <Loader aria-label="Loading usage" />
        </Center>
      )}
    </div>
  );
}
