import { modals } from '@mantine/modals';
import { ReactNode } from 'react';

import { MessageBox, MessageBoxButton } from '../dialogs/MessageBox';

/** The button a message box was closed with. Port of Punch's `DialogResult`. */
export type DialogResult = 'ok' | 'cancel' | 'yes' | 'no';

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
 * Every dialog **returns** what the user chose: this one resolves with its result, or `undefined`
 * when the user cancelled or closed it. Cancelling is an answer, not an error.  (The first port kept
 * Punch's shape, which rejected the task with `TaskCanceledException`, as a thrown
 * `DialogCancelledError`.  Every caller then needed a try/catch to tell "the user said no" from a real
 * failure, and real failures got reported by hand instead of reaching the global handler.)
 */
export function openDialog<TResult>(
  render: (close: CloseDialog<TResult>) => ReactNode,
  options: { title?: string; size?: string } = {},
): Promise<TResult | undefined> {
  return new Promise<TResult | undefined>((resolve) => {
    let settled = false;

    const close: CloseDialog<TResult> = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      modals.close(id);
      resolve(result ?? undefined);
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
 * Port of `ShowMessageAsync`.  Resolves with the value of the button the user picked.  Closing the
 * box without one (the X, Escape, a click outside) counts as `dismissResult`: the box's cancel answer.
 */
export async function showMessage(
  message: string,
  buttons: MessageBoxButton[],
  options: { header?: string; dismissResult?: DialogResult } = {},
): Promise<DialogResult> {
  const result = await openDialog<DialogResult>(
    (close) => <MessageBox<DialogResult> message={message} buttons={buttons} onChoose={close} />,
    { title: options.header ?? 'TempHire', size: '30rem' },
  );
  return result ?? options.dismissResult ?? 'cancel';
}

/** OK / Cancel: `'ok'` or `'cancel'`. */
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

/** Yes / No: `'yes'` or `'no'`. Closing the box counts as No. */
export function confirmYesNo(message: string, header = 'TempHire'): Promise<DialogResult> {
  return showMessage(
    message,
    [
      { label: 'Yes', value: 'yes', severity: 'danger' },
      { label: 'No', value: 'no', severity: 'secondary' },
    ],
    { header, dismissResult: 'no' },
  );
}

/** Yes / No / Cancel, used when leaving a screen with unsaved changes. Closing the box counts as Cancel. */
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
