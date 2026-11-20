import { vi } from 'vitest';

import { environment } from '../../environments/environment';
import { setTokenSource } from '../core/services/api-fetch';
import { QuinnConversation } from './quinn.service';

/**
 * Port of the Angular client's `quinn/quinn.service.spec.ts`.  The answer is streamed through a
 * stand-in for `fetch`, whose `Response` body is a real stream, as the browser's is.
 */
describe('QuinnConversation', () => {
  let quinn: QuinnConversation;

  /** A streamed answer, as `api/agent/chat` sends it: one JSON object per line. */
  const stream = (...updates: object[]) => updates.map((u) => JSON.stringify(u)).join('\n') + '\n';

  async function ask(question: string, response: string): Promise<void> {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(url).toBe(`${environment.agentApiRoot}/chat`);
        return new Response(response);
      }),
    );
    await quinn.ask(question);
  }

  const lastAnswer = () =>
    quinn
      .getState()
      .messages.filter((m) => m.role === 'assistant')
      .at(-1)!;

  beforeEach(() => {
    setTokenSource(null);
    quinn = new QuinnConversation(() => ({
      username: 'anna@harbor.test',
      tenantName: 'Harbor Staffing',
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('streams the text of an answer, with the people it can mention', async () => {
    await ask(
      'Who knows SQL?',
      stream(
        { type: 'people', people: [{ name: 'Mia I Gallagher', id: 'm1' }] },
        { type: 'text', content: 'Mia I Gall' },
        { type: 'text', content: 'agher knows SQL.' },
        { type: 'done' },
      ),
    );

    expect(lastAnswer()).toEqual(
      expect.objectContaining({
        content: 'Mia I Gallagher knows SQL.',
        streaming: false,
        people: [{ name: 'Mia I Gallagher', id: 'm1' }],
      }),
    );
  });

  // A follow-up answer names people from an earlier one without the tools returning them again.
  it('keeps the people from earlier answers for follow-up questions', async () => {
    await ask(
      'Who knows SQL?',
      stream(
        { type: 'people', people: [{ name: 'Mia I Gallagher', id: 'm1' }] },
        { type: 'text', content: 'Mia I Gallagher knows SQL.' },
        { type: 'done' },
      ),
    );

    await ask(
      'What other skills do they have?',
      stream(
        { type: 'people', people: [{ name: 'Yasmin S Kowalski', id: 'y1' }] },
        { type: 'text', content: 'Yasmin S Kowalski: Agile. Mia I Gallagher: Power BI.' },
        { type: 'done' },
      ),
    );

    expect(lastAnswer().people).toEqual([
      { name: 'Mia I Gallagher', id: 'm1' },
      { name: 'Yasmin S Kowalski', id: 'y1' },
    ]);
  });

  it('links earlier people even when a follow-up calls no tools at all', async () => {
    await ask(
      'Who knows SQL?',
      stream(
        { type: 'people', people: [{ name: 'Mia I Gallagher', id: 'm1' }] },
        { type: 'text', content: 'Mia I Gallagher knows SQL.' },
        { type: 'done' },
      ),
    );

    await ask(
      'Where is she based?',
      stream({ type: 'text', content: 'Mia I Gallagher is in Boston.' }, { type: 'done' }),
    );

    expect(lastAnswer().people).toEqual([{ name: 'Mia I Gallagher', id: 'm1' }]);
  });

  it('introduces itself to the signed-in user', () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ companyName: null, models: [] }))));
    quinn.open();

    expect(quinn.getState().messages[0].content).toMatch(/^Hi Anna!.*Harbor Staffing/s);
  });

  describe('budgets', () => {
    /** `GET api/usage` with the user's daily Claude budget at `used` of $0.50. */
    const usage = (used: number) => ({
      companyName: 'Harbor Staffing',
      models: [
        {
          provider: 'Claude',
          model: 'claude-sonnet-5-5',
          isCurrent: true,
          isUnlimited: false,
          periods: [
            {
              period: 'day',
              start: '',
              end: '',
              resetsAt: new Date(Date.now() + 90 * 60_000).toISOString(),
              user: { used, limit: 0.5, tokens: 0 },
              company: { used, limit: 1.5, tokens: 0 },
            },
          ],
        },
      ],
    });

    function serve(used: number) {
      const fetch = vi.fn(async (url: string) => {
        expect(url).toBe(environment.usageApiRoot);
        return new Response(JSON.stringify(usage(used)));
      });
      vi.stubGlobal('fetch', fetch);
      return fetch;
    }

    it('reads the usage when the pane opens, and is not blocked with budget left', async () => {
      serve(0.2);

      quinn.open();
      await quinn.loadUsage();

      expect(quinn.getState().usage?.companyName).toBe('Harbor Staffing');
      expect(quinn.getState().quotaBlock).toBeNull();
      expect(quinn.getState().quotaMessage).toBeNull();
    });

    it('says which budget is used up and how long to wait, and asks nothing meanwhile', async () => {
      const fetch = serve(0.5);

      quinn.open();
      await quinn.loadUsage();
      fetch.mockClear();

      expect(quinn.getState().quotaMessage).toBe(
        "You've used up your daily Quinn allowance ($0.50). You can ask again in 1 hour and 30 minutes.",
      );

      await quinn.ask('Who knows SQL?');

      expect(fetch).not.toHaveBeenCalled();
      expect(quinn.getState().messages.filter((m) => m.role === 'user')).toEqual([]);
    });
  });
});
