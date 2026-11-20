import { ActionIcon, Textarea } from '@mantine/core';
import { IconHourglass, IconSend, IconX } from '@tabler/icons-react';
import { MouseEvent, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useAuth, useServices } from '../core/services/app-services';
import { renderAnswer } from './markdown';
import './Quinn.css';
import { EXAMPLE_QUESTIONS, QuinnConversation } from './quinn.service';
import { QuinnLogo } from './QuinnLogo';

/**
 * Quinn, the TempHire assistant: a round launcher button in the bottom right corner, and a chat
 * pane that slides in from the right.
 *
 * Port of the Angular client's `quinn/quinn.component.ts`.  The first time the pane opens, Quinn
 * introduces themselves and offers example questions; a click on one asks it.  Answers arrive as
 * Markdown; the people they mention become links to their records.  A link into the app closes the
 * pane and navigates there; any other link opens in a new tab.  Any other change of route - the
 * toolbar, the browser's back button - closes the pane as well, so it never covers the page the
 * user just went to.
 *
 * **Refs to DOM elements** - `useRef` plus a `ref={...}` attribute - replace Angular's
 * `viewChild(...)`; React fills `ref.current` with the element once it is in the page.
 *
 * **Effects after rendering.**  Angular used `afterRenderEffect` to scroll and focus once the DOM
 * had updated.  `useEffect` also runs after React has updated the DOM, so the effects below scroll
 * the newest message into view and put the cursor back in the question box.
 */
export function Quinn() {
  const { auth } = useServices();
  const session = useAuth();
  const navigate = useNavigate();
  const routerLocation = useLocation();

  // One conversation for the life of this component; see `QuinnConversation`.
  const [conversation] = useState(() => new QuinnConversation(auth.getState));
  const quinn = useSyncExternalStore(conversation.subscribe, conversation.getState);

  const [question, setQuestion] = useState('');
  const messageList = useRef<HTMLDivElement>(null);
  const questionBox = useRef<HTMLTextAreaElement>(null);

  // Quinn's name and model for the header, loaded once.
  useEffect(() => {
    void conversation.loadInfo();
  }, [conversation]);

  // The budget countdown: a tick every half minute while the pane exists, which also notices a
  // budget starting over.  The effect's clean-up stops the timer when the pane goes.
  useEffect(() => {
    const clock = setInterval(() => conversation.tick(), 30_000);
    return () => clearInterval(clock);
  }, [conversation]);

  // Escape closes the pane - the Angular `host: { '(document:keydown.escape)': ... }` listener.
  // An effect that adds a listener returns the function that removes it again.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        conversation.close();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [conversation]);

  // Every navigation closes the pane - the Angular version's `NavigationEnd` subscription in
  // `QuinnService`.  The location's `key` is new for every navigation, even to the same URL.
  useEffect(() => {
    conversation.close();
  }, [conversation, routerLocation.key]);

  // Keep the newest message in view.
  useEffect(() => {
    const list = messageList.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [quinn.messages, quinn.busy]);

  // The question box is disabled while Quinn answers, and a disabled element loses focus.  Once the
  // answer is in, put the cursor back - unless the user has moved on to something else meanwhile.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !quinn.busy && quinn.isOpen) {
      const focused = document.activeElement;
      if (!focused || focused === document.body || messageList.current?.contains(focused)) {
        questionBox.current?.focus();
      }
    }
    wasBusy.current = quinn.busy;
  }, [quinn.busy, quinn.isOpen]);

  // Opening the pane puts the cursor in the question box.  `preventScroll`, because the pane is
  // still sliding in from beyond the right edge.
  useEffect(() => {
    if (quinn.isOpen) {
      questionBox.current?.focus({ preventScroll: true });
    }
  }, [quinn.isOpen]);

  // A used-up budget stops Quinn: no questions until it starts over (see `QuinnConversation`).
  const blocked = !!quinn.quotaBlock;
  const canSend = !quinn.busy && !blocked && !!question.trim();

  function send(): void {
    if (!canSend) {
      return;
    }
    const text = question;
    setQuestion('');
    void conversation.ask(text);
  }

  /** A click on a link in a message: navigate within the app, or open other sites in a new tab. */
  function followLink(event: MouseEvent<HTMLDivElement>): void {
    const link = (event.target as Element).closest('a');
    if (!link?.href || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    event.preventDefault();
    const url = new URL(link.href);
    if (url.origin === location.origin) {
      conversation.close();
      void navigate(url.pathname + url.search + url.hash);
    } else {
      window.open(url.href, '_blank', 'noopener');
    }
  }

  return (
    <>
      {!quinn.isOpen && (
        <button
          type="button"
          className="quinn-launcher"
          aria-label="Chat with Quinn"
          title="Chat with Quinn"
          onClick={() => conversation.open()}
        >
          <QuinnLogo className="quinn-launcher__logo" />
        </button>
      )}

      <aside
        className={`quinn-pane${quinn.isOpen ? ' quinn-pane--open' : ''}`}
        inert={!quinn.isOpen}
        role="dialog"
        aria-label="Chat with Quinn"
      >
        <header className="quinn-pane__header">
          <QuinnLogo className="quinn-pane__logo" />
          <div className="quinn-pane__title">
            <strong>Quinn</strong>
            <span>
              {session.tenantName ?? quinn.info?.companyName ?? 'TempHire'}
              {quinn.info && ` · ${quinn.info.model}`}
            </span>
          </div>
          <ActionIcon
            variant="subtle"
            color="white"
            className="quinn-pane__close"
            aria-label="Close"
            onClick={() => conversation.close()}
          >
            <IconX size={18} />
          </ActionIcon>
        </header>

        <div className="quinn-pane__messages" ref={messageList} aria-live="polite" onClick={followLink}>
          {quinn.messages.map((message) => (
            // `key` on the outermost element of each item: a fragment can carry it too.
            <div key={message.id}>
              <div className={`quinn-message quinn-message--${message.role}`}>
                {message.role !== 'user' && <QuinnLogo className="quinn-message__avatar" />}
                <div
                  className="quinn-message__bubble quinn-md"
                  // Sanitized in `renderAnswer`; see there.
                  dangerouslySetInnerHTML={{ __html: renderAnswer(message.content, message.people) }}
                />
              </div>

              {message.intro && (
                <div className="quinn-examples">
                  {EXAMPLE_QUESTIONS.map((example) => (
                    <button
                      key={example.label}
                      type="button"
                      className="quinn-examples__chip"
                      disabled={quinn.busy || blocked}
                      onClick={() => void conversation.ask(example.question)}
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {quinn.thinking && (
            <div className="quinn-message quinn-message--assistant" aria-label="Quinn is thinking">
              <QuinnLogo className="quinn-message__avatar" />
              <div className="quinn-message__bubble quinn-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>

        {/* A used-up budget: no questions until it starts over, and how long that is. */}
        {quinn.quotaMessage && (
          <div className="quinn-quota" role="status">
            <IconHourglass size={16} className="quinn-quota__icon" aria-hidden="true" />
            <div>
              <p className="quinn-quota__text">{quinn.quotaMessage}</p>
              <button type="button" className="quinn-quota__link" onClick={() => void navigate('/usage')}>
                See your usage
              </button>
            </div>
          </div>
        )}

        <form
          className="quinn-pane__input"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <div className="quinn-pane__input-row">
            <Textarea
              ref={questionBox}
              className="quinn-pane__question"
              rows={2}
              placeholder="Ask Quinn about your staffing data..."
              aria-label="Your question"
              value={question}
              disabled={quinn.busy || blocked}
              onChange={(event) => setQuestion(event.currentTarget.value)}
              onKeyDown={(event) => {
                // Enter sends; Shift+Enter starts a new line.
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
            />
            <ActionIcon type="submit" size="lg" aria-label="Send" disabled={!canSend}>
              <IconSend size={18} />
            </ActionIcon>
          </div>
          <p className="quinn-pane__note">Quinn can make mistakes.</p>
        </form>
      </aside>
    </>
  );
}
