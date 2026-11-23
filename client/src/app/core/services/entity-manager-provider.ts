import { ModelValidationMetadataMap, ValidationService } from 'ideablade-validation';
import { installBreezeValidators } from 'ideablade-validation/breeze';
import { DataService, EntityManager, EntityQuery, MetadataStore } from 'breeze-client';

import { environment } from '../../../environments/environment';
import { displayNameMetadata } from '../model-display-names';
import { registerModel } from '../model-registration';
import { getJson } from './api-fetch';

/**
 * Creates and seeds EntityManagers.
 *
 * Port of the Angular client's `core/services/entity-manager-provider.ts`, which in turn replaced
 * three pieces of the WPF app: `TempHire/EntityManagerProviderFactory.cs` (Punch's
 * `IEntityManagerProvider`), `TempHire/GlobalCache.cs` and
 * `DomainServices/Repositories/GlobalCacheRepository.cs`.  Nothing here was Angular-specific apart
 * from `@Injectable`: the React app creates one instance in `createAppServices` and hands it out
 * through `AppServicesContext` (see `app-services.tsx`), which is what Angular's root injector did.
 *
 * A single long-lived "master" manager holds the metadata and every lookup entity; each unit of
 * work then gets its own manager created as an empty copy of the master and seeded from it with
 * `exportEntities` / `importEntities`.  The lookup tables (states, address types, phone types, rate
 * types) never change during a session, and every sandbox manager needs them in cache to resolve
 * `Address.state` / `Address.addressType` without a server round trip.
 */
export class EntityManagerProvider {
  /** @param validation the app's validation service, which gets the server's validation metadata. */
  constructor(private readonly validation: ValidationService) {}

  /** The model's metadata, shared by every workspace: `ModelController` on the server. */
  private readonly modelService = new DataService({
    serviceName: environment.modelApiRoot,
    hasServerMetadata: true,
  });

  /**
   * The lookups, a cross-cutting concern loaded once at sign-in: `LookupsController`.  The master
   * manager queries it; each unit of work then talks to its own workspace's controller (see
   * `newManager`).  No server metadata of its own: the model's is loaded first.
   */
  private readonly lookupsService = this.workspaceService(environment.lookupsApiRoot);

  /**
   * A data service for a controller that queries and saves but serves no metadata of its own: the
   * model's is loaded first, from `modelService`.  Without `hasServerMetadata: false`, Breeze would
   * ask each controller for its own `/Metadata` before the first query.
   */
  private workspaceService(serviceName: string): DataService {
    return new DataService({ serviceName, hasServerMetadata: false });
  }

  /**
   * The one `MetadataStore` for the life of the page.  Breeze binds each registered entity class to
   * a single store - registering `StaffingResource` with a second store throws - so the store has to
   * outlive a logout, or the next login could not register the classes again.
   */
  readonly metadataStore = new MetadataStore();
  private metadataPromise?: Promise<void>;

  private masterManager?: EntityManager;
  private preparePromise?: Promise<void>;

  /**
   * Downloads the metadata (on the first sign-in only) and the lookup bundle.  Must complete before
   * any manager is created.  Both endpoints require an access token, so this runs straight after
   * signing in - where `LoginViewModel` called `IGlobalCache.LoadAsync()` in the original.
   */
  prepare(): Promise<void> {
    if (!this.preparePromise) {
      const masterManager = new EntityManager({
        dataService: this.lookupsService,
        metadataStore: this.metadataStore,
      });

      this.preparePromise = this.loadMetadata()
        // One request for every lookup table - `LookupsController.AllTypes` on the server.
        .then(() => masterManager.executeQuery(EntityQuery.from('AllTypes')))
        .then(() => {
          this.masterManager = masterManager;
        })
        .catch((error) => {
          // Let the next attempt start over rather than caching the failure forever.
          this.preparePromise = undefined;
          throw error;
        });
    }

    return this.preparePromise;
  }

  /**
   * Fetches the metadata and registers the model on the shared store, once per page.
   *
   * Two kinds of metadata come from the server, in parallel:
   *
   *  - Breeze's, built from the EF Core model, with the entities' data annotations as validators;
   *  - the validation metadata (`ValidationController`), with the rules the annotations cannot
   *    express: an address has a state, a rate is not negative, a resource keeps an address and a
   *    phone number.
   *
   * The validation metadata gets Breeze's display names (`displayNameMetadata`) and is then
   * installed into Breeze (`installBreezeValidators`).  Breeze then runs those rules next to its
   * own: a property's rules whenever it changes, and all of them on every save, so a save with a
   * broken rule never leaves the client.  The server checks the same metadata again when it saves.
   */
  private loadMetadata(): Promise<void> {
    this.metadataPromise ??= Promise.all([
      this.metadataStore.fetchMetadata(this.modelService),
      getJson<ModelValidationMetadataMap>(`${environment.validationApiRoot}/Metadata`),
    ])
      .then(([, validationMetadata]) => {
        registerModel(this.metadataStore);

        this.validation.validationMetadata.addMetadata([
          validationMetadata,
          displayNameMetadata(this.metadataStore),
        ]);
        installBreezeValidators(this.metadataStore, this.validation);
      })
      .catch((error) => {
        this.metadataPromise = undefined;
        throw error;
      });

    return this.metadataPromise;
  }

  get isPrepared(): boolean {
    return !!this.masterManager;
  }

  /** Forgets the master manager so the next sign-in starts from a clean cache. */
  reset(): void {
    this.masterManager = undefined;
    this.preparePromise = undefined;
  }

  /**
   * Creates a fresh manager pre-seeded with the lookup entities, which queries and saves through the
   * server controller at `serviceName`: the controller of the workspace the unit of work belongs to,
   * such as `ResourceMgtController` (`environment.resourceMgtApiRoot`).
   *
   * How the manager is configured stays in here: the unit of work names the controller and nothing
   * else.  Should one ever need a different setting, add an options parameter after `serviceName`.
   */
  newManager(serviceName: string): EntityManager {
    if (!this.masterManager) {
      throw new Error('EntityManagerProvider.prepare() must complete before a manager is created.');
    }

    const manager = this.masterManager.createEmptyCopy();
    manager.setProperties({ dataService: this.workspaceService(serviceName) });
    this.seed(manager);

    return manager;
  }

  /** Empties a manager and re-seeds it - DevForce's `Clear()` + `GlobalCacheRepository.OnCleared`. */
  clear(manager: EntityManager): void {
    manager.clear();
    this.seed(manager);
  }

  private seed(manager: EntityManager): void {
    const data = this.masterManager!.exportEntities(undefined, {
      asString: false,
      includeMetadata: false,
    });

    manager.importEntities(data);
  }
}
