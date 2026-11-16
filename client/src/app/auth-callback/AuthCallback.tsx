import { Alert, Button, Loader } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { useServices } from '../core/services/app-services';
import { AuthService } from '../core/services/auth.service';
import './AuthCallback.css';

/**
 * The sign-ins in progress, by their query string.  See the effect below for why.
 */
const completing = new Map<string, Promise<string>>();

function completeOnce(auth: AuthService, search: string): Promise<string> {
  let promise = completing.get(search);
  if (!promise) {
    promise = auth.completeSignIn(new URLSearchParams(search));
    completing.set(search, promise);
  }
  return promise;
}

/**
 * Where the server's sign-in page sends the browser back to, with a code (`/auth/callback`).
 *
 * Port of the Angular client's `auth-callback/auth-callback.component.ts`: redeem the code
 * (`AuthService.completeSignIn`) and go on to the page the user asked for - or, if that fails, say
 * why and offer to try again.
 *
 * **Effects instead of lifecycle hooks.**  Angular ran this in `ngOnInit`.  React components have
 * no lifecycle methods; work that should happen *because the component is on screen* goes in
 * `useEffect`, which runs after the component has rendered.  An empty dependency array - `[]`, or
 * here values that never change - means "once, after the first render", the closest thing to
 * `ngOnInit`.
 *
 * **Why `completeOnce`.**  In development, React's StrictMode mounts every component twice -
 * mount, unmount, mount - and so runs this effect twice.  That is deliberate: it finds code that
 * isn't safe to run again.  Redeeming the same code twice is exactly such code (the second attempt
 * fails, because a code can be used once), so both runs share one promise.  In a production build
 * the effect runs once anyway.
 */
export function AuthCallback() {
  const { auth } = useServices();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Set when React unmounts this component (or StrictMode's first, rehearsal mount), so a late
    // result does not navigate from a component that is gone.
    let cancelled = false;

    completeOnce(auth, window.location.search).then(
      (returnUrl) => {
        if (!cancelled) {
          // Replace the callback in the history, so Back never goes to a used code.
          void navigate(returnUrl, { replace: true });
        }
      },
      (failure: unknown) => {
        if (!cancelled) {
          setError(failure instanceof Error ? failure.message : 'The sign-in failed.');
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [auth, navigate]);

  return (
    <div className="callback">
      {error ? (
        <div className="callback__card">
          <Alert color="red">{error}</Alert>
          <Button onClick={() => void auth.signIn()}>Sign in again</Button>
        </div>
      ) : (
        <>
          <Loader color="white" aria-label="Signing in" />
          <span className="callback__text">Signing in...</span>
        </>
      )}
    </div>
  );
}
