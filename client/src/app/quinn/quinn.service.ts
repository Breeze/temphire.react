import { environment } from '../../environments/environment';
import { apiRequest, getJson } from '../core/services/api-fetch';
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
}

/** One line of the streamed answer from `api/agent/chat`. */
interface QuinnUpdate {
  readonly type: 'text' | 'people' | 'done' | 'error';
  readonly content?: string;
  readonly people?: readonly MentionedPerson[];
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
  /** Busy, and no answer streaming in yet: the model is still thinking or running tools. */
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
   * `done` at the end.  The pieces grow the answer as they arrive.
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
      } else if (update.type === 'done') {
        if (answerId === undefined) {
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
        .filter((m) => !m.intro && m.role !== 'error')
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
      this.knownPeople = people;
      this.set({ busy: false });

      // The answer cost something, and may have used up a budget; a refusal (429) means one is.
      void this.loadUsage();
    }
  }

  /** Replaces the snapshot with a changed copy and notifies the pane. */
  private set(changes: Partial<QuinnState>): void {
    const next = { ...this.state, ...changes };
    next.thinking = next.busy && !next.messages.some((m) => m.streaming);
    const now = new Date();
    next.quotaBlock = quotaBlock(next.usage ?? undefined, now);
    next.quotaMessage = next.quotaBlock ? quotaBlockMessage(next.quotaBlock, now) : null;
    this.state = next;
    this.notify();
  }

  private add(
    role: QuinnMessage['role'],
    content: string,
    flags: Pick<QuinnMessage, 'intro' | 'streaming' | 'people'> = {},
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
