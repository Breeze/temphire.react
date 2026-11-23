import { ValidationService, createValidationService } from '@ideablade/validation';
import { breezeModelType, breezeRuleSource, breezeValidator } from '@ideablade/validation/breeze';
import { ReactNode, createContext, useContext, useSyncExternalStore } from 'react';

import { clientValidationMetadata } from '../validation/client-validation-metadata';
import { setTokenSource } from './api-fetch';
import { AuthService, AuthState } from './auth.service';
import { EntityManagerProvider } from './entity-manager-provider';
import { SaveHandler } from './save-handler';
import { ResourceMgtUnitOfWorkManager } from './resource-mgt-unit-of-work-manager';
import { UnitOfWorkManagers } from './unit-of-work-manager';

/**
 * The app's long-lived services, and how components get at them.
 *
 * New in the React port; it replaces Angular's dependency injection.
 *
 * In Angular, a service marked `@Injectable({ providedIn: 'root' })` was created once by the root
 * injector, and a component asked for it with `inject(AuthService)`.  React has no injector.  The
 * idiomatic replacement is **context**: a value placed in a `<Context value={...}>` element is
 * available to every component below it, which reads it with `useContext(Context)`.
 *
 * So `createAppServices` news up the services once (in `main.tsx`), `<AppServicesProvider>` puts
 * them in context at the top of the tree, and `useServices()` is the `inject()` of this app.  A test
 * can wrap a component in a provider with stand-ins, as `TestBed` providers did.
 *
 * Context carries the services, not their state.  A component that shows state - who is signed in,
 * say - also subscribes to it, with `useAuth()` below, so that it renders again when it changes.
 */
export interface AppServices {
  readonly emProvider: EntityManagerProvider;
  /** Every workspace's unit-of-work managers, for what concerns them all: saves, sign-out. */
  readonly unitOfWorkManagers: UnitOfWorkManagers;
  /** The Resource Management workspace's units of work. */
  readonly resourceMgtUnitOfWorkManager: ResourceMgtUnitOfWorkManager;
  readonly auth: AuthService;
  /** The app's validation service; `main.tsx` provides it to the validation hooks. */
  readonly validation: ValidationService;
  /** How every workspace saves: validates first, and drops the shared cache after a save. */
  readonly saveHandler: SaveHandler;
}

export function createAppServices(): AppServices {
  /**
   * Validation (`@ideablade/validation`) - the counterpart of `provideValidation` in the Angular
   * client's `app.config.ts`.
   *
   * The rules come from the server's validation metadata, which `EntityManagerProvider` loads at
   * sign-in next to the Breeze metadata and installs into Breeze; the view models' metadata is the
   * client's own (`clientValidationMetadata`).
   *
   *  - `breezeValidator` brings Breeze's own rules into the framework (`clientValidationMetadata`),
   *    so form fields show them like every other rule;
   *  - `breezeModelType` lets `ValidationForm` find an entity's model type itself;
   *  - `breezeRuleSource` lets a view model property inherit an entity property's Breeze rules with
   *    `from` (the name editor).
   *
   * This is the app's validation service.  The resource management route has its own, whose entity
   * store is the unit of work being shown (see `ResourceMgt`).
   */
  const validation = createValidationService({
    metadata: clientValidationMetadata,
    validators: [breezeValidator],
    modelTypeResolvers: [breezeModelType],
    // A function: the metadata store's types arrive at sign-in.
    ruleSources: [breezeRuleSource(() => emProvider.metadataStore)],
  });
  const emProvider = new EntityManagerProvider(validation);
  const unitOfWorkManagers = new UnitOfWorkManagers();
  const resourceMgtUnitOfWorkManager = new ResourceMgtUnitOfWorkManager(emProvider, unitOfWorkManagers);
  const auth = new AuthService(emProvider, unitOfWorkManagers);
  const saveHandler = new SaveHandler(unitOfWorkManagers);

  // Every request goes through `apiFetch`, which gets its token from the session - the counterpart
  // of `provideHttpClient(withInterceptors([authInterceptor]))`.
  setTokenSource(auth);

  return { emProvider, unitOfWorkManagers, resourceMgtUnitOfWorkManager, auth, validation, saveHandler };
}

const AppServicesContext = createContext<AppServices | null>(null);

export function AppServicesProvider({
  services,
  children,
}: {
  services: AppServices;
  children: ReactNode;
}) {
  return <AppServicesContext value={services}>{children}</AppServicesContext>;
}

/** The app's services - the React counterpart of `inject(...)`. */
export function useServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) {
    throw new Error('useServices() must be called inside <AppServicesProvider>.');
  }
  return services;
}

/**
 * The session as the UI sees it, kept current: the component that calls this renders again
 * whenever someone signs in or out, or the roles arrive.  Angular read signals for this
 * (`auth.isLoggedIn()`, `auth.roles()`); React subscribes to the service as an external store.
 */
export function useAuth(): AuthState {
  const { auth } = useServices();
  return useSyncExternalStore(auth.subscribe, auth.getState);
}
