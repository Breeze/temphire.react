import { modals } from '@mantine/modals';
import { isValidElement, type ReactElement } from 'react';
import { vi } from 'vitest';

import { confirm, confirmYesNo, confirmYesNoCancel, openDialog } from './dialog.service';

/**
 * Cancelling a dialog is an answer, not an error: every dialog resolves with what the user chose.
 * Port of the Angular client's `core/services/dialog.service.spec.ts`.  (The first port threw
 * `DialogCancelledError`, so every caller needed a try/catch.)
 */
describe('dialog service', () => {
  /** The options of the dialog Mantine was last asked to open. */
  let opened: { children: unknown; onClose?: () => void };

  beforeEach(() => {
    vi.spyOn(modals, 'open').mockImplementation((options) => {
      opened = options as typeof opened;
      return 'dialog-1';
    });
    vi.spyOn(modals, 'close').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  /** Picks a button of the message box on screen, as `MessageBox` does through `onChoose`. */
  const choose = (value: string) => {
    const box = opened.children as ReactElement<{ onChoose: (v: string) => void }>;
    expect(isValidElement(box)).toBe(true);
    box.props.onChoose(value);
  };
  /** Closes the dialog without a result: the X, Escape or a click outside. */
  const dismiss = () => opened.onClose?.();

  it('resolves a message box with the button the user picked', async () => {
    const answer = confirmYesNoCancel('Save?');
    choose('no');
    expect(await answer).toBe('no');

    const ok = confirm('Discard?');
    choose('cancel');
    expect(await ok).toBe('cancel');
  });

  it('counts closing a message box as its cancel answer: Cancel, or No for Yes/No', async () => {
    const discard = confirm('Discard?');
    dismiss();
    expect(await discard).toBe('cancel');

    const save = confirmYesNoCancel('Save?');
    dismiss();
    expect(await save).toBe('cancel');

    const del = confirmYesNo('Delete?');
    dismiss();
    expect(await del).toBe('no');
  });

  it('resolves a component dialog with its result, or undefined when cancelled', async () => {
    let close!: (result?: { name: string }) => void;
    const named = openDialog<{ name: string }>((c) => {
      close = c;
      return null;
    });
    close({ name: 'Ann' });
    expect(await named).toEqual({ name: 'Ann' });

    const cancelled = openDialog<{ name: string }>(() => null);
    dismiss();
    expect(await cancelled).toBeUndefined();
  });
});
