/**
 * Port of the Angular client's `core/services/auth.interceptor.ts`.
 *
 * Angular had `HttpClient`, and an interceptor that every request passed through.  React has no
 * HTTP client of its own: requests are made with the browser's `fetch`.  So the interceptor becomes
 * a wrapper around `fetch` - `apiFetch` - that every request in the app is made with: Breeze's (it is
 * handed to `configureBreeze` in `main.tsx`), the account and agent calls, and Quinn's streaming
 * chat.  It does what the interceptor did:
 *
 *  - attaches the access token, renewed first when it is about to expire;
 *  - leaves requests to the authorization server itself (`/connect/token`) alone: they are how the
 *    app gets a token;
 *  - on a 401 for a request that carried a token, forgets the session and signs in again.
 *
 * Only 401 means "your token is no good".  403 must NOT be treated as an auth failure: Breeze's
 * `EntityErrorsException` defaults to 403, so every save that fails server-side validation arrives
 * as a 403 with an `EntityErrors` payload.  Signing out on that would throw away the user's pending
 * edits instead of showing them what to fix.
 */

/** What `apiFetch` needs from the session; `AuthService` provides it (see `app-services.tsx`). */
export interface TokenSource {
  accessToken(): Promise<string | null>;
  isAuthorizationServerRequest(url: string): boolean;
  clearSession(): void;
  signIn(returnUrl?: string): Promise<void>;
}

let tokenSource: TokenSource | null = null;

/** Connects `apiFetch` to the session - the counterpart of `withInterceptors([authInterceptor])`. */
export function setTokenSource(source: TokenSource | null): void {
  tokenSource = source;
}

/** `fetch`, with the access token attached; see the file comment. */
export async function apiFetch(input: RequestInfo | URL, request: RequestInit = {}): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const tokens = tokenSource;

  // No cookies on cross-origin requests.  The app proves who it is with the bearer token, never
  // with a cookie; and Breeze asks for `credentials: 'include'`, which the server's CORS policy
  // rightly refuses for the dev server on another port.  Angular's `HttpClient` sent no
  // credentials either, which is why the Angular client never met this.
  const init: RequestInit = { ...request, credentials: 'same-origin' };

  if (!tokens || tokens.isAuthorizationServerRequest(url)) {
    return fetch(input, init);
  }

  const token = await tokens.accessToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  // A 401 for a request that carried a token means the token was revoked or the server's keys
  // changed.  Sign in again; if the user is still signed in on the server, that is a quick round
  // trip that doesn't show the sign-in page.
  if (response.status === 401 && token) {
    tokens.clearSession();
    void tokens.signIn(window.location.pathname + window.location.search);
  }

  return response;
}

/**
 * A failed request that is not Breeze's: the response's status and its body, read as text.  The
 * counterpart of Angular's `HttpErrorResponse`; `describe` in `error-handler.ts` reads both.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    statusText: string,
  ) {
    super(statusText || `Request failed with status ${status}.`);
    this.name = 'HttpError';
  }
}

/** `apiFetch`, throwing an `HttpError` for a response that is not OK. */
export async function apiRequest(input: string, init: RequestInit = {}): Promise<Response> {
  const response = await apiFetch(input, init);
  if (!response.ok) {
    throw new HttpError(response.status, await response.text().catch(() => ''), response.statusText);
  }
  return response;
}

/** GETs JSON - the counterpart of `HttpClient.get<T>`. */
export async function getJson<T>(url: string): Promise<T> {
  return (await apiRequest(url)).json() as Promise<T>;
}
