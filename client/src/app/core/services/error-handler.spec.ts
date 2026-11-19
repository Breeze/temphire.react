import { notifications } from '@mantine/notifications';
import { ProblemTypes } from 'breeze-client';
import { vi } from 'vitest';

import { HttpError } from './api-fetch';
import { CONCURRENCY_CONFLICT, describe as describeError, showError } from './error-handler';

/** Port of the Angular client's `core/services/error-handler.service.spec.ts`. */
describe('showError', () => {
  beforeEach(() => {
    vi.spyOn(notifications, 'show').mockImplementation(() => '');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('shows an unexpected error', () => {
    showError(new Error('Something broke'));

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'red', message: 'Something broke' }),
    );
  });

  // What the window's `error` event carries for the browser's ResizeObserver notice.
  it('ignores the ResizeObserver loop notice', () => {
    const notice = new ErrorEvent('error', {
      message: 'ResizeObserver loop completed with undelivered notifications.',
    });
    const wrapped = new Error('An ErrorEvent with no error occurred. See Error.cause for details', {
      cause: notice,
    });

    showError(wrapped);

    expect(notifications.show).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('describe', () => {
  it("reads the server's validation messages from a failed save", () => {
    const body = JSON.stringify({
      EntityErrors: [
        { ErrorMessage: 'StaffingResource must have at least one address' },
        { ErrorMessage: 'StaffingResource must have at least one address' },
      ],
    });

    expect(describeError(new HttpError(403, body, 'Forbidden'))).toEqual({
      summary: 'The changes could not be saved',
      detail: 'StaffingResource must have at least one address',
    });
  });

  it("reads Breeze's entityErrors", () => {
    const error = Object.assign(new Error('Save failed'), {
      entityErrors: [{ errorMessage: "'City' is required" }],
    });

    expect(describeError(error).detail).toBe("'City' is required");
  });

  // A save that conflicted with someone else's, as the Breeze client reports it: a save error whose
  // `problemType` is the one the Breeze server sends for a concurrency conflict, carrying the
  // server's technical message.
  it('tells the user to refresh after a concurrency conflict, not what the server said', () => {
    const conflict = Object.assign(
      new Error('The save failed because 1 record was changed or deleted by another user after it was read.'),
      { status: 409, problemType: ProblemTypes.concurrencyConflict, entityErrors: [] },
    );

    expect(describeError(conflict)).toEqual(CONCURRENCY_CONFLICT);
    expect(CONCURRENCY_CONFLICT.detail).toContain('Click Refresh');
  });

  it('does not mistake another 409 for a concurrency conflict', () => {
    const duplicate = Object.assign(new Error('Cannot insert duplicate key.'), {
      status: 409,
      problemType: 'https://example.test/problems/duplicate-key',
    });

    expect(describeError(duplicate)).not.toEqual(CONCURRENCY_CONFLICT);
  });
});
