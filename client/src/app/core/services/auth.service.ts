import { environment } from '../../../environments/environment';
import { TokenSource, apiFetch, getJson, HttpError } from './api-fetch';
import { ChangeNotifier } from './change-notifier';
import { EntityManagerProvider } from './entity-manager-provider';
import { challengeFor, randomString } from './pkce';
import { Roles } from './roles';
import { UnitOfWorkManager } from './unit-of-work-manager';

/** `GET api/account/me`: who the access token belongs to. */
interface UserInfo {
  username: string;
  /** The company the user works for: their tenant, from the email domain. */
  tenantName: string;
  /** The user's roles: `Editor`, `Reader`, or none. */
  roles: string[];
}

/** The token endpoint's answer (RFC 6749, section 5.1). */
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  /** Seconds. */
  expires_in: number;
}

/** The tokens, kept in session storage: per tab, and gone when the tab closes. */
interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds. */
  expiresAt: number;
}

/** What a sign-in started, kept until the browser comes back with the code. */
interface PendingSignIn {
  state: string;
  verifier: string;
  returnUrl: string;
}

/**
 * What the UI shows about the session.  One immutable object, replaced whenever anything in it
 * changes, because that is what React's `useSyncExternalStore` needs: it decides whether to render
 * again by comparing the snapshot it gets with the last one, by identity.  See `useAuth`.
 */
export interface AuthState {
  readonly isLoggedIn: boolean;
  readonly username: string | null;
  /** The signed-in user's company (tenant), e.g. "Harbor Staffing". */
  readonly tenantName: string | null;
  /**
   * The signed-in user's roles, from the server.  They decide what the client shows; the server
   * enforces them on every request, from the roles signed into the token.
   */
  readonly roles: readonly string[];
  /** May add, change and delete staffing resources: an editor. */
  readonly canEditStaffing: boolean;
}

const TOKENS_KEY = 'temphire.tokens';
const PENDING_SIGN_IN_KEY = 'temphire.signIn';

/** Renew the access token when it has less than this left, rather than send one about to expire. */
const RENEW_BEFORE_MS = 60_000;

/** The client id the server registers for this app - see `OAuthSettings.SpaClientId`. */
const CLIENT_ID = 'temphire-spa';

/** The scopes the app asks for: the staffing data, and a refresh token to stay signed in. */
const SCOPES = 'staffing offline_access';

/** The authorization server: TempHire's own server (`environment.authority`, or this origin). */
const authority = (): string => environment.authority || window.location.origin;

export function hasAnyRole(state: AuthState, roles: readonly string[]): boolean {
  return roles.some((role) => state.roles.includes(role));
}

/**
 * Port of the Angular client's `core/services/auth.service.ts` (and before it of
 * `TempHireAuthenticationService.cs`, Punch's `IAuthenticationService`): an OAuth 2.1 client.
 *
 * The app never sees the password: `signIn` sends the browser to the server's sign-in page with
 * the Authorization Code flow and PKCE, the browser comes back to `/auth/callback` with a code, and
 * `completeSignIn` redeems it for an access token and a refresh token.  `apiFetch` puts the access
 * token on every request, and `accessToken()` renews it shortly before it expires.
 *
 * The logic is unchanged from Angular.  What changed is how the UI sees the session: Angular read
 * signals (`auth.isLoggedIn()`); here the service keeps an `AuthState` snapshot and notifies its
 * subscribers, and components read it with the `useAuth()` hook.
 */
export class AuthService extends ChangeNotifier implements TokenSource {
  private tokens: StoredTokens | null = readJson<StoredTokens>(TOKENS_KEY);
  private user: UserInfo | null = null;
  private snapshot: AuthState = this.buildState();

  /** A refresh in progress, shared by every request that needs a token meanwhile. */
  private renewing: Promise<string | null> | null = null;

  constructor(
    private readonly emProvider: EntityManagerProvider,
    private readonly unitOfWorkManager: UnitOfWorkManager,
  ) {
    super();
  }

  /** The current `AuthState`: the same object until something in it changes. */
  readonly getState = (): AuthState => this.snapshot;

  /** True for requests to the authorization server itself, which carry no access token. */
  isAuthorizationServerRequest(url: string): boolean {
    return url.startsWith(`${authority()}/connect/`);
  }

  /**
   * Sends the browser to the server's sign-in page.  Comes back to `/auth/callback`, and from there
   * to `returnUrl`.  If the user is still signed in on the server (its own cookie), the server sends
   * the browser straight back without showing the page.
   */
  async signIn(returnUrl = '/home'): Promise<void> {
    const pending: PendingSignIn = { state: randomString(), verifier: randomString(), returnUrl };
    sessionStorage.setItem(PENDING_SIGN_IN_KEY, JSON.stringify(pending));

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: redirectUri(),
      scope: SCOPES,
      state: pending.state,
      code_challenge: await challengeFor(pending.verifier),
      code_challenge_method: 'S256',
    });

    window.location.assign(`${authority()}/connect/authorize?${params.toString()}`);
  }

  /**
   * The second half of `signIn`: checks the answer from the authorization server, redeems the code
   * for tokens, then prepares the Breeze metadata and lookup cache.  Returns where to go next.
   */
  async completeSignIn(query: URLSearchParams): Promise<string> {
    const pending = readJson<PendingSignIn>(PENDING_SIGN_IN_KEY);
    sessionStorage.removeItem(PENDING_SIGN_IN_KEY);

    const error = query.get('error');
    if (error) {
      throw new Error(query.get('error_description') ?? `Sign-in failed (${error}).`);
    }

    // The state must be the one this tab sent: otherwise the code is someone else's, slipped in.
    const code = query.get('code');
    if (!pending || !code || query.get('state') !== pending.state) {
      throw new Error('The sign-in could not be completed. Please sign in again.');
    }

    await this.requestTokens({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: CLIENT_ID,
      code_verifier: pending.verifier,
    });

    if (!(await this.restoreSession())) {
      throw new Error('Failed to load the entity metadata and lookup cache. Please try again.');
    }

    return pending.returnUrl;
  }

  /**
   * The access token for a request, renewed first if it is about to expire.  Null when signed out,
   * or when the refresh token is no longer accepted (the user then has to sign in again).
   */
  accessToken(): Promise<string | null> {
    const tokens = this.tokens;
    if (!tokens) {
      return Promise.resolve(null);
    }

    if (tokens.expiresAt - Date.now() > RENEW_BEFORE_MS || !tokens.refreshToken) {
      return Promise.resolve(tokens.accessToken);
    }

    this.renewing ??= this.requestTokens({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: CLIENT_ID,
    })
      .then((renewed) => renewed.accessToken)
      .catch(() => {
        this.clearSession();
        return null;
      })
      .finally(() => (this.renewing = null));

    return this.renewing;
  }

  /**
   * Signs out of the app and of the server: forgets the tokens, then sends the browser to the
   * server's end-session endpoint, which ends its sign-in cookie and sends the browser back here.
   */
  logout(): void {
    this.clearSession();

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      post_logout_redirect_uri: `${window.location.origin}/`,
    });
    window.location.assign(`${authority()}/connect/logout?${params.toString()}`);
  }

  /**
   * Makes sure the app is ready for a signed-in user: after `completeSignIn`, and after a browser
   * refresh, when the tokens are still in session storage but the in-memory EntityManagers are gone.
   */
  async restoreSession(): Promise<boolean> {
    if (!this.tokens) {
      return false;
    }

    if (this.emProvider.isPrepared && this.user) {
      return true;
    }

    try {
      this.user = await getJson<UserInfo>(`${environment.accountApiRoot}/me`);
      this.update();
      await this.emProvider.prepare();
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  /** Forgets the tokens and everything loaded with them, without leaving the page. */
  clearSession(): void {
    sessionStorage.removeItem(TOKENS_KEY);
    this.tokens = null;
    this.user = null;
    this.unitOfWorkManager.clear();
    this.emProvider.reset();
    this.update();
  }

  /** Calls the token endpoint and keeps the tokens it returns. */
  private async requestTokens(grant: Record<string, string>): Promise<StoredTokens> {
    const response = await apiFetch(`${authority()}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(grant),
    });

    if (!response.ok) {
      throw new HttpError(response.status, await response.text(), response.statusText);
    }

    const body = (await response.json()) as TokenResponse;
    const tokens: StoredTokens = {
      accessToken: body.access_token,
      // The server rotates the refresh token at each use: always keep the newest.
      refreshToken: body.refresh_token ?? this.tokens?.refreshToken ?? null,
      expiresAt: Date.now() + body.expires_in * 1000,
    };

    sessionStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    const wasLoggedIn = !!this.tokens;
    this.tokens = tokens;
    if (!wasLoggedIn) {
      this.update();
    }
    return tokens;
  }

  /** Replaces the snapshot and tells the subscribers - React then renders what depends on it. */
  private update(): void {
    this.snapshot = this.buildState();
    this.notify();
  }

  private buildState(): AuthState {
    const roles = this.user?.roles ?? [];
    const state = {
      isLoggedIn: !!this.tokens,
      username: this.user?.username ?? null,
      tenantName: this.user?.tenantName ?? null,
      roles,
      canEditStaffing: false,
    };
    state.canEditStaffing = hasAnyRole(state, [Roles.Editor]);
    return state;
  }
}

/** Where the authorization server sends the browser back to; registered for this client. */
function redirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

function readJson<T>(key: string): T | null {
  try {
    const value = sessionStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}
