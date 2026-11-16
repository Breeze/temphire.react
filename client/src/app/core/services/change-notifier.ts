/**
 * The base of every service that holds state the UI shows: the session (`AuthService`), a unit of
 * work's entities (`UnitOfWork`), the save counter (`UnitOfWorkManager`), Quinn's conversation.
 *
 * New in the React port; it takes the place of Angular's signals in those services.
 *
 * In Angular, a service exposed signals, and a template that read one re-rendered when it changed.
 * React has no signals: a component renders again when *its* state changes.  The bridge is React's
 * `useSyncExternalStore(subscribe, getSnapshot)` hook - an "external store" is anything with those
 * two functions.  A service extends this class, calls `notify()` whenever its state changes, and
 * exposes a snapshot; a component reads it with `useSyncExternalStore(service.subscribe, ...)` and
 * renders again on every `notify()`.  See `core/hooks/use-store.ts`.
 *
 * `subscribe` is an arrow function so it can be handed to React without binding it: React calls it
 * with no `this`.
 */
export class ChangeNotifier {
  private readonly listeners = new Set<() => void>();

  /** Registers a listener; returns the function that removes it again. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  protected notify(): void {
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}
