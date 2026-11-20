import { Button } from '@mantine/core';
import { IconLogout } from '@tabler/icons-react';
import { Outlet, useNavigate } from 'react-router';

import './App.css';
import { WORKSPACES } from './app.routes';
import { useAuth, useServices } from './core/services/app-services';
import { hasAnyRole } from './core/services/auth.service';
import { LeaveGuardProvider, useConfirmLeave } from './core/services/leave-guard';
import {
  ToolbarGroup,
  ToolbarProvider,
  toolbarActions,
  useToolbarGroups,
} from './core/services/toolbar';
import { FrameworkMark } from './core/FrameworkMark';
import { Quinn } from './quinn/Quinn';

/**
 * The shell: the toolbar across the top, the active workspace underneath, and Quinn.
 *
 * Port of the Angular client's `app.ts` + `app.html` (and before them of
 * `TempHire/Views/ShellView.Wpf.xaml` + `ViewModels/ShellViewModel.cs`).
 *
 * `App` only provides the contexts its children share - the toolbar's groups and the leave guard -
 * and `Shell` renders.  Two components rather than one because a component cannot read a context it
 * provides itself: `useToolbarGroups()` must be called *below* `<ToolbarProvider>`.
 */
export function App() {
  return (
    <ToolbarProvider>
      <LeaveGuardProvider>
        <Shell />
      </LeaveGuardProvider>
    </ToolbarProvider>
  );
}

function Shell() {
  const { auth } = useServices();
  const session = useAuth();
  const navigate = useNavigate();
  const confirmLeave = useConfirmLeave();
  const screenGroups = useToolbarGroups();

  /**
   * Port of `ShellViewModel.Logout`, which returned to the default workspace before logging out.
   * The active screen has its say first - Resource Management asks what to do with unsaved edits,
   * and the user can stay.  Signing out then leaves the app for the server's end-session endpoint,
   * which comes back to the sign-in page.
   */
  async function logout(): Promise<void> {
    if (await confirmLeave()) {
      await navigate('/home');
      auth.logout();
    }
  }

  // Port of `ShellViewModel.StartAsync`: one toolbar group for the workspaces, one for Logout.  Only
  // the workspaces the user's roles allow are listed; the routes' loaders enforce the same rule.
  //
  // There is no `computed` here, nor any need for one: this function runs again whenever the
  // session or the screen's groups change, and simply works the toolbar out afresh each time.
  const workspaceGroup: ToolbarGroup = {
    level: 0,
    actions: [...WORKSPACES]
      .filter((workspace) => !workspace.roles || hasAnyRole(session, workspace.roles))
      .sort((a, b) => a.sequence - b.sequence)
      .map((workspace) => ({
        label: workspace.displayName,
        icon: workspace.icon,
        execute: () => void navigate(workspace.route),
      })),
  };

  const logoutGroup: ToolbarGroup = {
    level: 100,
    actions: [{ label: 'Logout', icon: <IconLogout size={16} />, execute: () => void logout() }],
  };

  // The toolbar: the shell's own groups plus whatever the active screen contributed, and nothing
  // while signed out.
  const actions = session.isLoggedIn
    ? toolbarActions([workspaceGroup, logoutGroup, ...screenGroups])
    : [];

  const initial = (session.username ?? '?').charAt(0).toUpperCase();

  // JSX: `{condition && <element />}` is `@if`; `array.map(...)` is `@for`; `className` is
  // `class` (a reserved word in JavaScript); `onClick={...}` is `(click)="..."`.
  return (
    <div className="app">
      {session.isLoggedIn && (
        <header className="app-toolbar">
          <span className="app-toolbar__brand">
            <span className="app-toolbar__badge temphire-orb" aria-hidden="true">
              T
              <FrameworkMark />
            </span>
            TempHire
          </span>

          <nav className="app-toolbar__actions">
            {actions.map((action) => (
              <Button
                key={action.label}
                variant="subtle"
                className="app-toolbar__action"
                leftSection={action.icon}
                disabled={action.disabled}
                onClick={action.execute}
              >
                {action.label}
              </Button>
            ))}
          </nav>

          <span className="app-toolbar__spacer" />
          <span className="app-toolbar__user">
            <span className="app-toolbar__avatar" aria-hidden="true">
              {initial}
            </span>
            <span className="app-toolbar__who">
              <span className="app-toolbar__name">{session.username}</span>
              {session.tenantName && (
                <span className="app-toolbar__company">{session.tenantName}</span>
              )}
            </span>
          </span>
        </header>
      )}

      <main className="app-content">
        <Outlet />
      </main>

      {/* Quinn, the assistant: only while signed in, so the conversation ends with the session. */}
      {session.isLoggedIn && <Quinn />}
    </div>
  );
}
