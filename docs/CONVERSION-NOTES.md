# Conversion notes: Angular → React

This document maps the Angular client of [temphire.angular](https://github.com/Breeze/temphire.angular)
onto the React client of this repository, file by file, and records every place where something
changed on purpose. For the concepts behind the changes, see
[REACT-FOR-ANGULAR-DEVELOPERS.md](REACT-FOR-ANGULAR-DEVELOPERS.md).

The conversion started from temphire.angular at commit `c7f5d85`. The Angular client was itself a
conversion of the WPF/DevForce original; its own
[conversion notes](https://github.com/Breeze/temphire.angular/blob/master/docs/CONVERSION-NOTES.md)
map the WPF app onto it, and the comments in this repository's files still name the WPF view models
where they did.

---

## 1. What stayed the same

- **The server.** `server/` is the same server as the Angular version's:
  [temphire.server](https://github.com/Breeze/temphire.server), a git submodule in both
  repositories.  `server.appsettings.json` points it at the React client and keeps it apart from the
  Angular version: the Vite dev server's origin (`http://localhost:5173`) in `AllowedClientOrigins`,
  port 5100 instead of 5000, and the databases `TempHireReact` and `TempHireReactIdentity`.  Its
  user secrets id is the same, so a Claude API key stored for one version works for the other.
- **Breeze.** breeze-client 3, the generated entity classes in `core/model` (copied unchanged,
  regenerated with the same `npm run model`), the master manager with its cached lookups, the unit
  of work and its sandboxes, the repositories, the search projection, and validation from the
  server's model.
- **The behaviour.** The same screens, commands, rules and messages: sign-in through the server
  (OAuth 2.1, code + PKCE), Home, Resource Management with the search grid, the summary card, the
  four tabs and the dialogs, the roles, the unsaved-changes prompt, and Quinn.
- **The look.** `styles.css` and every component's CSS carried over; only the selectors that
  targeted Optimus UI's internals now target Mantine's.

## 2. File-by-file map

Paths are relative to `client/src`. "Copied" means the file has no Angular in it and came across
unchanged apart from a first line naming where it came from.

### Shell, routing and start-up

| Angular | React | Notes |
|---|---|---|
| `main.ts`, `app/app.config.ts` | `main.tsx` | Providers become wrapping components: `MantineProvider`, `AppServicesProvider`, `ModalsProvider`, `Notifications`, `RouterProvider` |
| `index.html` | `../index.html` | `<app-root>` becomes `<div id="root">` |
| `environments/environment.ts` + `environment.development.ts` | `environments/environment.ts` | One file switching on `import.meta.env.DEV`; ports 5100 |
| `app/app.ts` + `app/app.html` | `app/App.tsx` | `App` provides the toolbar and leave-guard contexts; `Shell` renders; the user menu is Mantine's `Menu` where Angular had Optimus UI's `p-menu` popup |
| `app/app.css` | `app/App.css` | `:host` becomes `.app` |
| `app/app.routes.ts` | `app/app.routes.tsx` | Guards become loaders; `loadComponent` becomes `lazy`; `canDeactivate` moves into the page (`useLeaveGuard`) |
| `app/auth-callback/auth-callback.component.ts` | `app/auth-callback/AuthCallback.tsx` + `.css` | Redeems the code once even when StrictMode runs the effect twice |
| `app/home/home.component.ts` | `app/home/Home.tsx` + `Home.css` | |
| - | `app/core/ErrorBoundary.tsx` | New: catches render errors, which Angular's `ErrorHandler` covered |

### Services

| Angular | React | Notes |
|---|---|---|
| `core/services/auth.service.ts` | `core/services/auth.service.ts` | Same logic; signals become an `AuthState` snapshot read with `useAuth()`; `HttpClient` becomes `fetch` |
| `core/services/auth.interceptor.ts` | `core/services/api-fetch.ts` | A `fetch` wrapper shared with Breeze; also sends no cookies |
| `core/services/auth.guard.ts` | `core/services/auth.guard.ts` | Route loaders |
| `core/services/entity-manager-provider.ts` | `core/services/entity-manager-provider.ts` | `@Injectable` and `HttpClient` removed |
| `core/services/unit-of-work.ts` | `core/services/unit-of-work.ts` | The `changes` signal becomes a version number and `subscribe` (`ChangeNotifier`) |
| `core/services/unit-of-work-manager.ts` | `core/services/unit-of-work-manager.ts` | `UnitOfWorkManager<T>` and `UnitOfWorkManagers`, as in Angular; the app-wide `saves` signal becomes a counter on `UnitOfWorkManagers`, read with `useSaveCount` |
| `core/services/resource-mgt-unit-of-work-manager.ts` | `core/services/resource-mgt-unit-of-work-manager.ts` | Same; created in `app-services.tsx` and passed the registry |
| `core/services/resource-mgt-unit-of-work.ts` | same | Copied |
| `core/services/repository.ts` | same | Copied |
| `core/services/pkce.ts`, `roles.ts` | same | Copied |
| `core/services/breeze-fetch.ts` | same | Copied; the note on removing it points at `main.tsx` |
| `core/services/error-handler.service.ts` | `core/services/error-handler.ts` | Functions, not a service: `showError`, `describe`, `isHarmless`; toasts through Mantine |
| `core/services/dialog.service.ts` | `core/services/dialog.service.tsx` | Promise-returning functions over Mantine's modals; content is JSX rather than a component type plus data |
| `core/dialogs/message-box.component.ts` | `core/dialogs/MessageBox.tsx` | |
| `core/services/toolbar.service.ts` | `core/services/toolbar.tsx` | A context and `useToolbarGroup`; `canExecute` thunks become `disabled` flags |
| `core/services/busy.service.ts` | `core/hooks/use-busy.ts` | A hook with `useState` |
| - | `core/services/change-notifier.ts` | New: the base of services the UI subscribes to |
| - | `core/services/app-services.tsx` | New: creates the services and puts them in context - the injector's job |
| - | `core/services/leave-guard.tsx` | New: `useBlocker` and the shell's Logout question - `pendingChangesGuard`'s job |
| - | `core/hooks/use-unit-of-work.ts` | New: re-renders a component when its unit of work's entities change |

### Model and validation

| Angular | React | Notes |
|---|---|---|
| `core/model/*` | `core/model/*` | Generated by `breeze-gen-entities`; copied |
| `core/model-registration.ts`, `model-display-names.ts` | same | Copied (one comment updated) |
| `core/projections/staffing-resource-list-item.ts` | same | Copied |
| `ngForm [validationModel]` + `core/validation/field-errors.directive.ts` | `ValidationForm` + `core/validation/EntityFields.tsx` | The library's React form, and inputs bound to an entity property that show its errors (`useFieldValidation`) |
| `core/validation/client-validation-metadata.ts` | same | Copied |
| `validateWithMetadata` in the name editor | `validateModelSync` in Mantine's `useForm` | Same `ResourceName` metadata |
| `core/theme/temphire-preset.ts` | `core/theme/temphire-theme.ts` | Mantine `createTheme`, same blue scale |
| `styles.css` | `styles.css` | Dialog rules target Mantine's modal; the Signal Forms rule is gone |

### Resource Management

| Angular | React |
|---|---|
| `resource-mgt/resource-mgt.component.ts` + `.html` + `.css` | `resource-mgt/ResourceMgt.tsx` + `.css` |
| `resource-mgt/resource-search.component.ts` | `resource-mgt/ResourceSearch.tsx` + `.css` |
| `resource-mgt/resource-detail.component.ts` | `resource-mgt/ResourceDetail.tsx` + `.css` |
| `resource-mgt/resource-summary.component.ts` | `resource-mgt/ResourceSummary.tsx` + `.css` |
| `resource-mgt/resource-name-editor.component.ts` | `resource-mgt/ResourceNameEditor.tsx` |
| `resource-mgt/item-selector.component.ts` | `resource-mgt/ItemSelector.tsx` |
| `resource-mgt/resource-link.ts` | same (copied; one comment updated) |
| `resource-mgt/sections/resource-contact-info.component.ts` | `resource-mgt/sections/ResourceContactInfo.tsx` + `.css` |
| `resource-mgt/sections/resource-address-list.component.ts` | `resource-mgt/sections/ResourceAddressList.tsx` + `.css` |
| `resource-mgt/sections/resource-phone-list.component.ts` | `resource-mgt/sections/ResourcePhoneList.tsx` + `.css` |
| `resource-mgt/sections/resource-rates.component.ts` | `resource-mgt/sections/ResourceRates.tsx` + `.css` |
| `resource-mgt/sections/resource-work-experience.component.ts` | `resource-mgt/sections/ResourceWorkExperience.tsx` + `.css` |
| `resource-mgt/sections/resource-skills.component.ts` | `resource-mgt/sections/ResourceSkills.tsx` + `.css` |

### Quinn

| Angular | React | Notes |
|---|---|---|
| `quinn/quinn.component.ts` + `.css` | `quinn/Quinn.tsx` + `Quinn.css` | |
| `quinn/quinn.service.ts` | `quinn/quinn.service.ts` (`QuinnConversation`) | Created by the pane with `useState`; streams with `response.body.getReader()` |
| `quinn/quinn-logo.component.ts` | `quinn/QuinnLogo.tsx` | |
| `quinn/markdown.pipe.ts` + `link-people.pipe.ts` | `quinn/markdown.ts` (`renderAnswer`) | One function; now sanitizes with DOMPurify |
| `quinn/link-people.ts` | same | Copied |

The budget block in the pane: the Angular service derived it with `computed` signals and a clock
signal; `QuinnConversation` works it out in `set` into its snapshot (`quotaBlock`, `quotaMessage`),
and the pane's effect calls `tick()` every 30 seconds.

### Usage

| Angular | React | Notes |
|---|---|---|
| `usage/usage.component.ts` | `usage/Usage.tsx` + `Usage.css` | `httpResource` becomes state plus a fetch in an effect, with a reload counter; Mantine's `Progress` and `Badge` replace Optimus UI's |
| `usage/usage.model.ts` | same | Copied |

### Tests

| Angular | React |
|---|---|
| `app.spec.ts` | `app/App.spec.tsx` |
| `core/services/auth.interceptor.spec.ts` | `core/services/api-fetch.spec.ts` |
| `core/services/auth.guard.spec.ts` | `core/services/auth.guard.spec.ts` |
| `core/services/error-handler.service.spec.ts` | `core/services/error-handler.spec.ts` |
| `core/services/breeze-fetch.spec.ts` | same (the `HttpClient` case now goes through `apiFetch`) |
| `core/validation/entity-fields.spec.ts` | `core/validation/EntityFields.spec.tsx` |
| `core/validation/server-rules.spec.ts` | same (copied) |
| `core/model-display-names.spec.ts` | same (copied) |
| `quinn/link-people.spec.ts` | same (copied) |
| `quinn/quinn.service.spec.ts` | `quinn/quinn.service.spec.ts` (plus the budget block) |
| `usage/usage.component.spec.ts` | `usage/Usage.spec.tsx` |
| `usage/usage.model.spec.ts` | same (copied) |
| `resource-mgt/sections/resource-address-list.component.spec.ts` | `resource-mgt/sections/ResourceAddressList.spec.tsx` |
| - | `test-setup.ts`, `test-utils.tsx` |

## 3. Choices made in the conversion

- **Mantine instead of PrimeReact.** The Angular client uses Optimus UI, the MIT fork of PrimeNG,
  because PrimeNG 22 went commercial. PrimeReact took the same path: version 11 is part of the
  commercial "PrimeUI" family, free only for small organizations. Mantine is MIT-licensed, actively
  maintained, and covers everything TempHire needs - table, tabs, modals, notifications, select,
  number and date inputs, and a form library.
- **React Router's data router.** Its loaders do what Angular's guards did, before the page
  renders, and `lazy` routes split the code as `loadComponent` did.
- **No state management library.** The few services that hold state use React's own
  `useSyncExternalStore` through a ten-line base class (`ChangeNotifier`). Zustand or Redux would
  be reasonable for a larger app; here they would add a dependency without removing any code.
- **Vite** builds and serves the app, as the Angular CLI did (it uses Vite internally, too).
- **No direct access to the `EntityManager`**, as in the Angular client: components and hooks work
  with data only through the unit of work (its repositories, factories, services, `commit()` and
  `rollback()`) and the validation entity store.  The `entityManager` getter both clients
  inherited from the conversion was never used and is gone.  See "Never reach for the
  `EntityManager`" in the Angular client's
  [conversion notes](https://github.com/Breeze/temphire.angular/blob/master/docs/CONVERSION-NOTES.md).

## 4. Behaviour that changed on purpose

Nothing a user would notice; these are the places where the code had to do something new.

- **Cookies are left off cross-origin requests.** Breeze's `fetch` asks for
  `credentials: 'include'`, which the server's CORS policy refuses for the dev server; the app
  authenticates with a bearer token, so `apiFetch` sends `same-origin`.
- **Quinn's HTML is sanitized with DOMPurify.** Angular did this implicitly for `[innerHTML]`;
  React's `dangerouslySetInnerHTML` does not.
- **Dialogs sit above the toolbar.** Mantine's default modal layer is below the sticky toolbar, so
  dialogs open at a z-index above it and Quinn's pane, as Optimus UI's did.
- **Logout asks the screen directly.** Angular's Logout navigated to Home and checked whether the
  navigation was blocked; React Router does not report that, so the shell asks the active screen
  first (`useConfirmLeave`).
- **The item selector takes a label function** instead of a property name, so the compiler checks
  it.
- **The sign-in callback redeems the code once** even though StrictMode runs the effect twice in
  development.
