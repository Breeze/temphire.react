import { notifications } from '@mantine/notifications';
import { LoaderFunctionArgs, redirect } from 'react-router';

import { AppServices } from './app-services';
import { hasAnyRole } from './auth.service';

/**
 * Port of the Angular client's `core/services/auth.guard.ts`.
 *
 * Angular's route guards (`canActivate`) became React Router **loaders**: a route's `loader` runs
 * before the route renders, and can let it through (return a value), send the user elsewhere
 * (return `redirect(...)`), or keep it from rendering.  Like a guard, a loader runs outside any
 * component, so it cannot use hooks; it gets the services as an argument instead (see
 * `app.routes.tsx`).
 *
 * The rules are unchanged:
 *
 *  - a user who isn't signed in is sent to the server's sign-in page, and comes back to the page
 *    they asked for;
 *  - after a browser refresh, the tokens survive in session storage but the Breeze caches do not,
 *    and `restoreSession()` rebuilds them before the route renders;
 *  - a signed-in user without one of a route's roles goes to Home, with a short message.
 *
 * This only decides what the client shows.  The server enforces the same roles on the data itself.
 */
export function authLoader(services: AppServices) {
  return requireRoles(services);
}

/** Keeps a route to users with one of `roles`, for example Resource Management to editors and readers. */
export function roleLoader(services: AppServices, ...roles: string[]) {
  return requireRoles(services, roles);
}

function requireRoles(services: AppServices, roles?: readonly string[]) {
  return async ({ request }: LoaderFunctionArgs) => {
    const { auth } = services;

    if (!(await auth.restoreSession())) {
      const url = new URL(request.url);
      await auth.signIn(url.pathname + url.search);
      // The browser is on its way to the sign-in page.  A promise that never settles keeps the
      // route from rendering meanwhile - the counterpart of a guard returning `false`.
      return new Promise<never>(() => {});
    }

    if (roles && !hasAnyRole(auth.getState(), roles)) {
      notifications.show({
        color: 'yellow',
        title: 'No access',
        message: "Your account doesn't have access to that page.",
        autoClose: 6000,
      });
      return redirect('/home');
    }

    return null;
  };
}
