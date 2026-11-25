import { Button, Group, Text } from '@mantine/core';

export interface MessageBoxButton {
  label: string;
  value: string;
  severity?: 'primary' | 'secondary' | 'danger';
}

interface MessageBoxProps<T extends string> {
  message: string;
  buttons: MessageBoxButton[];
  onChoose: (value: T) => void;
}

/**
 * The message box behind `showMessage`.
 *
 * Port of the Angular client's `core/dialogs/message-box.component.ts`.  Punch's
 * `ShowMessageAsync` accepted an arbitrary set of buttons, and TempHire needs the three-button
 * "save / discard / cancel" prompt, so the buttons are data here as they were in the original.
 *
 * **A React component is a function** of its props that returns JSX - markup written inside
 * TypeScript.  Where the Angular template looped with `@for`, JSX maps the array to elements;
 * `key` plays the part of `track`.  Where Angular injected `DynamicDialogRef` to close the dialog,
 * this component is simply handed a callback, `onChoose`, as a prop.
 */
export function MessageBox<T extends string>({ message, buttons, onChoose }: MessageBoxProps<T>) {
  // Memoized by the React Compiler: plain values only (README, "The React Compiler").
  'use memo';

  return (
    <>
      <Text mb="lg" style={{ whiteSpace: 'pre-line' }}>
        {message}
      </Text>
      <Group justify="flex-end" gap="xs">
        {buttons.map((button) => (
          <Button
            key={button.value}
            color={button.severity === 'danger' ? 'red' : undefined}
            variant={button.severity === 'secondary' ? 'outline' : 'filled'}
            onClick={() => onChoose(button.value as T)}
          >
            {button.label}
          </Button>
        ))}
      </Group>
    </>
  );
}
