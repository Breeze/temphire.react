import { Center, Loader } from '@mantine/core';
import { IconHome, IconUsers } from '@tabler/icons-react';
import { ReactNode } from 'react';
import { Navigate, RouteObject } from 'react-router';

import { App } from './App';
import { AppServices } from './core/services/app-services';
import { authLoader, roleLoader } from './core/services/auth.guard';
import { Roles } from './core/services/roles';

/** Who may open Resource Management: editors and readers.  Only editors may change anything there. */
const RESOURCE_MGT_ROLES = [Roles.Editor, Roles.Reader];

/**
 * Port of the Angular client's `app.routes.ts` (Punch's workspace navigation).
 *
 * The same routes, in React Router's data-router form:
 *
 *  - `canActivate: [authGuard]` becomes `loader: authLoader(services)` - see `auth.guard.ts`;
 *  - `loadComponent: () => import(...)` becomes `lazy: () => import(...)`, which loads the screen
 *    as its own chunk the first time the route is visited;
 *  - `canDeactivate: [pendingChangesGuard]` has no route-level counterpart: React Router blocks a
 *    navigation from *inside* the component, with `useBlocker` (see `leave-guard.tsx`, used by
 *    `ResourceMgt`);
 *  - the routes are children of `App`, the shell, which renders the active one through `<Outlet />`
 *    - Angular's `<router-outlet />`.
 *
 * The routes are built by a function because the loaders need the app's services, which a loader
 * cannot get through hooks.
 */
export function createRoutes(services: AppServices): RouteObject[] {
  return [
    {
      element: <App />,
      // Shown while the first route's loader runs on page load - restoring the session, say.
      hydrateFallbackElement: (
        <Center h="100vh">
          <Loader aria-label="Loading" />
        </Center>
      ),
      children: [
        {
          // Where the server's sign-in page sends the browser back to; see AuthService.signIn.
          path: 'auth/callback',
          lazy: () =>
            import('./auth-callback/AuthCallback').then((m) => ({ Component: m.AuthCallback })),
        },
        {
          path: 'home',
          loader: authLoader(services),
          lazy: () => import('./home/Home').then((m) => ({ Component: m.Home })),
        },
        {
          path: 'resourcemgt',
          loader: roleLoader(services, ...RESOURCE_MGT_ROLES),
          lazy: () =>
            import('./resource-mgt/ResourceMgt').then((m) => ({ Component: m.ResourceMgt })),
        },
        {
          // Quinn's usage and budgets, from the user menu; not a workspace in the toolbar.
          path: 'usage',
          loader: authLoader(services),
          lazy: () => import('./usage/Usage').then((m) => ({ Component: m.Usage })),
        },
        { index: true, element: <Navigate to="/home" replace /> },
        { path: '*', element: <Navigate to="/home" replace /> },
      ],
    },
  ];
}

/** Port of `Common/Workspace/IWorkspace.cs` - what the shell toolbar is built from. */
export interface Workspace {
  displayName: string;
  route: string;
  sequence: number;
  isDefault: boolean;
  /** Roles that may open the workspace; anyone signed in if absent.  The route's loader enforces it. */
  roles?: readonly string[];
  icon?: ReactNode;
}

export const WORKSPACES: Workspace[] = [
  { displayName: 'Home', route: '/home', sequence: 10, isDefault: true, icon: <IconHome size={16} /> },
  {
    displayName: 'Resource Management',
    route: '/resourcemgt',
    sequence: 20,
    isDefault: false,
    roles: RESOURCE_MGT_ROLES,
    icon: <IconUsers size={16} />,
  },
];
