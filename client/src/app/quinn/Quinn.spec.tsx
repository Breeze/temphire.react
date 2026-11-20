import { MantineProvider } from '@mantine/core';
import { act, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { AppServicesProvider, createAppServices } from '../core/services/app-services';
import { Quinn } from './Quinn';

/** The pane closes whenever the route changes, so it never covers the page the user went to. */
describe('Quinn', () => {
  beforeEach(() => {
    sessionStorage.clear();
    // Quinn loads its name and model when it appears; the header copes without them.
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
  });

  afterEach(() => vi.restoreAllMocks());

  function renderQuinn() {
    const router = createMemoryRouter([{ path: '/home', element: <Quinn /> }], {
      initialEntries: ['/home'],
    });
    render(
      <MantineProvider>
        <AppServicesProvider services={createAppServices()}>
          <RouterProvider router={router} />
        </AppServicesProvider>
      </MantineProvider>,
    );
    return router;
  }

  const pane = () => document.querySelector('.quinn-pane')!;

  it('closes the pane whenever the route changes', async () => {
    const router = renderQuinn();

    act(() => screen.getByRole('button', { name: 'Chat with Quinn' }).click());
    expect(pane()).toHaveClass('quinn-pane--open');

    await act(() => router.navigate('/home?tab=2'));
    expect(pane()).not.toHaveClass('quinn-pane--open');

    act(() => screen.getByRole('button', { name: 'Chat with Quinn' }).click());
    expect(pane()).toHaveClass('quinn-pane--open');

    await act(() => router.navigate(-1));
    expect(pane()).not.toHaveClass('quinn-pane--open');
  });
});
