import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';

import type { QuinnQuestion as Question } from './quinn.service';
import { QuinnQuestion } from './QuinnQuestion';

/** A tool's question in the chat pane: the choices, the buttons, and what the user did. */
describe('QuinnQuestion', () => {
  const choices = [
    { value: 'home', label: 'Home Address: 1 Main St, Seattle, WA 98101' },
    { value: 'work', label: 'Work Address: 200 Pine St, Portland, OR 97204' },
  ];

  const content = '**Ann Lee** has 2 addresses. Which one?';

  function renderQuestion(question: Question) {
    const onSelect = vi.fn();
    const onAnswer = vi.fn();
    const view = (q: Question) => (
      <MantineProvider>
        <QuinnQuestion content={content} question={q} onSelect={onSelect} onAnswer={onAnswer} />
      </MantineProvider>
    );
    const { rerender } = render(view(question));
    return { onSelect, onAnswer, update: (q: Question) => rerender(view(q)) };
  }

  it('offers the choices as radio buttons, with OK once one is selected', () => {
    const { onSelect, onAnswer, update } = renderQuestion({ id: 'q1', choices, state: 'open' });

    expect(screen.getByText('Ann Lee')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: choices[1].label }));
    expect(onSelect).toHaveBeenCalledWith('work');

    update({ id: 'q1', choices, state: 'open', selected: 'work' });
    expect(screen.getByRole('radio', { name: choices[1].label })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onAnswer).toHaveBeenCalledWith(true);
  });

  it('asks for a confirmation with Confirm and Cancel', () => {
    const { onAnswer } = renderQuestion({ id: 'q2', state: 'open' });

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onAnswer).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onAnswer).toHaveBeenCalledWith(true);
  });

  it('shows what the user did once answered, without buttons', () => {
    renderQuestion({ id: 'q1', choices, state: 'accepted', selected: 'work' });

    expect(screen.getByText('Chosen')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: choices[1].label })).toBeDisabled();
  });
});
