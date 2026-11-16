import { ReactNode, createContext, useContext, useSyncExternalStore } from 'react';

import { setTokenSource } from './api-fetch';
import { AuthService, AuthState } from './auth.service';
import { EntityManagerProvider } from './entity-manager-provider';
import { UnitOfWorkManager } from './unit-of-work-manager';

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
  readonly unitOfWorkManager: UnitOfWorkManager;
  readonly auth: AuthService;
}

export function createAppServices(): AppServices {
  const emProvider = new EntityManagerProvider();
  const unitOfWorkManager = new UnitOfWorkManager(emProvider);
  const auth = new AuthService(emProvider, unitOfWorkManager);

  // Every request goes through `apiFetch`, which gets its token from the session - the counterpart
  // of `provideHttpClient(withInterceptors([authInterceptor]))`.
  setTokenSource(auth);

  return { emProvider, unitOfWorkManager, auth };
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
