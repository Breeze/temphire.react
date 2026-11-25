import { Button } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

import type { MentionedPerson } from './link-people';
import { renderAnswer } from './markdown';
import type { QuinnQuestion as Question } from './quinn.service';

/**
 * A tool's question in the chat pane: the question, its choices as radio buttons, and OK, or with
 * no choices, Confirm; and Cancel.  The answer goes to the tool that asked (see `QuinnConversation.answer`),
 * not to Quinn.  Once answered, the buttons give way to what the user did.
 *
 * Port of the question card in the Angular client's `quinn/quinn.component.html`, where it is
 * part of the pane's template; here it is a component of its own, with plain props.
 */
export function QuinnQuestion({
  content,
  people,
  question,
  onSelect,
  onAnswer,
}: {
  /** The question, in Markdown. */
  content: string;
  people?: readonly MentionedPerson[];
  question: Question;
  onSelect: (value: string) => void;
  onAnswer: (accept: boolean) => void;
}) {
  // Memoized by the React Compiler: plain values only (README, "The React Compiler").
  'use memo';

  const isChoice = !!question.choices?.length;
  const open = question.state === 'open';

  return (
    <form
      className="quinn-message__bubble quinn-question"
      aria-label={isChoice ? 'Choose one' : 'Confirm'}
      onSubmit={(event) => {
        event.preventDefault();
        onAnswer(true);
      }}
    >
      <div
        className="quinn-md"
        // Sanitized in `renderAnswer`; see there.
        dangerouslySetInnerHTML={{ __html: renderAnswer(content, people) }}
      />

      {isChoice && (
        <fieldset className="quinn-question__choices" disabled={!open}>
          {question.choices!.map((choice) => (
            <label key={choice.value} className="quinn-question__choice">
              <input
                type="radio"
                name={`quinn-question-${question.id}`}
                value={choice.value}
                checked={question.selected === choice.value}
                onChange={() => onSelect(choice.value)}
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="quinn-question__actions">
        {question.state === 'accepted' ? (
          <span className="quinn-question__status">
            <IconCheck size={14} aria-hidden="true" /> {isChoice ? 'Chosen' : 'Confirmed'}
          </span>
        ) : question.state === 'cancelled' ? (
          <span className="quinn-question__status">Cancelled</span>
        ) : question.state === 'closed' ? (
          <span className="quinn-question__status">No longer open</span>
        ) : (
          <>
            <Button type="submit" size="xs" disabled={!open || (isChoice && !question.selected)}>
              {isChoice ? 'OK' : 'Confirm'}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="default"
              disabled={!open}
              onClick={() => onAnswer(false)}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
