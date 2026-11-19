import { notifications } from '@mantine/notifications';
import { isConcurrencyError } from 'breeze-client';

import { HttpError } from './api-fetch';

/** Shape of the payload Breeze's `GlobalExceptionFilter` sends for an `EntityErrorsException`. */
interface BreezeEntityErrors {
  EntityErrors?: { ErrorMessage?: string; PropertyName?: string; EntityTypeName?: string }[];
  /** Breeze's filter writes `Message`; the account DTOs write `message`.  Read both. */
  Message?: string;
  message?: string;
}

/**
 * Port of the Angular client's `core/services/error-handler.service.ts` (and before it of
 * `Common/Errors/ErrorHandler.cs` and `ValidationErrorHandler.cs`).
 *
 * Angular called a global `ErrorHandler` for every uncaught error.  React has nothing like it:
 *
 *  - code that catches an error shows it with `showError` - a function, not a service, because it
 *    has no state of its own (Mantine's `notifications` keeps the toasts);
 *  - `main.tsx` passes the window's `error` and `unhandledrejection` events to `showError`, which
 *    covers what `provideBrowserGlobalErrorListeners` did;
 *  - an error thrown while *rendering* is caught by the `ErrorBoundary` in `main.tsx`.
 *
 * `describe` and `isHarmless` are unchanged.
 */
export function showError(error: unknown): void {
  if (isHarmless(error)) {
    return;
  }

  const { summary, detail } = describe(error);
  notifications.show({
    color: 'red',
    title: summary,
    message: detail,
    autoClose: 10000,
    style: { whiteSpace: 'pre-line' },
  });

  console.error(error);
}

/**
 * Browser notices that arrive as errors but mean nothing is wrong, so the user is not shown them.
 * "ResizeObserver loop completed with undelivered notifications": a ResizeObserver callback changed
 * the layout, so the browser postponed the remaining notifications to the next frame.
 */
export function isHarmless(error: unknown): boolean {
  const harmless = /^ResizeObserver loop (completed with undelivered notifications|limit exceeded)/;
  const messages = [error, (error as { cause?: unknown })?.cause].map(
    (e) => (e as { message?: unknown })?.message,
  );
  return messages.some((message) => typeof message === 'string' && harmless.test(message));
}

export function describe(error: unknown): { summary: string; detail: string } {
  const unwrapped = (error as { reason?: unknown })?.reason ?? error;

  if (isConcurrencyError(unwrapped)) {
    return CONCURRENCY_CONFLICT;
  }

  // A request made with `apiRequest` that failed: the body is the server's answer, as text.
  if (unwrapped instanceof HttpError) {
    return describeBody(unwrapped.body) ?? {
      summary: 'Server error',
      detail: unwrapped.message || `Request failed with status ${unwrapped.status}.`,
    };
  }

  // Breeze wraps save failures in an error carrying the server's entityErrors.
  const breezeErrors = (unwrapped as { entityErrors?: { errorMessage?: string }[] })?.entityErrors;
  if (Array.isArray(breezeErrors) && breezeErrors.length) {
    const messages = breezeErrors.map((e) => e.errorMessage).filter((m): m is string => !!m);
    return { summary: 'The changes could not be saved', detail: unique(messages) };
  }

  // Any other failed Breeze request: an Error carrying the response `status` and `body`.
  const breezeBody = (unwrapped as { body?: unknown; status?: number })?.body;
  if (breezeBody !== undefined && (unwrapped as { status?: number }).status) {
    const described =
      typeof breezeBody === 'string'
        ? describeBody(breezeBody)
        : describeParsed(breezeBody as BreezeEntityErrors);
    if (described) {
      return described;
    }
  }

  if (unwrapped instanceof Error) {
    return { summary: 'Something went wrong', detail: unwrapped.message };
  }

  return { summary: 'Something went wrong', detail: String(unwrapped) };
}

/** A response body as text: the server's message if it is JSON with one, else the text itself. */
function describeBody(body: string): { summary: string; detail: string } | null {
  if (!body.trim()) {
    return null;
  }

  try {
    const described = describeParsed(JSON.parse(body) as BreezeEntityErrors);
    if (described) {
      return described;
    }
  } catch {
    // Not JSON - show it as-is.
  }

  return { summary: 'Server error', detail: body };
}

function describeParsed(body: BreezeEntityErrors | null): { summary: string; detail: string } | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  if (Array.isArray(body.EntityErrors) && body.EntityErrors.length) {
    const messages = body.EntityErrors.map((e) => e.ErrorMessage).filter((m): m is string => !!m);
    return { summary: 'The changes could not be saved', detail: unique(messages) };
  }

  if (body.Message || body.message) {
    return { summary: 'Server error', detail: (body.Message ?? body.message)! };
  }

  return null;
}

function unique(messages: string[]): string {
  return [...new Set(messages)].join('\n');
}

/**
 * What the user is told when a save conflicts with someone else's: another user changed or deleted
 * a record the save changes or deletes after it was loaded (optimistic concurrency, see
 * `AuditEntityBase.RowVersion` on the server).  Nothing was saved.  Refresh discards the unsaved
 * changes and loads the latest data, on which the user can make their changes again.
 *
 * Recognized by the problem type the Breeze server sends for a conflict (`isConcurrencyError`), not
 * by the status code or the message: 409 is also a duplicate key, and the message is EF Core's.
 */
export const CONCURRENCY_CONFLICT = {
  summary: 'Someone else changed this data',
  detail:
    'Another user changed or deleted some of this data after you loaded it, so your changes were not ' +
    'saved. Click Refresh to load the latest data, then make your changes again and save.',
};
