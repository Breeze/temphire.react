import { createValidationService } from '@ideablade/validation';
import { vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { apiFetch, setTokenSource } from './api-fetch';
import { AuthService } from './auth.service';
import { EntityManagerProvider } from './entity-manager-provider';
import { UnitOfWorkManager } from './unit-of-work-manager';

/**
 * Port of the Angular client's `core/services/auth.interceptor.spec.ts`: the interceptor became
 * `apiFetch`, and `HttpTestingController` became a stand-in for the browser's `fetch`.
 */
describe('apiFetch', () => {
  const resourcesUrl = `${environment.breezeApiRoot}/StaffingResources`;
  const tokenUrl = `${environment.authority || window.location.origin}/connect/token`;

  let fetchMock: ReturnType<typeof vi.fn>;

  /** Signs in with stored tokens whose access token expires in `expiresInMs`. */
  function setUp(expiresInMs: number | null) {
    sessionStorage.clear();
    if (expiresInMs !== null) {
      sessionStorage.setItem(
        'temphire.tokens',
        JSON.stringify({
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
          expiresAt: Date.now() + expiresInMs,
        }),
      );
    }

    const validation = createValidationService();
    const emProvider = new EntityManagerProvider(validation);
    const auth = new AuthService(emProvider, new UnitOfWorkManager(emProvider));
    const signIn = vi.spyOn(auth, 'signIn').mockResolvedValue();
    setTokenSource(auth);
    return { signIn };
  }

  /** The `Authorization` header of the `index`th request. */
  const authorization = (index: number) =>
    new Headers((fetchMock.mock.calls[index][1] as RequestInit).headers).get('Authorization');

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setTokenSource(null);
    sessionStorage.clear();
  });

  it('attaches the access token', async () => {
    setUp(30 * 60_000);

    await apiFetch(resourcesUrl);

    expect(authorization(0)).toBe('Bearer access-1');
  });

  it('sends no cookies, even when asked to', async () => {
    setUp(30 * 60_000);

    // Breeze asks for `credentials: 'include'`; the token is all the server needs.
    await apiFetch(resourcesUrl, { credentials: 'include' });

    expect((fetchMock.mock.calls[0][1] as RequestInit).credentials).toBe('same-origin');
  });

  it('renews an access token about to expire, once for requests made together', async () => {
    setUp(10_000);
    fetchMock.mockImplementation(async (url: string) =>
      url === tokenUrl
        ? Response.json({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 1800 })
        : new Response('[]'),
    );

    await Promise.all([apiFetch(resourcesUrl), apiFetch(`${resourcesUrl}?second`)]);

    // One refresh, without a bearer token: it goes to the authorization server.
    const refreshes = fetchMock.mock.calls.filter(([url]) => url === tokenUrl);
    expect(refreshes).toHaveLength(1);
    const body = (refreshes[0][1] as RequestInit).body!.toString();
    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('refresh_token=refresh-1');
    expect(new Headers((refreshes[0][1] as RequestInit).headers).has('Authorization')).toBe(false);

    const requests = fetchMock.mock.calls
      .map((call, index) => [call[0], index] as const)
      .filter(([url]) => String(url).startsWith(resourcesUrl));
    for (const [, index] of requests) {
      expect(authorization(index)).toBe('Bearer access-2');
    }

    // The server rotated the refresh token; the next renewal must use the new one.
    expect(JSON.parse(sessionStorage.getItem('temphire.tokens')!).refreshToken).toBe('refresh-2');
  });

  it('signs in again when the server rejects the token', async () => {
    const { signIn } = setUp(30 * 60_000);
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await apiFetch(resourcesUrl);

    expect(response.status).toBe(401);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('temphire.tokens')).toBeNull();
  });

  it('does not start a sign-in for a 401 to a request that carried no token', async () => {
    const { signIn } = setUp(null);
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    await apiFetch(resourcesUrl);

    expect(authorization(0)).toBeNull();
    expect(signIn).not.toHaveBeenCalled();
  });
});
