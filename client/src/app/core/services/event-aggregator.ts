/** A successful save, in any unit of work of any workspace.  A new object for every save. */
export interface SavedEvent {
  /**
   * The unit of work that was saved.  Held weakly, so the latest save doesn't keep a sandbox alive
   * after its screen has let go of it (see `UnitOfWorkManager`).
   */
  readonly unitOfWork: WeakRef<object>;
}

/** A sign-out.  A new object for every one. */
export type LoggedOutEvent = Readonly<Record<string, never>>;

/** Unsubscribes. */
export type Unsubscribe = () => void;

/** One kind of event: its latest occurrence, and who to tell about the next. */
class EventChannel<T> {
  private latestEvent: T | null = null;
  private readonly listeners = new Set<(event: T) => void>();

  /** The latest occurrence, or `null` before the first.  A snapshot for `useSyncExternalStore`. */
  readonly latest = (): T | null => this.latestEvent;

  /** Calls `listener` on every occurrence from now on, synchronously, in the order of subscription. */
  readonly subscribe = (listener: (event: T) => void): Unsubscribe => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  publish(event: T): void {
    this.latestEvent = event;
    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }
}

/**
 * Port of the Angular client's `EventAggregator`, itself a port of Caliburn.Micro's
 * `IEventAggregator`, through which Punch's services and screens told each other what had happened
 * (`SavedMessage`, `LoggedOutMessage`) without knowing about each other.
 *
 * Angular holds each event's latest occurrence in a signal.  React has no signals, so an event here
 * is a subscription (`onSaved`, `IHandle<SavedMessage>`) plus the latest occurrence (`lastSave`),
 * which a component reads with `useSyncExternalStore` (`useLastSave`).  A notification method
 * (`saved`, `loggedOut`) publishes one.  The aggregator only carries the events; it knows nothing of
 * who listens.  Created once in `createAppServices` (`useServices().events`).
 */
export class EventAggregator {
  private readonly saves = new EventChannel<SavedEvent>();
  private readonly logouts = new EventChannel<LoggedOutEvent>();

  /**
   * The latest successful save, or `null` before the first.  Port of Punch's `SavedMessage`: the
   * search list reloads on it.
   */
  readonly lastSave = this.saves.latest;

  /** Subscribes to the saves.  Every unit-of-work manager drops its shared cache on one. */
  readonly onSaved = this.saves.subscribe;

  /**
   * Subscribes to sign-outs - port of Punch's `LoggedOutMessage`.  Every unit-of-work manager
   * forgets its units of work on one.  Nothing reads the latest sign-out, so unlike saves there is
   * no `lastLogout`.
   */
  readonly onLoggedOut = this.logouts.subscribe;

  /** Called by a unit of work after every successful save. */
  saved(unitOfWork: object): void {
    this.saves.publish({ unitOfWork: new WeakRef(unitOfWork) });
  }

  /** Called at sign-out. */
  loggedOut(): void {
    this.logouts.publish({});
  }
}
