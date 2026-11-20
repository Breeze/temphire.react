/**
 * Port of the Angular client's `environments/environment.ts` and `environment.development.ts`.
 *
 * Angular swapped one file for the other at build time (`fileReplacements` in `angular.json`).
 * Vite has no file replacement; it sets `import.meta.env.DEV` instead, `true` under `npm start` and
 * `false` in a production build, and the unused branch below is dropped from the bundle.
 */
const development = import.meta.env.DEV;

/**
 * In development the Vite dev server runs on 5173 and TempHire.Server on 5100 (see
 * `server.appsettings.json`), so the client talks to the API cross-origin; the server's CORS policy
 * allows http://localhost:5173.  In production the server serves the app itself, so the paths are
 * relative.
 */
const server = development ? 'http://localhost:5100' : '';

export const environment = {
  production: !development,
  /** Root of the Breeze controller - see `BreezeController`'s `[Route("api/breeze/[action]")]`. */
  breezeApiRoot: `${server}/api/breeze`,
  /** Root of the validation controller: the validation metadata, see `ValidationController`. */
  validationApiRoot: `${server}/api/validation`,
  /** Root of the account controller: who the signed-in user is. */
  accountApiRoot: `${server}/api/account`,
  /** Root of the agent controller - Quinn, see `AgentController`. */
  agentApiRoot: `${server}/api/agent`,
  /** Quinn's usage and budgets for the signed-in user - see `UsageController`. */
  usageApiRoot: `${server}/api/usage`,
  /**
   * The OAuth authorization server: TempHire.Server itself.  The browser goes there to sign in (the
   * sample users are offered on its sign-in page), and the app gets its tokens from there.  Empty
   * in production: the server that serves the app, whose origin `AuthService` uses.
   */
  authority: server,
};
