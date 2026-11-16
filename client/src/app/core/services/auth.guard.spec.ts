import { notifications } from '@mantine/notifications';
import { LoaderFunctionArgs } from 'react-router';
import { vi } from 'vitest';

import { AppServices } from './app-services';
import { roleLoader } from './auth.guard';
import { AuthState } from './auth.service';
import { Roles } from './roles';

/**
 * Port of the Angular client's `core/services/auth.guard.spec.ts`.  A loader, like a guard, is a
 * plain function, so the test calls it directly with a stand-in for the services.
 */
describe('roleLoader', () => {
  const signedIn = { value: true };
  const roles = { value: [] as string[] };
  const auth = {
    restoreSession: async () => signedIn.value,
    getState: () => ({ roles: roles.value }) as unknown as AuthState,
    signIn: vi.fn(async (_returnUrl?: string) => undefined),
  };
  const services = { auth } as unknown as AppServices;

  beforeEach(() => {
    signedIn.value = true;
    roles.value = [];
    auth.signIn.mockClear();
    vi.spyOn(notifications, 'show').mockImplementation(() => '');
  });

  afterEach(() => vi.restoreAllMocks());

  const run = (...allowed: string[]) =>
    roleLoader(services, ...allowed)({
      request: new Request('http://localhost:5173/resourcemgt'),
      params: {},
    } as LoaderFunctionArgs);

  it('lets a user with one of the roles in', async () => {
    roles.value = [Roles.Reader];

    expect(await run(Roles.Editor, Roles.Reader)).toBeNull();
  });

  it('sends a signed-in user without the role to the home page, with a message', async () => {
    roles.value = [];

    const result = (await run(Roles.Editor, Roles.Reader)) as Response;

    expect(result.status).toBe(302);
    expect(result.headers.get('Location')).toBe('/home');
    expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ color: 'yellow' }));
  });

  it('sends a user who is not signed in to sign in, coming back to where they were going', async () => {
    signedIn.value = false;

    // The loader never settles while the browser leaves for the sign-in page.
    const outcome = await Promise.race([
      run(Roles.Editor).then(() => 'settled'),
      new Promise((resolve) => setTimeout(() => resolve('pending'), 50)),
    ]);

    expect(outcome).toBe('pending');
    expect(auth.signIn).toHaveBeenCalledWith('/resourcemgt');
  });
});
