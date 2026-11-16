import { Alert, Button, Stack } from '@mantine/core';
import { Component, ErrorInfo, ReactNode } from 'react';

import { describe, showError } from './services/error-handler';

/**
 * Catches an error thrown while rendering, and shows it instead of a blank page.
 *
 * New in the React port.  In Angular, an error in a template went to the global `ErrorHandler`
 * and the rest of the page carried on.  In React, an error thrown while rendering unmounts the
 * whole tree - unless an *error boundary* above it catches it.  An error boundary is the one thing
 * that still has to be a class component: it needs `getDerivedStateFromError` and
 * `componentDidCatch`, which have no hook equivalent.
 *
 * Errors in event handlers and in promises don't go through here; they are caught where they
 * happen, or by the window listeners in `main.tsx`.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  override state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  override componentDidCatch(error: unknown, _info: ErrorInfo): void {
    showError(error);
  }

  override render() {
    if (this.state.error) {
      const { summary, detail } = describe(this.state.error);
      return (
        <Stack p="xl" maw={640} mx="auto">
          <Alert color="red" title={summary}>
            {detail}
          </Alert>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </Stack>
      );
    }

    return this.props.children;
  }
}
