import { vi } from 'vitest';

import type { EntityManagerProvider } from './entity-manager-provider';
import type { UnitOfWork } from './unit-of-work';
import {
  SHARED_UNIT_OF_WORK_KEY,
  UnitOfWorkManager,
  UnitOfWorkManagers,
} from './unit-of-work-manager';

/** A unit of work as far as the managers see one: it can commit, report changes and be cleared. */
function fakeUnitOfWork(onCommitted: () => void) {
  return {
    commit: async () => onCommitted(),
    hasChanges: () => false,
    clear: vi.fn(),
  } as unknown as UnitOfWork;
}

/** Two workspaces, each with its own manager. */
class OrdersManager extends UnitOfWorkManager<UnitOfWork> {
  protected override newUnitOfWork(onCommitted: () => void) {
    return fakeUnitOfWork(onCommitted);
  }
}
class InvoicesManager extends UnitOfWorkManager<UnitOfWork> {
  protected override newUnitOfWork(onCommitted: () => void) {
    return fakeUnitOfWork(onCommitted);
  }
}

/**
 * The manager is generic: each workspace has its own, for its own unit of work, and what concerns
 * them all (the saves, the shared caches after a save, sign-out) goes through `UnitOfWorkManagers`.
 * Port of the Angular client's `core/services/unit-of-work-manager.spec.ts`.
 */
describe('UnitOfWorkManager', () => {
  function setUp() {
    const managers = new UnitOfWorkManagers();
    const emProvider = {} as EntityManagerProvider;
    return {
      orders: new OrdersManager(emProvider, managers),
      invoices: new InvoicesManager(emProvider, managers),
      managers,
    };
  }

  it('holds its units of work weakly: a collected one is replaced on the next get', () => {
    // A test can't make the garbage collector run, so `WeakRef` is replaced by one whose target the
    // test can drop, as a collection would.
    const refs: { target: object | undefined }[] = [];
    vi.stubGlobal(
      'WeakRef',
      class {
        target: object | undefined;
        constructor(target: object) {
          this.target = target;
          refs.push(this);
        }
        deref() {
          return this.target;
        }
      },
    );
    try {
      const { orders } = setUp();
      const sandbox = orders.get('order-1');
      expect(orders.get('order-1')).toBe(sandbox);

      refs.forEach((ref) => (ref.target = undefined)); // nothing held it, and it was collected
      expect(orders.has('order-1')).toBe(false);
      expect(orders.get('order-1')).not.toBe(sandbox);
      expect(orders.has('order-1')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps one unit of work per key, and a new one for each create', () => {
    const { orders } = setUp();
    expect(orders.get(SHARED_UNIT_OF_WORK_KEY)).toBe(orders.get(SHARED_UNIT_OF_WORK_KEY));
    expect(orders.get('order-1')).not.toBe(orders.get(SHARED_UNIT_OF_WORK_KEY));
    expect(orders.create()).not.toBe(orders.create());
  });

  it('counts a save in any workspace, and tells its subscribers', async () => {
    const { orders, invoices, managers } = setUp();
    const listener = vi.fn();
    managers.subscribe(listener);

    await orders.get('order-1').commit();
    await invoices.get('invoice-1').commit();

    expect(managers.saves()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("drops every workspace's shared cache after a save, except the one saved", () => {
    const { orders, invoices, managers } = setUp();
    const ordersShared = orders.get(SHARED_UNIT_OF_WORK_KEY) as unknown as {
      clear: ReturnType<typeof vi.fn>;
    };
    const invoicesShared = invoices.get(SHARED_UNIT_OF_WORK_KEY) as unknown as {
      clear: ReturnType<typeof vi.fn>;
    };

    managers.dropSharedCaches(orders.get('order-1'));
    expect(ordersShared.clear).toHaveBeenCalledTimes(1);
    expect(invoicesShared.clear).toHaveBeenCalledTimes(1);

    managers.dropSharedCaches(ordersShared);
    expect(ordersShared.clear).toHaveBeenCalledTimes(1);
    expect(invoicesShared.clear).toHaveBeenCalledTimes(2);
  });

  it("forgets every workspace's units of work at sign-out", () => {
    const { orders, invoices, managers } = setUp();
    orders.get('order-1');
    invoices.get(SHARED_UNIT_OF_WORK_KEY);

    managers.clear();

    expect(orders.has('order-1')).toBe(false);
    expect(invoices.has(SHARED_UNIT_OF_WORK_KEY)).toBe(false);
  });
});
