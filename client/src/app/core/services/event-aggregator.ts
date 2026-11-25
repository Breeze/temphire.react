/**
 * A successful save, in any unit of work of any workspace, or on the server on the user's behalf
 * (Quinn).  A new object for every save.
 */
export interface SavedEvent {
  /**
   * The unit of work that was saved.  Held weakly, so the latest save doesn't keep a sandbox alive
   * after its screen has let go of it (see `UnitOfWorkManager`).  Null for a change saved
   * elsewhere: see `elsewhere`.
   */
  readonly unitOfWork: WeakRef<object> | null;
  /**
   * A change saved outside the app's units of work - by Quinn, on the server - and what it
   * changed.  The screens showing those staffing resources refresh them, as after a save of their
   * own, since nothing else in the app knows about it.
   */
  readonly elsewhere?: SavedElsewhere;
}

/** A change saved outside the app's units of work: see `SavedEvent.elsewhere`. */
export interface SavedElsewhere {
  /** Who saved it, for the user: "Quinn". */
  readonly by: string;
  /** The staffing resources whose data changed. */
  readonly staffingResourceIds: readonly string[];
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

  /**
   * Subscribes to the saves.  Every unit-of-work manager drops its shared cache on one, and
   * Resource Management refreshes the resource it shows after a change saved elsewhere (Quinn).
   */
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

  /** Called when a change was saved outside the app's units of work, such as by Quinn. */
  savedElsewhere(elsewhere: SavedElsewhere): void {
    this.saves.publish({ unitOfWork: null, elsewhere });
  }

  /** Called at sign-out. */
  loggedOut(): void {
    this.logouts.publish({});
  }
}
