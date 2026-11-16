import { useCallback, useState } from 'react';

/**
 * Port of the Angular client's `core/services/busy.service.ts` (Punch's `IBusyWatcher`).
 *
 * Angular provided a `BusyService` per component (`providers: [BusyService]`), holding a counter
 * signal.  The React counterpart of "state that belongs to one component" is **`useState`**, and a
 * function that bundles some state with the logic around it is a **custom hook** - any function
 * whose name starts with `use` and that calls other hooks.  Each component that calls `useBusy()`
 * gets its own counter, just as each got its own `BusyService`.
 *
 * `Busy.GetTicket()` in a `using` block became `await busy.run(promise)`: the counter is up for the
 * life of the promise, so nesting works the same way tickets did.
 */
export function useBusy(): { isBusy: boolean; run: <T>(operation: Promise<T>) => Promise<T> } {
  const [count, setCount] = useState(0);

  // `setCount(c => c + 1)` - the updater form - rather than `setCount(count + 1)`: `run` may be
  // called again before React has re-rendered, and the updater always sees the latest count.
  const run = useCallback(async <T>(operation: Promise<T>): Promise<T> => {
    setCount((c) => c + 1);
    try {
      return await operation;
    } finally {
      setCount((c) => c - 1);
    }
  }, []);

  return { isBusy: count > 0, run };
}
