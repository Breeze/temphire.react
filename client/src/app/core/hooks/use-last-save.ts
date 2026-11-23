import { useSyncExternalStore } from 'react';

import type { EventAggregator, SavedEvent } from '../services/event-aggregator';

/**
 * The latest save anywhere, or `null` before the first; the calling component renders again on
 * each one.  Port of `IHandle<SavedMessage>`.  (Angular: reading `EventAggregator.lastSave()`.)
 */
export function useLastSave(events: EventAggregator): SavedEvent | null {
  return useSyncExternalStore(events.onSaved, events.lastSave);
}
