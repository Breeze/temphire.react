import { ReactNode, createContext, useContext, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router';

/** Asks whether the active screen may be left; resolves `false` to stay. */
export type CanLeave = () => Promise<boolean>;

/** Where the active screen files its question, and the shell asks it. */
interface LeaveGuardRegistry {
  register(canLeave: CanLeave): () => void;
  ask(): Promise<boolean>;
}

function createRegistry(): LeaveGuardRegistry {
  let current: CanLeave | null = null;
  return {
    register(canLeave) {
      current = canLeave;
      return () => {
        if (current === canLeave) {
          current = null;
        }
      };
    },
    ask: () => (current ? current() : Promise.resolve(true)),
  };
}

const LeaveGuardContext = createContext<LeaveGuardRegistry>(createRegistry());

/**
 * Holds the active screen's "may I leave?" question, so the shell can ask it before signing out.
 *
 * New in the React port.  Angular put the question on the route (`canDeactivate`), and the shell's
 * Logout navigated to Home first and only signed out if the navigation succeeded - the router
 * answered `false` when the screen said stay.  React Router has no route-level guard for leaving;
 * a component blocks navigation itself with `useBlocker` (see `useLeaveGuard`), and a navigation
 * does not report whether it was blocked.  So the screen also files its question here, and the
 * shell's Logout asks it directly (`useConfirmLeave`).
 *
 * The registry is created once, by `useState`'s initializer, and never replaced, so putting it in
 * context re-renders nothing.
 */
export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(createRegistry);
  return <LeaveGuardContext value={registry}>{children}</LeaveGuardContext>;
}

/**
 * Port of the Angular client's `pendingChangesGuard` / `CanComponentDeactivate`: while `ask` is
 * true, navigating to another page first calls `canLeave`, and stays put if it resolves `false`.
 * Changing only the query string - a link from Quinn to another person - is not leaving.
 */
export function useLeaveGuard(ask: boolean, canLeave: CanLeave): void {
  const registry = useContext(LeaveGuardContext);

  // The latest `canLeave`, in a ref.  A function made during render is new on every render, so
  // listing it as a dependency would re-run the effects below on every keystroke.  A ref is a box
  // that outlives renders; updating it after each render keeps it current without re-running them.
  const latest = useRef(canLeave);
  useEffect(() => {
    latest.current = canLeave;
  });

  // File the question for the shell's Logout, and withdraw it on unmount.
  useEffect(() => registry.register(() => latest.current()), [registry]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => ask && currentLocation.pathname !== nextLocation.pathname,
  );

  // When a navigation is blocked, ask, then let it go on or cancel it.  The `asking` ref stops a
  // second dialog if the component renders again while the first is open.
  const asking = useRef(false);
  useEffect(() => {
    if (blocker.state !== 'blocked' || asking.current) {
      return;
    }

    asking.current = true;
    void latest.current().then((mayLeave) => {
      asking.current = false;
      if (mayLeave) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    });
  }, [blocker]);
}

/** Asks the active screen whether it may be left; true when no screen has a question. */
export function useConfirmLeave(): CanLeave {
  return useContext(LeaveGuardContext).ask;
}
