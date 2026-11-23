import { useSyncExternalStore } from 'react';

import { UnitOfWork } from '../services/unit-of-work';

const noSubscription = () => () => {};
const noVersion = () => 0;

/**
 * Renders the calling component again whenever an entity in `unitOfWork` changes, and returns the
 * unit of work's version number (useful as a dependency of `useMemo`).
 *
 * New in the React port; the counterpart of reading `unitOfWork.changes()` inside a `computed` in
 * the Angular client.  Breeze changes entities in place, which React cannot see; this subscribes to
 * the unit of work (see `UnitOfWork`), and `useSyncExternalStore` re-renders the component when the
 * version it reports changes.  So after `address.city = 'Seattle'`, or after an Add adds a row to
 * `staffingResource.addresses`, the component reads the entities again and shows the new state.
 *
 * **The rules of hooks.**  Like every hook, this must be called on every render, in the same order,
 * from the top level of a component - never inside an `if` or a loop.  React tells hooks apart by
 * call order, not by name.  That is why it accepts `null` (no unit of work yet) rather than being
 * called conditionally.
 */
export function useUnitOfWork(unitOfWork: UnitOfWork | null | undefined): number {
  return useSyncExternalStore(
    unitOfWork?.subscribe ?? noSubscription,
    unitOfWork?.version ?? noVersion,
  );
}
