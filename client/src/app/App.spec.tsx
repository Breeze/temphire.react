import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { App } from './App';
import { AppServicesProvider, createAppServices } from './core/services/app-services';

/**
 * Port of the Angular client's `app.spec.ts`.  Smoke test for the shell: with no session, the
 * toolbar stays hidden - the web equivalent of the WPF shell disabling its toolbar until
 * `IsLoggedIn` became true.
 */
describe('App', () => {
  beforeEach(() => sessionStorage.clear());

  function renderShell() {
    // A memory router: routes like the app's, without a browser address bar.
    const router = createMemoryRouter([
      { element: <App />, children: [{ path: '/', element: <p>The page</p> }] },
    ]);

    render(
      <MantineProvider>
        <AppServicesProvider services={createAppServices()}>
          <RouterProvider router={router} />
        </AppServicesProvider>
      </MantineProvider>,
    );
  }

  it('renders the shell around the page', async () => {
    renderShell();

    expect(await screen.findByText('The page')).toBeInTheDocument();
  });

  it('hides the toolbar and Quinn while logged out', async () => {
    renderShell();
    await screen.findByText('The page');

    expect(document.querySelector('.app-toolbar')).toBeNull();
    expect(screen.queryByLabelText('Chat with Quinn')).toBeNull();
  });
});
