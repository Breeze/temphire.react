import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import './styles.css';

import { ValidationProvider } from 'ideablade-validation/react';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { configureBreeze } from 'breeze-client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';

import { createRoutes } from './app/app.routes';
import { ErrorBoundary } from './app/core/ErrorBoundary';
import { apiFetch } from './app/core/services/api-fetch';
import { AppServicesProvider, createAppServices } from './app/core/services/app-services';
import { emptyBodyAsNull } from './app/core/services/breeze-fetch';
import { showError } from './app/core/services/error-handler';
import { temphireTheme } from './app/core/theme/temphire-theme';

/**
 * Starts the app.  Port of the Angular client's `main.ts` + `app.config.ts`.
 *
 * Angular listed its application-wide setup as *providers* in `appConfig`.  React has no provider
 * list: application-wide things are **components that wrap the app**, each putting something in
 * context for everything below it - the counterpart of a provider.
 */

/**
 * Breeze configuration - the counterpart of `TempHire/AppBootstrapper.cs` and of the
 * `provideAppInitializer` in `app.config.ts`.  Breeze 3's defaults match this server (backing-store
 * model library, JSON URI builder, Web API data service, camelCase naming); the one thing to set is
 * the transport.  `apiFetch` adds the access token, which in Angular `httpClientFetch` got from
 * `HttpClient`'s interceptor.
 *
 * WORKAROUND: `emptyBodyAsNull` works around a breeze-client 3.0.0 bug - see `breeze-fetch.ts`.
 */
configureBreeze({ fetch: emptyBodyAsNull(apiFetch) });

/** The services Angular's root injector would have created; see `app-services.tsx`. */
const services = createAppServices();

const router = createBrowserRouter(createRoutes(services));

// Uncaught errors and rejected promises go to the toast, as `provideBrowserGlobalErrorListeners`
// and the global `ErrorHandler` arranged in Angular.
window.addEventListener('error', (event) => showError(event.error ?? event));
window.addEventListener('unhandledrejection', (event) => showError(event.reason));

createRoot(document.getElementById('root')!).render(
  // StrictMode is a development aid: it renders every component twice, and runs every effect
  // twice (set up, clean up, set up), to bring out code that is not safe to repeat.  It does
  // nothing in a production build.  See `AuthCallback` for code it shaped.
  <StrictMode>
    {/* Mantine: the theme - `provideOptimus({ theme: ... })` in Angular. */}
    <MantineProvider theme={temphireTheme}>
      <ErrorBoundary>
        <AppServicesProvider services={services}>
          {/* The validation hooks' service - `provideValidation` in Angular. */}
          <ValidationProvider service={services.validation}>
            {/* Dialogs (dialog.service.tsx) render here, inside the services' context. */}
            <ModalsProvider>
              {/* The toasts - `<p-toast />` in Angular.  On top of everything: Mantine's default
                  (400) put them behind the sticky toolbar (900), and they must show over the
                  dialogs (1100) and dropdowns (1200) too - see `temphire-theme.ts`. */}
              <Notifications position="top-right" zIndex={1300} />
              <RouterProvider router={router} />
            </ModalsProvider>
          </ValidationProvider>
        </AppServicesProvider>
      </ErrorBoundary>
    </MantineProvider>
  </StrictMode>,
);
