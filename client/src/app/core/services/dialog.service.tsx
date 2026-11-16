import { modals } from '@mantine/modals';
import { ReactNode } from 'react';

import { MessageBox, MessageBoxButton } from '../dialogs/MessageBox';

/** Port of Punch's `DialogResult`. */
export type DialogResult = 'ok' | 'cancel' | 'yes' | 'no';

/**
 * Raised instead of returning when the user dismisses a dialog.
 *
 * Punch's `IDialogManager` rejected its task with `TaskCanceledException`, and the view models were
 * written around that - `ResourceMgtViewModel.Add` catches it to abandon the add.  Keeping the same
 * shape means the ported control flow reads the same in WPF, Angular and React.
 */
export class DialogCancelledError extends Error {
  constructor() {
    super('The dialog was cancelled.');
    this.name = 'DialogCancelledError';
  }
}

/** What a dialog's content gets: a function that closes the dialog with a result, or without. */
export type CloseDialog<TResult> = (result?: TResult) => void;

/**
 * Port of the Angular client's `core/services/dialog.service.ts` (`AppDialogService`, itself a port
 * of Punch's `IDialogManager`), on top of Mantine's modals manager.
 *
 * In Angular this was an injectable service wrapping Optimus UI's `DialogService`, which created a
 * component and passed it data through `DynamicDialogConfig`.  Here it is a set of plain functions:
 * Mantine's `modals` is a module-level manager (its `ModalsProvider` in `main.tsx` renders the open
 * dialogs), so nothing needs injecting.  And the dialog's content is not a component *type* plus
 * data but a React element: `render` gets the `close` function and returns the JSX to show, with
 * whatever props it needs - the counterpart of `DynamicDialogConfig.data` and `DynamicDialogRef`.
 *
 * ```tsx
 * const type = await openDialog<AddressType>(
 *   (close) => <ItemSelector items={types} onSelect={close} />,
 *   { title: 'Add an address' },
 * );
 * ```
 *
 * Resolves with the result; **throws** `DialogCancelledError` when the dialog closes without one.
 */
export function openDialog<TResult>(
  render: (close: CloseDialog<TResult>) => ReactNode,
  options: { title?: string; size?: string } = {},
): Promise<TResult> {
  return new Promise<TResult>((resolve, reject) => {
    let settled = false;

    const close: CloseDialog<TResult> = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      modals.close(id);
      if (result === undefined || result === null) {
        reject(new DialogCancelledError());
      } else {
        resolve(result);
      }
    };

    const id = modals.open({
      title: options.title ?? 'TempHire',
      size: options.size ?? '32rem',
      centered: true,
      // Above the sticky toolbar (900) and Quinn's pane (1000), as Optimus UI's dialogs were.
      zIndex: 1100,
      children: render(close),
      // The X, Escape or a click outside: no result.
      onClose: () => close(undefined),
    });
  });
}

/**
 * Port of `ShowMessageAsync`.  Resolves with the chosen value; **throws** `DialogCancelledError` if
 * the user picks the cancel button or dismisses the dialog.
 */
export async function showMessage(
  message: string,
  buttons: MessageBoxButton[],
  options: { header?: string; cancelValue?: DialogResult | null } = {},
): Promise<DialogResult> {
  const result = await openDialog<DialogResult>(
    (close) => <MessageBox<DialogResult> message={message} buttons={buttons} onChoose={close} />,
    { title: options.header ?? 'TempHire', size: '30rem' },
  );

  const cancelValue = options.cancelValue === undefined ? 'cancel' : options.cancelValue;
  if (cancelValue !== null && result === cancelValue) {
    throw new DialogCancelledError();
  }

  return result;
}

/** OK / Cancel. */
export function confirm(message: string, header = 'TempHire'): Promise<DialogResult> {
  return showMessage(
    message,
    [
      { label: 'OK', value: 'ok', severity: 'primary' },
      { label: 'Cancel', value: 'cancel', severity: 'secondary' },
    ],
    { header },
  );
}

/** Yes / No, where "No" is an answer rather than a cancellation. */
export function confirmYesNo(message: string, header = 'TempHire'): Promise<DialogResult> {
  return showMessage(
    message,
    [
      { label: 'Yes', value: 'yes', severity: 'danger' },
      { label: 'No', value: 'no', severity: 'secondary' },
    ],
    { header, cancelValue: 'no' },
  );
}

/**
 * Yes / No / Cancel - used when leaving a screen with unsaved changes.  Throws
 * `DialogCancelledError` for Cancel, matching `StaffingResourceDetailViewModel.CanClose`.
 */
export function confirmYesNoCancel(message: string, header = 'TempHire'): Promise<DialogResult> {
  return showMessage(
    message,
    [
      { label: 'Yes', value: 'yes', severity: 'primary' },
      { label: 'No', value: 'no', severity: 'secondary' },
      { label: 'Cancel', value: 'cancel', severity: 'secondary' },
    ],
    { header },
  );
}
