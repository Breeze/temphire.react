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
    quinn.open();

    expect(quinn.getState().messages[0].content).toMatch(/^Hi Anna!.*Harbor Staffing/s);
  });
});
