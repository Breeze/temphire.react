import { NotifyingEntityStore, ValidationError, ValidationService } from '@ideablade/validation';
import { breezeEntityStore } from '@ideablade/validation/breeze';
import { Entity, EntityManager, EntityState, InitialValues, SaveOptions } from 'breeze-client';

import { ChangeNotifier } from './change-notifier';
import { EntityManagerProvider } from './entity-manager-provider';
import { EntityCtor, IRepository, Repository } from './repository';

/** Port of Punch's `IFactory<T>`. */
export interface IEntityFactory<T extends Entity> {
  create(config?: InitialValues<T>): Promise<T>;
}

/** Creates entities from a generated class; `values` is checked against the class. */
export class EntityFactory<T extends Entity> implements IEntityFactory<T> {
  constructor(
    protected readonly entityCtor: EntityCtor<T>,
    protected readonly manager: EntityManager,
  ) {}

  create(config?: InitialValues<T>): Promise<T> {
    return Promise.resolve(this.manager.createEntity(this.entityCtor, config));
  }
}

/**
 * Port of the Angular client's `core/services/unit-of-work.ts`, itself a port of Punch's
 * `UnitOfWork`.
 *
 * A unit of work owns exactly one Breeze `EntityManager`, which is where TempHire's "sandbox
 * editing" comes from: the search list and every read-only view share one unit of work, while each
 * resource being *edited* gets its own.  Cancelling an edit is `manager.rejectChanges()` on that one
 * sandbox, with no effect on anything else on screen.
 *
 * **Breeze entities and React rendering.**  Breeze entities are plain mutable objects: setting
 * `address.city` changes the object in place, and React does not notice.  (React re-renders a
 * component when its *state* changes, and it compares state by identity, so an object changed in
 * place looks unchanged.)  The unit of work bridges the two.  It listens to its manager's
 * `entityChanged`, `hasChangesChanged` and `validationErrorsChanged` events, bumps `version`, and
 * notifies its subscribers.  A component that shows this unit of work's entities calls
 * `useUnitOfWork(unitOfWork)` (see `core/hooks/use-unit-of-work.ts`), which subscribes with
 * `useSyncExternalStore` - so the component renders again, and reads the entities afresh, whenever
 * one of them changes.
 *
 * The Angular version did the same with a counter *signal*, read inside `computed`s.  The two are
 * one idea: a version number that changes whenever an entity does.
 */
export class UnitOfWork extends ChangeNotifier {
  protected readonly manager: EntityManager;

  /**
   * The live entities of this unit of work, as a validation entity store: what `store(type)` sees
   * in the validation rules, and what tells the forms that something changed.  The route's
   * validation service uses it for the unit of work it shows (`ResourceMgt`).
   */
  readonly entityStore: NotifyingEntityStore;

  private _version = 0;

  /**
   * Bumped on every change to an entity in this unit of work: a property edit, a state change,
   * attach and detach, accept and reject, `clear()`, and a change to its validation errors.  The
   * snapshot `useUnitOfWork` gives React: a new number means "render again".
   */
  readonly version = (): number => this._version;

  /**
   * @param onCommitted called after every successful save, so the owner can publish it.  This is
   *   the replacement for Punch's `SavedMessage`; see `UnitOfWorkManager.saves`.
   */
  constructor(
    protected readonly emProvider: EntityManagerProvider,
    protected readonly validation: ValidationService,
    private readonly onCommitted: () => void = () => {},
  ) {
    super();
    this.manager = emProvider.newManager();
    this.entityStore = breezeEntityStore(this.manager);

    const bump = () => {
      this._version++;
      this.notify();
    };
    this.manager.entityChanged.subscribe(bump);
    this.manager.hasChangesChanged.subscribe(bump);
    this.manager.validationErrorsChanged.subscribe(bump);
  }

  /** Whether anything is waiting to be saved - port of `IUnitOfWork.HasChanges`. */
  hasChanges(): boolean {
    return this.manager.hasChanges();
  }

  /**
   * The broken rules of the validation metadata - the server's rules beyond the data annotations -
   * across every entity in this unit of work, as of the current `version`.
   *
   * Breeze runs the same rules (`EntityManagerProvider` installs them), but a rule about the
   * *whole* entity, such as "a resource has at least one address", only when it validates that
   * entity: when it is attached, and when it is saved.  Deleting a resource's last address changes
   * the address, not the resource, so Breeze would not notice until the server rejected the save.
   * Validating every live entity here notices at once, because the rule reads the manager's
   * addresses (`store('Address')`, from `entityStore`).
   *
   * Breeze's own rules (the global `breeze` validator) are left out: Breeze checks them itself, on
   * every property change, and running them here would re-validate every entity in Breeze too.
   * `hasValidationErrors` counts their errors separately.
   *
   * Remembered per version, so it only runs again once something has changed.  (Angular: a
   * `computed`.)
   */
  validationErrors(): readonly ValidationError[] {
    if (this.validated?.version !== this._version) {
      const errors = this.manager
        .getEntities(undefined, [EntityState.Unchanged, EntityState.Added, EntityState.Modified])
        .flatMap((entity) =>
          this.validation.validateModelSync(entity, entity.entityType.shortName, {
            predicate: (validator) => validator.name !== 'breeze',
            store: this.entityStore.getEntities,
          }),
        );
      this.validated = { version: this._version, errors };
    }

    return this.validated.errors;
  }

  private validated?: { version: number; errors: readonly ValidationError[] };

  /**
   * Whether anything would stop a save: a broken rule of the validation metadata
   * (`validationErrors`), or a property of a pending change that Breeze finds invalid - a required
   * field left empty, a value too long.
   *
   * Two kinds of Breeze errors are left out:
   *
   *  - errors the *server* reported for a failed save (`isServerError`), by the same rule Breeze
   *    applies when saving: they do not stop a save, because only the server can re-check them;
   *  - errors about a whole entity rather than one property.  Breeze re-checks those only when it
   *    validates the entity again, so one recorded when a new resource was created without an
   *    address would outlive the address being added.  `validationErrors` has the current answer.
   */
  hasValidationErrors(): boolean {
    return (
      this.validationErrors().length > 0 ||
      this.manager
        .getChanges()
        .some((entity) =>
          entity.entityAspect
            .getValidationErrors()
            .some((error) => !error.isServerError && !!error.propertyName),
        )
    );
  }

  getChanges(): Entity[] {
    return this.manager.getChanges();
  }

  /** True when the given entity lives in this unit of work - port of `IUnitOfWork.HasEntity`. */
  hasEntity(entity: Entity): boolean {
    return !!entity && entity.entityAspect?.entityManager === this.manager;
  }

  /** Port of `IUnitOfWork.CommitAsync`. */
  async commit(): Promise<Entity[]> {
    const saveOptions = new SaveOptions({ resourceName: 'SaveChanges' });
    const saveResult = await this.manager.saveChanges(null, saveOptions);

    this.onCommitted();

    return saveResult.entities;
  }

  /** Port of `IUnitOfWork.Rollback`. */
  rollback(): void {
    this.manager.rejectChanges();
  }

  /** Port of `IUnitOfWork.Clear` - drops everything and re-seeds the lookup entities. */
  clear(): void {
    this.emProvider.clear(this.manager);
  }

  protected createRepository<T extends Entity>(
    entityCtor: EntityCtor<T>,
    isCached = false,
  ): IRepository<T> {
    return new Repository(this.manager, entityCtor, isCached);
  }

  protected createFactory<T extends Entity>(entityCtor: EntityCtor<T>): IEntityFactory<T> {
    return new EntityFactory(entityCtor, this.manager);
  }
}
