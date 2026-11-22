import { ValidationError } from '@ideablade/validation';
import { useErrorVisibility } from '@ideablade/validation/react';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * The errors of `errors`, about `model`, that the screen's `ErrorVisibility` shows, for errors shown
 * outside a field: the resource's "at least one address" rule in its own message, say.  Re-renders
 * when what the visibility shows changes (a touch, a validation, a save attempt).  Without an
 * `ErrorVisibilityProvider` above, all of them.
 *
 * Fields don't need it: `useFieldValidation` already gives the errors to show.
 */
export function useShownErrors<T extends ValidationError>(model: unknown, errors: readonly T[]): T[] {
  const visibility = useErrorVisibility();
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!visibility) {
        return () => {};
      }
      const subscription = visibility.changes$.subscribe(notify);
      return () => subscription.unsubscribe();
    },
    [visibility],
  );
  useSyncExternalStore(subscribe, () => visibility?.version ?? 0);
  return visibility ? visibility.shown(model, errors) : [...errors];
}
