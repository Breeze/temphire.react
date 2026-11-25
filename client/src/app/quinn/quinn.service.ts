import { environment } from '../../environments/environment';
import { HttpError, apiRequest, getJson } from '../core/services/api-fetch';
import { ChangeNotifier } from '../core/services/change-notifier';
import { describe } from '../core/services/error-handler';
import { QuotaBlock, UsageDto, quotaBlock, quotaBlockMessage } from '../usage/usage.model';
import { MentionedPerson, mergePeople } from './link-people';

/** One message in the conversation.  `content` is Markdown, as Quinn wrote it. */
export interface QuinnMessage {
  readonly id: number;
  readonly role: 'user' | 'assistant' | 'error';
  readonly content: string;
  /** Quinn's introduction: shown, but not sent to the server as part of the conversation. */
  readonly intro?: boolean;
  /** An answer still streaming in. */
  readonly streaming?: boolean;
  /**
   * The people an answer can mention, from the server.  Their names are linked to their records
   * when the answer is shown; `content` itself stays as Quinn wrote it.
   */
  readonly people?: readonly MentionedPerson[];
  /**
   * A question a tool asks the user while Quinn answers, such as which address to change or
   * whether to save the change.  `content` is the question; the pane adds the choices and the
   * buttons.  Not sent to the server as part of the conversation: the answer goes to the tool.
   */
  readonly question?: QuinnQuestion;
}

/**
 * A question from a tool (MCP elicitation, see `QuinnAgent` on the server): pick one of the
 * choices and OK, or with no choices, Confirm; or Cancel.  The answer goes to
 * `api/agent/answer`, and from there to the tool, not to the model.
 */
export interface QuinnQuestion {
  readonly id: string;
  /** The choices, as radio buttons; none for a confirmation. */
  readonly choices?: readonly QuinnChoice[];
  /** The choice selected so far, and then the one answered with. */
  readonly selected?: string;
  /**
   * `open` until answered; `sending` while the answer is on its way; then `accepted` (OK or
   * Confirm) or `cancelled`; or `closed` if it can no longer be answered (it timed out, or the
   * answer ended).
   */
  readonly state: 'open' | 'sending' | 'accepted' | 'cancelled' | 'closed';
}

/** One choice of a question: the value to answer with, and what the user sees. */
export interface QuinnChoice {
  readonly value: string;
  readonly label: string;
}

/** One line of the streamed answer from `api/agent/chat`. */
interface QuinnUpdate {
  readonly type: 'text' | 'people' | 'input' | 'inputClosed' | 'done' | 'error';
  readonly content?: string;
  readonly people?: readonly MentionedPerson[];
  /** The question's id, for `input` and `inputClosed`. */
  readonly id?: string;
  readonly choices?: readonly QuinnChoice[];
}

/** An example question offered under the introduction. */
export interface ExampleQuestion {
  readonly label: string;
  readonly question: string;
}

/** `GET api/agent/info`: who answers. */
export interface AgentInfo {
  name: string;
  model: string;
  companyName: string;
}

export const EXAMPLE_QUESTIONS: readonly ExampleQuestion[] = [
  { label: 'Who knows SQL?', question: 'Who knows SQL?' },
  {
    label: 'How many people in each state?',
    question: 'How many staffing resources do we have in each state?',
  },
  { label: 'Average hourly rate per skill', question: "What's the average hourly rate per skill?" },
  { label: 'Who has the highest hourly rate?', question: 'Who has the highest hourly rate?' },
  { label: 'Who has been a project manager?', question: 'Who has worked as a project manager?' },
  { label: 'Ask me about my name', question: 'Tell me about your name. Where does it come from?' },
];

/** What the pane shows: one immutable snapshot, replaced on every change (see `ChangeNotifier`). */
export interface QuinnState {
  readonly messages: readonly QuinnMessage[];
  readonly isOpen: boolean;
  readonly busy: boolean;
  /**
   * Busy, no answer streaming in yet, and no question waiting for the user: the model is still
   * thinking or running tools.
   */
  readonly thinking: boolean;
  readonly info: AgentInfo | null;
  /** `GET api/usage`: where the user and company stand with Quinn's budgets; null until read. */
  readonly usage: UsageDto | null;
  /** The used-up budget that stops Quinn now, if any; see `tick`. */
  readonly quotaBlock: QuotaBlock | null;
  /** What the pane says while a budget stops Quinn, with how long until it starts over. */
  readonly quotaMessage: string | null;
}

/**
 * The conversation with Quinn.
 *
 * Port of the Angular client's `quinn/quinn.service.ts`.  Angular provided it in `QuinnComponent`
 * (`providers: [QuinnService]`), so the conversation lived and died with the pane.  Here `Quinn`
 * creates one with `useState(() => new QuinnConversation(...))` - the function form runs once, on
 * the first render, and React keeps the instance for the life of the component - and reads its
 * state with `useSyncExternalStore`.  The shell renders `Quinn` only while someone is signed in, so
 * signing out discards the conversation, as before.
 *
 * The agent runs on the server (`AgentController`).  This sends the conversation so far and adds
 * Quinn's answer; the server keeps no chat state.
 */
export class QuinnConversation extends ChangeNotifier {
  private nextId = 1;
  private state: QuinnState = {
    messages: [],
    isOpen: false,
    busy: false,
    thinking: false,
    info: null,
    usage: null,
    quotaBlock: null,
    quotaMessage: null,
  };

  /** Whether the usage has been asked for: only once the pane has opened, for users who use Quinn. */
  private usageWanted = false;

  /**
   * Everyone the answers so far could mention.  A follow-up answer often names people from an
   * earlier one ("What other skills do they have?") without the tools returning them again, so
   * each answer is linked with these as well as its own.
   */
  private knownPeople: readonly MentionedPerson[] = [];

  /**
   * @param user who is signed in, for the introduction: their name and company.
   */
  constructor(private readonly user: () => { username: string | null; tenantName: string | null }) {
    super();
  }

  readonly getState = (): QuinnState => this.state;

  /** Loads Quinn's name and model, once; the pane shows them in its header. */
  async loadInfo(): Promise<void> {
    if (this.state.info) {
      return;
    }
    try {
      const info = await getJson<AgentInfo>(`${environment.agentApiRoot}/info`);
      this.set({ info });
    } catch {
      // The header just leaves the model out.
    }
  }

  open(): void {
    // The first time the pane opens, Quinn introduces themselves.
    if (this.state.messages.length === 0) {
      this.add('assistant', this.introduction(), { intro: true });
    }
    this.set({ isOpen: true });

    // Where the budgets stand: read each time the pane opens, since the user may have asked
    // elsewhere - another tab - meanwhile.
    this.usageWanted = true;
    void this.loadUsage();
  }

  // ------------------------------------------------------------------------------------------
  // Budgets
  //
  // The server refuses a question while a budget of the model Quinn uses is used up (429, with a
  // message saying which and for how long).  The pane says so before the user asks: the usage is
  // read when the pane opens and after every answer, and while a budget stops Quinn, `tick` - every
  // half minute, from the pane - keeps the countdown current and reads the usage again once the
  // budget starts over.  Angular derived all this with `computed` signals; here the snapshot
  // carries it, worked out again by `set` on every change.
  // ------------------------------------------------------------------------------------------

  /** Reads `GET api/usage`.  A failure leaves the last figures: the server has the final say anyway. */
  async loadUsage(): Promise<void> {
    if (!this.usageWanted) {
      return;
    }
    try {
      this.set({ usage: await getJson<UsageDto>(environment.usageApiRoot) });
    } catch {
      // Nothing to show; the server still refuses a question over budget.
    }
  }

  /** Updates the countdown, and reads the usage again once a blocking budget has started over. */
  tick(): void {
    const block = this.state.quotaBlock;
    this.set({});
    if (block && new Date() >= block.resetsAt) {
      void this.loadUsage();
    }
  }

  close(): void {
    this.set({ isOpen: false });
  }

  /**
   * Sends a question and adds Quinn's answer as it streams in, or an error message.
   *
   * The server answers with one JSON object per line (see `AgentController.Chat`): `text` pieces
   * as the model writes them, the `people` the answer can mention as the tools return them, and
   * `done` at the end.  The pieces grow the answer as they arrive.  A tool may ask the user
   * something on the way (`input`): it becomes a message of its own, with the question, and the
   * text after it a new message below it, once the user has answered (see `answer`).
   *
   * Angular read the lines from `HttpClient`'s download progress events.  Without `HttpClient`, the
   * response body is a stream: `response.body.getReader()` hands out the bytes as they arrive, and
   * a `TextDecoder` turns them into text.
   */
  async ask(question: string): Promise<void> {
    const text = question.trim();
    if (!text || this.state.busy || this.state.quotaBlock) {
      return;
    }

    this.add('user', text);
    this.set({ busy: true });

    let answerId: number | undefined;
    // The people this answer can mention: those from earlier answers, plus those the tools return
    // now.  They usually arrive before the first text, when there is no answer to attach them to yet.
    let people = this.knownPeople;
    let pending = '';
    // Whether a tool asked the user something: then an answer without text of its own is fine.
    let asked = false;

    const handle = (line: string) => {
      if (!line.trim()) {
        return;
      }
      const update = JSON.parse(line) as QuinnUpdate;

      if (update.type === 'text') {
        if (answerId === undefined) {
          answerId = this.add('assistant', update.content ?? '', { streaming: true, people });
        } else {
          this.change(answerId, (m) => ({ ...m, content: m.content + (update.content ?? '') }));
        }
      } else if (update.type === 'people') {
        people = mergePeople(this.knownPeople, update.people ?? []);
        if (answerId !== undefined) {
          this.change(answerId, (m) => ({ ...m, people }));
        }
      } else if (update.type === 'input' && update.id) {
        // The text so far is complete; what Quinn writes after the user answers goes below the question.
        if (answerId !== undefined) {
          this.change(answerId, (m) => ({ ...m, content: m.content.trim(), streaming: false }));
          answerId = undefined;
        }
        asked = true;
        this.add('assistant', update.content ?? '', {
          people,
          question: { id: update.id, choices: update.choices, state: 'open' },
        });
      } else if (update.type === 'inputClosed') {
        this.closeQuestions((q) => q.id === update.id);
      } else if (update.type === 'done') {
        if (answerId === undefined && asked) {
          // Nothing more to say.
        } else if (answerId === undefined) {
          answerId = this.add('assistant', "Sorry, I don't have an answer for that.");
        } else {
          this.change(answerId, (m) => ({ ...m, content: m.content.trim(), streaming: false }));
        }
      } else if (update.type === 'error') {
        this.discard(answerId);
        answerId = undefined;
        this.add('error', update.content ?? 'Quinn ran into a problem answering that.');
      }
    };

    try {
      const conversation = this.state.messages
        .filter((m) => !m.intro && !m.question && m.role !== 'error')
        .map(({ role, content }) => ({ role, content }));

      const response = await apiRequest(`${environment.agentApiRoot}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        lines.forEach(handle);
      }
      handle(pending + decoder.decode());
    } catch (error) {
      this.discard(answerId);
      this.add('error', describe(error).detail);
    } finally {
      // A stream cut off before `done` leaves the text so far; stop showing it as in progress.
      if (answerId !== undefined) {
        this.change(answerId, (m) => ({ ...m, streaming: false }));
      }
      // A question still waiting can't be answered once the answer has ended.
      this.closeQuestions(() => true);
      this.knownPeople = people;
      this.set({ busy: false });

      // The answer cost something, and may have used up a budget; a refusal (429) means one is.
      void this.loadUsage();
    }
  }

  /** Selects one of a question's choices, before OK. */
  select(messageId: number, value: string): void {
    this.changeQuestion(messageId, (q) => (q.state === 'open' ? { ...q, selected: value } : q));
  }

  /**
   * Answers a question: OK (with the selected choice) or Confirm when `accept`, otherwise Cancel.
   * The answer goes to the tool that asked; Quinn's answer then goes on in the stream.  A question
   * that can no longer be answered (404) is shown as closed.
   */
  async answer(messageId: number, accept: boolean): Promise<void> {
    const question = this.state.messages.find((m) => m.id === messageId)?.question;
    if (
      !question ||
      question.state !== 'open' ||
      (accept && question.choices?.length && !question.selected)
    ) {
      return;
    }

    this.changeQuestion(messageId, (q) => ({ ...q, state: 'sending' }));
    try {
      await apiRequest(`${environment.agentApiRoot}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: question.id,
          accept,
          choice: accept ? question.selected : undefined,
        }),
      });
      this.changeQuestion(messageId, (q) => ({ ...q, state: accept ? 'accepted' : 'cancelled' }));
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        this.changeQuestion(messageId, (q) => ({ ...q, state: 'closed' }));
      } else {
        this.changeQuestion(messageId, (q) => ({ ...q, state: 'open' }));
        this.add('error', describe(error).detail);
      }
    }
  }

  /** Marks the questions still waiting for the user that match as closed. */
  private closeQuestions(matches: (question: QuinnQuestion) => boolean): void {
    this.set({
      messages: this.state.messages.map((m) =>
        m.question &&
        (m.question.state === 'open' || m.question.state === 'sending') &&
        matches(m.question)
          ? { ...m, question: { ...m.question, state: 'closed' } }
          : m,
      ),
    });
  }

  private changeQuestion(
    messageId: number,
    update: (question: QuinnQuestion) => QuinnQuestion,
  ): void {
    this.change(messageId, (m) => (m.question ? { ...m, question: update(m.question) } : m));
  }

  /** Replaces the snapshot with a changed copy and notifies the pane. */
  private set(changes: Partial<QuinnState>): void {
    const next = { ...this.state, ...changes };
    next.thinking =
      next.busy &&
      !next.messages.some(
        (m) => m.streaming || m.question?.state === 'open' || m.question?.state === 'sending',
      );
    const now = new Date();
    next.quotaBlock = quotaBlock(next.usage ?? undefined, now);
    next.quotaMessage = next.quotaBlock ? quotaBlockMessage(next.quotaBlock, now) : null;
    this.state = next;
    this.notify();
  }

  private add(
    role: QuinnMessage['role'],
    content: string,
    flags: Pick<QuinnMessage, 'intro' | 'streaming' | 'people' | 'question'> = {},
  ): number {
    const id = this.nextId++;
    this.set({ messages: [...this.state.messages, { id, role, content, ...flags }] });
    return id;
  }

  private change(id: number, update: (message: QuinnMessage) => QuinnMessage): void {
    this.set({ messages: this.state.messages.map((m) => (m.id === id ? update(m) : m)) });
  }

  private discard(id: number | undefined): void {
    if (id !== undefined) {
      this.set({ messages: this.state.messages.filter((m) => m.id !== id) });
    }
  }

  private introduction(): string {
    const { username, tenantName } = this.user();
    const first = (username ?? '').split('@')[0];
    const greeting = first ? `Hi ${first.charAt(0).toUpperCase()}${first.slice(1)}!` : 'Hi!';
    const company = tenantName ?? this.state.info?.companyName ?? 'your company';

    return (
      `${greeting} I'm **Quinn**, your TempHire assistant.\n\n` +
      `I can look things up in **${company}**'s staffing data for you: who has which skills, ` +
      `where people are based, their rates and their work history. Try one of these, or ask me anything.\n\n` +
      `Curious where my name comes from? *Ask me about my name.*`
    );
  }
}
