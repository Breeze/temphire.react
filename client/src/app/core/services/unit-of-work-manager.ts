import { ChangeNotifier } from './change-notifier';
import { EntityManagerProvider } from './entity-manager-provider';
import { ResourceMgtUnitOfWork } from './resource-mgt-unit-of-work';

/** The key used for the single shared, view-only unit of work.  DevForce used `Guid.Empty`. */
export const SHARED_UNIT_OF_WORK_KEY = '00000000-0000-0000-0000-000000000000';

/**
 * Port of the Angular client's `core/services/unit-of-work-manager.ts`, itself a port of Punch's
 * `IUnitOfWorkManager<T>`.
 *
 *  - `get(SHARED_UNIT_OF_WORK_KEY)` returns the one long-lived unit of work that every *read-only*
 *    screen shares, so they all see the same entity instances.
 *  - `get(resourceId)` returns a **sandbox** unit of work dedicated to editing that one resource, in
 *    its own `EntityManager`, so `Cancel` is a `rejectChanges()` on the sandbox.
 *
 * Punch evicted a unit of work once it had no pending changes; `releaseIfClean` does the same.
 */
export class UnitOfWorkManager extends ChangeNotifier {
  private readonly cache = new Map<string, ResourceMgtUnitOfWork>();
  private saveCount = 0;

  constructor(private readonly emProvider: EntityManagerProvider) {
    super();
  }

  /**
   * How many saves have succeeded, in any unit of work - port of Punch's `SavedMessage`, which the
   * search list handled (`IHandle<SavedMessage>`) to re-run its query.  `ResourceSearch` subscribes
   * to this manager and re-runs its search when the number changes.  (Angular: a signal read in the
   * search's `resource()` params.)
   */
  readonly saves = (): number => this.saveCount;

  /** Returns the cached unit of work for `key`, creating it on first use. */
  get(key: string): ResourceMgtUnitOfWork {
    let unitOfWork = this.cache.get(key);

    if (!unitOfWork) {
      unitOfWork = this.create();
      this.cache.set(key, unitOfWork);
    }

    return unitOfWork;
  }

  /** Creates an unregistered unit of work - port of `IUnitOfWorkManager.Create`. */
  create(): ResourceMgtUnitOfWork {
    return new ResourceMgtUnitOfWork(this.emProvider, () => {
      this.saveCount++;
      this.notify();
    });
  }

  /**
   * Registers a unit of work under a key.  Used when adding a resource: the sandbox has to be
   * created *before* the new resource has an id, then filed under that id once it does.
   */
  add(key: string, unitOfWork: ResourceMgtUnitOfWork): void {
    this.cache.set(key, unitOfWork);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  remove(key: string): void {
    if (key !== SHARED_UNIT_OF_WORK_KEY) {
      this.cache.delete(key);
    }
  }

  /** Drops a sandbox once it has nothing left to save - port of Punch's automatic eviction. */
  releaseIfClean(key: string): void {
    if (key === SHARED_UNIT_OF_WORK_KEY) {
      return;
    }

    const unitOfWork = this.cache.get(key);
    if (unitOfWork && !unitOfWork.hasChanges()) {
      this.cache.delete(key);
    }
  }

  /** Forgets every unit of work - used on logout. */
  clear(): void {
    this.cache.clear();
  }
}
