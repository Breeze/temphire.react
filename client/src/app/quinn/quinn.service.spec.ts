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
  describe('questions from a tool', () => {
    const choices = [
      { value: 'home', label: 'Home Address: 1 Main St, Seattle, WA 98101' },
      { value: 'work', label: 'Work Address: 200 Pine St, Portland, OR 97204' },
    ];

    /** The answers posted to `api/agent/answer`, and how the server replies to them. */
    let answers: unknown[];
    let answerStatus: number;

    /**
     * Starts a question with an answer stream that stays open: `send` streams more lines, `finish`
     * ends it.  The answers to the tool's questions go to `api/agent/answer` meanwhile.
     */
    function start(...updates: object[]) {
      answers = [];
      answerStatus = 200;
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      const body = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
      const encoder = new TextEncoder();
      const send = (...more: object[]) => controller.enqueue(encoder.encode(stream(...more)));

      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init: RequestInit) => {
          if (url === `${environment.agentApiRoot}/answer`) {
            answers.push(JSON.parse(init.body as string));
            return new Response(null, { status: answerStatus });
          }
          expect(url).toBe(`${environment.agentApiRoot}/chat`);
          return new Response(body);
        }),
      );

      const answered = quinn.ask("Change Ann Lee's address to 12 Elm St, Tacoma");
      send(...updates);
      return {
        answered,
        finish: (...more: object[]) => {
          send(...more);
          controller.close();
          return answered;
        },
      };
    }

    const question = () => quinn.getState().messages.find((m) => m.question)!;

    /** Lets the stream's lines arrive. */
    const settle = () => vi.waitFor(() => expect(question()).toBeDefined());

    it('shows a choice, and sends the choice the user makes to the tool', async () => {
      const { finish } = start(
        { type: 'text', content: 'Let me check.' },
        { type: 'input', id: 'q1', content: '**Ann Lee** has 2 addresses. Which one?', choices },
      );
      await settle();

      expect(question()).toEqual(
        expect.objectContaining({
          content: '**Ann Lee** has 2 addresses. Which one?',
          question: { id: 'q1', choices, state: 'open' },
        }),
      );
      // Waiting for the user, not for the model.
      expect(quinn.getState().thinking).toBe(false);

      // OK needs a choice first.
      await quinn.answer(question().id, true);
      expect(answers).toEqual([]);

      quinn.select(question().id, 'work');
      await quinn.answer(question().id, true);

      expect(answers).toEqual([{ id: 'q1', accept: true, choice: 'work' }]);
      expect(question().question).toEqual(
        expect.objectContaining({ state: 'accepted', selected: 'work' }),
      );
      expect(quinn.getState().thinking).toBe(true);

      await finish({ type: 'text', content: 'Now the new address.' }, { type: 'done' });

      // The text before the question, the question, and the text after it, in that order.
      expect(
        quinn
          .getState()
          .messages.filter((m) => m.role === 'assistant')
          .map((m) => m.content),
      ).toEqual([
        'Let me check.',
        '**Ann Lee** has 2 addresses. Which one?',
        'Now the new address.',
      ]);
    });

    it('sends a confirmation or a cancellation, without a choice', async () => {
      const { finish } = start({ type: 'input', id: 'q2', content: 'Update **Ann Lee**?' });
      await settle();

      await quinn.answer(question().id, false);

      expect(answers).toEqual([{ id: 'q2', accept: false }]);
      expect(question().question?.state).toBe('cancelled');
      await finish({ type: 'text', content: 'Nothing was changed.' }, { type: 'done' });
    });

    it('closes a question that can no longer be answered', async () => {
      const { finish } = start({ type: 'input', id: 'q3', content: 'Update **Ann Lee**?' });
      await settle();

      await finish(
        { type: 'inputClosed', id: 'q3' },
        { type: 'text', content: 'Nothing was changed.' },
        { type: 'done' },
      );

      expect(question().question?.state).toBe('closed');
      await quinn.answer(question().id, true);
      expect(answers).toEqual([]);
    });

    it('shows a question the server no longer has as closed', async () => {
      const { finish } = start({ type: 'input', id: 'q4', content: 'Update **Ann Lee**?' });
      await settle();
      answerStatus = 404;

      await quinn.answer(question().id, true);

      expect(question().question?.state).toBe('closed');
      await finish({ type: 'done' });
    });

    it('leaves the questions out of the conversation it sends', async () => {
      const { finish } = start({ type: 'input', id: 'q5', content: 'Update **Ann Lee**?' });
      await settle();
      await finish(
        { type: 'inputClosed', id: 'q5' },
        { type: 'text', content: 'Nothing was changed.' },
        { type: 'done' },
      );

      let sent: unknown;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: string, init: RequestInit) => {
          sent = JSON.parse(init.body as string);
          return new Response(
            stream({ type: 'text', content: 'You are welcome.' }, { type: 'done' }),
          );
        }),
      );
      await quinn.ask('Thanks');

      expect(sent).toEqual({
        messages: [
          { role: 'user', content: "Change Ann Lee's address to 12 Elm St, Tacoma" },
          { role: 'assistant', content: 'Nothing was changed.' },
          { role: 'user', content: 'Thanks' },
        ],
      });
    });
  });
});
