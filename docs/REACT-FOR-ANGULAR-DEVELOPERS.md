# React for Angular developers

This guide is for developers who know Angular and are considering React. It walks through the
concepts side by side, using TempHire's own code: the same application exists as
[temphire.angular](https://github.com/Breeze/temphire.angular) and as this repository, screen for
screen, so every example below has a counterpart you can open in the other repo.
[CONVERSION-NOTES.md](CONVERSION-NOTES.md) maps the files one to one.

It assumes current Angular - standalone components, signals, the new control flow - and covers
React 19 with TypeScript.

**Contents**

1. [The big difference: a framework and a library](#1-the-big-difference-a-framework-and-a-library)
2. [Components are functions](#2-components-are-functions)
3. [JSX instead of templates](#3-jsx-instead-of-templates)
4. [Props: inputs and outputs in one](#4-props-inputs-and-outputs-in-one)
5. [State, and rendering instead of change detection](#5-state-and-rendering-instead-of-change-detection)
6. [Hooks, and their rules](#6-hooks-and-their-rules)
7. [Effects instead of lifecycle hooks](#7-effects-instead-of-lifecycle-hooks)
8. [Refs instead of viewChild](#8-refs-instead-of-viewchild)
9. [Context instead of dependency injection](#9-context-instead-of-dependency-injection)
10. [Services that hold state: external stores](#10-services-that-hold-state-external-stores)
11. [Routing](#11-routing)
12. [Forms](#12-forms)
13. [HTTP](#13-http)
14. [Breeze entities and React's immutability](#14-breeze-entities-and-reacts-immutability)
15. [Styling](#15-styling)
16. [Security: HTML is not sanitized for you](#16-security-html-is-not-sanitized-for-you)
17. [Testing](#17-testing)
18. [Tooling](#18-tooling)
19. [Which one?](#19-which-one)
20. [Quick reference](#20-quick-reference)

---

## 1. The big difference: a framework and a library

Angular is a **framework**: it comes with a component model, templates, dependency injection, a
router, forms, an HTTP client, change detection, a test bed and a CLI that builds it all. There is
one Angular way to do most things.

React is a **library for rendering UI from state**. It gives you components, state, effects and
context, and leaves the rest to other libraries that you choose. For TempHire that meant choosing:

| Need | Angular (temphire.angular) | React (this repo) |
|---|---|---|
| Build and dev server | Angular CLI | [Vite](https://vite.dev) |
| Routing | `@angular/router` | [React Router](https://reactrouter.com) 8 |
| Components | Optimus UI (PrimeNG fork) | [Mantine](https://mantine.dev) 9 |
| Forms | Signal Forms | Mantine's `useForm`, and plain controlled inputs |
| HTTP | `HttpClient` + interceptors | `fetch` + a small wrapper, `apiFetch` |
| Tests | Vitest via the Angular CLI | Vitest + React Testing Library |
| Data | Breeze | Breeze - unchanged |

None of the choices is unusual; together they are close to the mainstream React stack today. But
the choices are yours to make, keep current and keep consistent - more freedom, and more decisions.

---

## 2. Components are functions

An Angular component is a class with a decorator, a template and styles. A React component is a
**function that takes props and returns JSX**. Here is the message box both versions use for
"Save your changes?":

```ts
// Angular: core/dialogs/message-box.component.ts
@Component({
  selector: 'app-message-box',
  imports: [ButtonDirective],
  template: `
    <p class="message-box__text">{{ data.message }}</p>
    <div class="message-box__buttons">
      @for (button of data.buttons; track button.value) {
        <button pButton type="button" (click)="close(button.value)">{{ button.label }}</button>
      }
    </div>
  `,
})
export class MessageBoxComponent {
  private readonly ref = inject(DynamicDialogRef);
  readonly data: MessageBoxData = inject(DynamicDialogConfig).data;
  close(value: string): void { this.ref.close(value); }
}
```

```tsx
// React: core/dialogs/MessageBox.tsx
export function MessageBox({ message, buttons, onChoose }: MessageBoxProps) {
  return (
    <>
      <Text mb="lg">{message}</Text>
      <Group justify="flex-end" gap="xs">
        {buttons.map((button) => (
          <Button key={button.value} onClick={() => onChoose(button.value)}>
            {button.label}
          </Button>
        ))}
      </Group>
    </>
  );
}
```

Things to notice:

- **No selector, no `imports` array.** A component is used by importing the function and writing
  `<MessageBox ... />`. Its name starts with a capital letter; that is how JSX tells components
  from HTML elements.
- **No injection.** The Angular box injected `DynamicDialogRef` to close itself and
  `DynamicDialogConfig` for its data. The React box is simply *given* what it needs as props:
  the message, the buttons and a callback, `onChoose`.
- **The function runs on every render.** There is no instance that lives across renders, so no
  fields. What would have been a field is either a prop, state (section 5), or a ref (section 8).

React still has class components, but new code doesn't use them. TempHire has one, the
`ErrorBoundary` in `core/ErrorBoundary.tsx`, because catching render errors still needs a class.

---

## 3. JSX instead of templates

JSX is markup written inside TypeScript. It compiles to function calls, so it is type-checked like
the rest of the code, and anything in `{ }` is a JavaScript expression.

| Angular template | JSX |
|---|---|
| `{{ resource.fullName }}` | `{resource.fullName}` |
| `@if (address) { ... }` | `{address && ...}` or `{address ? ... : ...}` |
| `@for (item of items; track item.id) { ... }` | `{items.map((item) => <Row key={item.id} ... />)}` |
| `[disabled]="readOnly()"` | `disabled={readOnly}` |
| `(click)="save()"` | `onClick={() => save()}` |
| `class="summary"`, `[class.editable]="!readOnly()"` | ``className={`summary${readOnly ? '' : ' editable'}`}`` |
| `<ng-container>` | `<>...</>` (a *fragment*) |
| `{{ rate.amount \| currency: 'USD' }}` | `{usd.format(rate.amount)}` - no pipes; call a function |
| `[(ngModel)]="address.city"` | no two-way binding; see section 12 |

From the shell (`App.tsx`), showing the toolbar only while signed in:

```tsx
{session.isLoggedIn && (
  <header className="app-toolbar">
    ...
    {actions.map((action) => (
      <Button key={action.label} disabled={action.disabled} onClick={action.execute}>
        {action.label}
      </Button>
    ))}
  </header>
)}
```

`key` is React's `track`: it tells React which element is which when a list changes, so it can
move an element rather than rebuild it. In the Skills tab, a skill re-sorts as you type its name;
because each row has `key={skill.id}`, the input moves with its row and keeps the cursor.

---

## 4. Props: inputs and outputs in one

Angular separates `input()` (data in) from `output()` (events out). React has one mechanism,
**props**: data goes down as props, and events go up through **callback props**.

```ts
// Angular: resource-search.component.ts
readonly selectedId = input<string | null>(null);
readonly selectionChange = output<StaffingResourceListItem | null>();
...
this.selectionChange.emit(item);
```

```tsx
// React: ResourceSearch.tsx
interface ResourceSearchProps {
  selectedId: string | null;
  onSelectionChange: (item: StaffingResourceListItem | null) => void;
}
...
onSelectionChange(item);
```

And the parent (`ResourceMgt.tsx`):

```tsx
<ResourceSearch selectedId={selectedId} onSelectionChange={(item) => void onSelectionChange(item)} />
```

Props are read-only to the component that receives them. A component never changes its props; it
asks its parent to, through a callback. (Breeze entities passed as props are an exception TempHire
makes deliberately - see section 14.)

`children` is a prop too: whatever is written between a component's tags. It is how the providers
in `main.tsx` wrap the app - the counterpart of content projection with `<ng-content />`.

---

## 5. State, and rendering instead of change detection

This is the heart of the difference.

**Angular** keeps state in signals and works out what to update: a template reads a signal, and
when the signal changes, that part of the view updates. `computed` caches a derived value.

**React** keeps state with `useState`. Calling the setter **re-renders the component**: React calls
the function again, gets new JSX, compares it with the last, and updates the DOM where they differ.
Its children re-render too. There is nothing like `computed`, because nothing needs caching - a
derived value is just a `const`, worked out again on every render:

```ts
// Angular: resource-mgt.component.ts
readonly editMode = signal<EditMode>('view');
readonly isReadOnly = computed(() => this.editMode() === 'view');
readonly canEdit = computed(() => this.mayEdit() && this.hasResource() && this.isReadOnly());
```

```tsx
// React: ResourceMgt.tsx
const [editMode, setEditMode] = useState<EditMode>('view');
const isReadOnly = editMode === 'view';
const canEdit = mayEdit && hasResource && isReadOnly;
```

Some consequences worth knowing:

- **State is replaced, not mutated.** React decides whether something changed by *identity*. To
  change state you give it a new value - `setRows(results)`, or `setOpened(current => new
  Set(current).add(tab))` - never `rows.push(...)`. An object changed in place looks unchanged.
- **Updates are batched.** `attach()` in `ResourceMgt` calls three setters; React renders once.
- **A setter does not change the variable you already have.** After `setEditMode('edit')`, the
  `editMode` constant in the running function is still `'view'`; the new value arrives with the
  next render. When the next state depends on the previous one, use the updater form:
  `setCount(c => c + 1)` (see `useBusy`).
- **`useMemo` caches** when you need it: an expensive calculation, or - as with the toolbar group in
  `ResourceMgt` - an object whose *identity* should stay the same until its inputs change.

Angular's signals are *fine-grained*: only what read a signal updates. React is *coarse-grained*:
a component and its children re-render. That sounds expensive, but rendering is cheap (it is
JavaScript producing objects; the DOM is only touched where it differs), and it is why React code
can be plain functions and plain values.

---

## 6. Hooks, and their rules

Every function whose name starts with `use` is a **hook**: `useState`, `useEffect`, `useContext`,
`useRef`, `useMemo`, and any function of your own that calls them - a **custom hook**. Hooks are how
a function component gets state and side effects; they are React's answer to everything Angular
does with class fields, `inject()` and lifecycle methods.

Custom hooks are the main way to share logic. TempHire's:

| Hook | What it does | Angular counterpart |
|---|---|---|
| `useServices()` | the app's services | `inject(...)` |
| `useAuth()` | the session, kept current | reading `AuthService` signals |
| `useUnitOfWork(uow)` | re-render when an entity changes | reading `unitOfWork.changes()` in a `computed` |
| `useBusy()` | a busy counter for one component | a component-provided `BusyService` |
| `useBreezeField(entity, prop)` | a property's Breeze errors | the `breezeField` directive |
| `useToolbarGroup(group)` | show commands in the shell's toolbar | `registerToolbarGroup` |
| `useLeaveGuard(ask, canLeave)` | ask before leaving with unsaved edits | `canDeactivate` |

**The rules of hooks.** React identifies each hook call by its *position* in the sequence of calls
during a render - not by name. So:

1. Call hooks only at the top level of a component or another hook - never inside `if`, a loop, or
   a callback.
2. Call them in the same order on every render.

That is why `useUnitOfWork` accepts `null` rather than being called conditionally:

```tsx
useUnitOfWork(unitOfWork);   // unitOfWork may be null; the hook copes
```

The `react-hooks` ESLint plugin enforces the rules (`npm run lint`). Run it; breaking the rules
produces bugs that are hard to trace.

---

## 7. Effects instead of lifecycle hooks

React components have no `ngOnInit`, `ngOnDestroy` or `afterRender`. Work that should happen
*because the component is on screen* - subscribing to something, starting a request, focusing an
element - goes in an **effect**:

```tsx
useEffect(() => {
  // runs after the render that caused it
  return () => {
    // the clean-up: runs before the effect runs again, and when the component unmounts
  };
}, [dependencies]);
```

The dependency array decides when it runs: after the first render, and again whenever a listed
value changed since the previous render. `[]` means "once, after the first render" - the closest
thing to `ngOnInit`, with the clean-up as `ngOnDestroy`.

From Quinn's pane - Escape closes it, the counterpart of Angular's `host` listener:

```tsx
useEffect(() => {
  const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') conversation.close(); };
  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}, [conversation]);
```

Four things that trip up Angular developers:

- **StrictMode runs every effect twice in development** - set up, clean up, set up - to flush out
  effects that are not safe to repeat. TempHire's sign-in callback had to allow for it: redeeming
  an OAuth code twice fails, so `AuthCallback.tsx` shares one promise per code (`completeOnce`).
  Write effects so that running them twice is harmless.
- **A late response can arrive after the component has moved on.** The clean-up function is the
  place to say "ignore it": `ResourceSearch` sets `current = false` when a newer search starts.
- **Effects see the values of their render.** An effect that should read the *latest* state
  without re-running when it changes uses **`useEffectEvent`** - see `selectIfMissing` in
  `ResourceSearch` and `openFromLink` in `ResourceMgt`.
- **You might not need an effect.** Effects are for synchronising with things *outside* React.
  Deriving state from other state does not need one; compute it during render. `ResourceSearch`
  first set a `loading` flag in its effect; the lint rule flagged it, and the fix was to *derive*
  `loading` (the last result answered an older search) instead of keeping it as state.

Angular's `effect()` and `afterRenderEffect()` are close relatives, but Angular tracks their
dependencies automatically; in React you list them, and the linter checks the list.

---

## 8. Refs instead of viewChild

`useRef` gives a mutable box, `ref.current`, that survives re-renders and does not cause one when
changed. It has two uses:

**A DOM element** - the counterpart of `viewChild('questionBox')`:

```tsx
const questionBox = useRef<HTMLTextAreaElement>(null);
...
<Textarea ref={questionBox} ... />
...
questionBox.current?.focus();
```

**Something a child exposes** - the counterpart of `viewChild(ResourceSearchComponent)` and calling
its method. The child decides what the parent sees with `useImperativeHandle`:

```tsx
// ResourceSearch.tsx
useImperativeHandle(ref, () => ({ searchFor(text: string) { ... } }));

// ResourceMgt.tsx
const search = useRef<ResourceSearchHandle>(null);
<ResourceSearch ref={search} ... />
search.current?.searchFor(resource.lastName);
```

Refs also hold values that must outlive renders but must not trigger them - the latest commands
the toolbar's buttons call (`commands` in `ResourceMgt`), or "was Quinn busy last time?" in
`Quinn.tsx`.

---

## 9. Context instead of dependency injection

React has no injector. Its counterpart is **context**: a value placed in a `<SomeContext value=...>`
element is available to every component below it, which reads it with `useContext(SomeContext)`.

TempHire creates its long-lived services once and puts them in context:

```tsx
// app-services.tsx
export function createAppServices(): AppServices {
  const emProvider = new EntityManagerProvider();
  const unitOfWorkManager = new UnitOfWorkManager(emProvider);
  const auth = new AuthService(emProvider, unitOfWorkManager);
  setTokenSource(auth);
  return { emProvider, unitOfWorkManager, auth };
}

export function useServices(): AppServices { return useContext(AppServicesContext)!; }
```

```tsx
// main.tsx
<AppServicesProvider services={createAppServices()}> ... </AppServicesProvider>

// any component
const { unitOfWorkManager } = useServices();
```

How the Angular patterns map:

| Angular | React in TempHire |
|---|---|
| `@Injectable({ providedIn: 'root' })` | a class, created once in `createAppServices`, in context |
| `providers: [BusyService]` on a component | a custom hook with `useState` - `useBusy()` |
| `providers: [QuinnService]` on a component | `useState(() => new QuinnConversation(...))` in that component |
| `inject(X)` | `useServices().x`, or a specific hook |
| `TestBed` providers with stand-ins | render the component inside a provider with stand-ins |
| a stateless injectable (`AppDialogService`) | plain exported functions (`openDialog`, `confirm`) |

Context is not free: when a context's value changes, every component that reads it re-renders. So
put stable things in context (the services object never changes), and let components subscribe to
the state they show (next section). `toolbar.tsx` splits its context in two for this reason: the
groups change often, the setter never does, and screens only read the setter.

---

## 10. Services that hold state: external stores

Angular services expose signals, and templates react to them. In React, a component re-renders
when *its* state changes - so a service's state needs a bridge. The standard one is
`useSyncExternalStore(subscribe, getSnapshot)`: a component subscribes to anything with those two
functions, and re-renders when the snapshot changes.

TempHire's stateful services extend a tiny base class:

```ts
// change-notifier.ts
export class ChangeNotifier {
  readonly subscribe = (listener: () => void) => { ...; return unsubscribe; };
  protected notify(): void { for (const listener of this.listeners) listener(); }
}
```

`AuthService` keeps an immutable `AuthState` snapshot, replaces it when the session changes, and
calls `notify()`; components read it with

```ts
export function useAuth(): AuthState {
  const { auth } = useServices();
  return useSyncExternalStore(auth.subscribe, auth.getState);
}
```

The snapshot must be the *same object* until something changes - React compares by identity, and a
new object on every call would re-render forever. Libraries such as Zustand and Redux package this
pattern; for a handful of services, the ten-line base class is enough.

---

## 11. Routing

React Router's data router is close to Angular's router in shape. From `app.routes.tsx`:

```tsx
{
  path: 'resourcemgt',
  loader: roleLoader(services, Roles.Editor, Roles.Reader),          // canActivate
  lazy: () => import('./resource-mgt/ResourceMgt').then((m) => ({ Component: m.ResourceMgt })),
}
```

| Angular | React Router |
|---|---|
| `provideRouter(routes)` | `createBrowserRouter(routes)` + `<RouterProvider router={...} />` |
| `<router-outlet />` | `<Outlet />` |
| `loadComponent: () => import(...)` | `lazy: () => import(...)` |
| `canActivate: [authGuard]` | `loader` - runs before the route renders; returns `redirect(...)` to send the user elsewhere |
| `canDeactivate: [pendingChangesGuard]` | `useBlocker` inside the component (see `leave-guard.tsx`) |
| `inject(Router).navigate([...])` | `const navigate = useNavigate(); navigate('/home')` |
| `routerLink="/resourcemgt"` | `<Link to="/resourcemgt">` |
| query params bound to inputs (`withComponentInputBinding`) | `useSearchParams()` |
| `@defer` | `lazy()` + `<Suspense>` - see `ResourceDetail.tsx` |

Two differences that mattered here:

- A loader, like a guard, runs outside any component and cannot use hooks. The loaders get the
  services as an argument instead: `createRoutes(services)`.
- Leaving a page is blocked from *inside* the page, and a navigation does not report whether it was
  blocked. The shell's Logout therefore asks the active screen directly (`useConfirmLeave`), where
  Angular's Logout tried to navigate and checked the result.

---

## 12. Forms

React has no forms module. An input is **controlled**: it shows the `value` it is given and reports
each keystroke through `onChange`; the component decides what to do with it.

```tsx
const [text, setText] = useState('');
<TextInput value={text} onChange={(event) => setText(event.currentTarget.value)} />
```

That is all two-way binding is in React - explicit, one handler per input. For real forms, a
library keeps the values, the validation and the touched state; TempHire's name editor uses
Mantine's `useForm`, with the validators Breeze built from the server's model:

```tsx
// ResourceNameEditor.tsx - Angular: a Signal Form with validateWithBreeze
const form = useForm<ResourceName>({
  initialValues: { firstName: '', middleName: '', lastName: '', ...name },
  validate: {
    firstName: breezeValidate(type.getDataProperty('firstName')),
    lastName: breezeValidate(type.getDataProperty('lastName')),
    ...
  },
  validateInputOnBlur: true,
});
...
<TextInput label="First name" {...form.getInputProps('firstName')} />
```

Entity fields are bound to Breeze entities instead, through the `Entity*` components in
`EntityFields.tsx`:

```tsx
<EntityTextInput entity={address} property="city" readOnly={readOnly} />
```

`value` reads `address.city`; `onChange` writes it; Breeze validates and raises events; the section
re-renders (section 14) and the field shows the new value and any error. Where Angular needed
`[(ngModel)]` plus a directive on every input, React needs a small component.

---

## 13. HTTP

React has no HTTP client and no interceptors. The browser's `fetch` does the requests, and a
wrapper adds what the interceptor did: `apiFetch` in `core/services/api-fetch.ts` attaches the
access token (renewing it first if it is about to expire) and signs the user in again on a 401.
Breeze is given the same function, `configureBreeze({ fetch: emptyBodyAsNull(apiFetch) })`, so every
request goes through one place - the same outcome as Angular's `httpClientFetch`.

Two things that came up in the conversion:

- **Cookies.** Breeze's own `fetch` asks for `credentials: 'include'`. The server's CORS policy
  (rightly) refuses cookies from the dev server on another port, and TempHire authenticates with a
  bearer token anyway, so `apiFetch` sends `credentials: 'same-origin'`. Angular's `HttpClient`
  never sent credentials cross-origin, which is why the Angular version never met this.
- **Streaming.** Quinn's answer streams in as newline-delimited JSON. Angular read it from
  `HttpClient`'s download progress events; with `fetch`, the body is a stream:
  `response.body.getReader()` plus a `TextDecoder` (see `QuinnConversation.ask`).

---

## 14. Breeze entities and React's immutability

This is the one place where React's model and Breeze's genuinely pull in different directions, and
the part of the conversion most worth understanding.

**React assumes immutable data.** It re-renders when state is *replaced*, it compares by identity,
and its newest lint rules - written for the React Compiler - flag code that changes a prop.

**Breeze entities are mutable on purpose.** `address.city = 'Seattle'` changes the entity in place;
Breeze tracks the change, validates it, raises `entityChanged`, and can reject it later. The whole
unit-of-work model - sandboxes, `rejectChanges()`, one change set per save - depends on it. Copying
entities to make them immutable would throw that away.

TempHire keeps Breeze's model and tells React about the changes:

1. **The unit of work is an external store.** It listens to its manager's `entityChanged`,
   `hasChangesChanged` and `validationErrorsChanged` events, bumps a version number, and notifies
   subscribers (`unit-of-work.ts`).
2. **Components that show entities subscribe to it** with `useUnitOfWork(unitOfWork)`. Every
   section of the detail screen does; so does `ResourceMgt`, whose `canSave` depends on
   `hasChanges()` and `hasValidationErrors()`.
3. **Inputs write straight to the entity** (`EntityFields.tsx`), and the change comes back round
   through the store. The entity stays the single source of truth, as it was with `ngModel`.
4. **Fields subscribe to their own validation** with `useBreezeField`, so an error Breeze finds
   during a save highlights the field even though nothing on screen changed it.

```tsx
export function ResourceAddressList({ staffingResource, readOnly, unitOfWork }: SectionProps) {
  useUnitOfWork(unitOfWork);                    // re-render whenever an entity changes
  const addresses = [...staffingResource.addresses];   // read fresh on every render
  ...
}
```

The Angular version did exactly the same thing with a counter *signal* (`unitOfWork.changes()`)
read inside `computed`s; the two are one idea. There is a regression test for it,
`ResourceAddressList.spec.tsx`: an address added after a dialog closes must appear at once. Remove
the `useUnitOfWork` call and the test fails.

Where a component assigns to an entity property directly, the `react-hooks/immutability` rule
objects; the one such place, the name editor's result in `ResourceSummary`, disables the rule for
those lines with a comment saying why. (The `Entity*` inputs write through a small helper, which the
rule does not look into.) TempHire does not use the
[React Compiler](https://react.dev/learn/react-compiler), the optimizing compiler these rules were
written for; it assumes props are not mutated, so an app that wanted it would need to check how it
treats components that read mutable Breeze entities before turning it on.

---

## 15. Styling

Angular scoped a component's `styles` to the component and needed `:host ::ng-deep` to reach into
child components or HTML inserted with `[innerHTML]`. Plain CSS files imported by React components
are **global**. TempHire's styles carried over almost line for line; the BEM-style class names it
already used (`summary__name`, `quinn-pane__header`) keep the rules from clashing, and every
`::ng-deep` simply disappeared. (CSS Modules, or Mantine's own styles API, give you scoping back if
you want it.)

The component library's look is set by its theme: Mantine's `createTheme` in
`core/theme/temphire-theme.ts` makes TempHire's blue the primary colour, where Angular used an
Optimus UI preset.

---

## 16. Security: HTML is not sanitized for you

Angular sanitizes HTML bound with `[innerHTML]`: scripts, event handlers and `javascript:` links are
removed. React's only way to insert HTML is `dangerouslySetInnerHTML`, and it inserts **exactly**
what it is given. Quinn's answers are Markdown from a language model, and through it from data
anyone in the company can edit, so `quinn/markdown.ts` renders the Markdown and runs the result
through [DOMPurify](https://github.com/cure53/DOMPurify) before it reaches the page. Any React app
that renders HTML from outside needs the same step.

(Ordinary text in JSX - `{message.content}` - is always escaped. This is only about inserting HTML.)

---

## 17. Testing

| Angular | React |
|---|---|
| `TestBed.configureTestingModule({ providers })` | render inside the providers the component reads (`renderWithMantine`, `AppServicesProvider`) |
| `TestBed.createComponent(X)` | `render(<X ... />)` from Testing Library |
| `fixture.componentRef.setInput(...)` | pass props |
| `fixture.whenStable()` | `await screen.findBy...`, `waitFor(...)`, `act(...)` |
| `HttpTestingController` | `vi.stubGlobal('fetch', ...)` |
| `{ provide: AppDialogService, useValue: ... }` | `vi.mock('.../dialog.service', ...)` |
| `debugElement.query(By.css(...))` | `screen.getByRole(...)`, `getByLabelText(...)` |

Testing Library encourages finding elements the way a user would - by role and label - rather than
by CSS class. Framework-free code (`link-people.ts`, `model-display-names.ts`) kept its specs
unchanged, and the services' specs changed little; most of the porting was in component tests.

---

## 18. Tooling

- **Vite** serves the app in development with near-instant start-up and hot module replacement, and
  builds it for production. There is no separate compiler; the React plugin only transforms JSX.
- **TypeScript** checks the code (`npm run typecheck`); Vite itself only strips the types.
- **ESLint** with `eslint-plugin-react-hooks` checks the rules of hooks and effect dependencies. In
  Angular the compiler catches most template mistakes; in React the linter is part of the safety net.
- **Vitest** runs the tests, as in the Angular version.

---

## 19. Which one?

Both are good choices for an application like TempHire; the conversion went screen for screen
without changing the design. What differs is where the decisions are made.

**Angular** suits teams that want one way of doing things, with batteries included and kept
consistent across releases: DI, forms, router, HTTP and test infrastructure that fit together, and
signals that update precisely what changed. It is a natural home for the class-based, service-heavy
style that comes from WPF or enterprise .NET - TempHire's port from WPF to Angular was mostly a
translation.

**React** suits teams that want a smaller core and the freedom to choose the rest, and the largest
ecosystem of libraries, components and developers. The core concepts are few - components, props,
state, effects, context - and they compose well. The price is that more is up to you: which
router, which forms library, which component library, how to structure state, and keeping those
choices current.

A few things specific to this conversion:

- **Breeze works with both.** It is framework-agnostic; the unit-of-work-as-external-store bridge in
  section 14 is the only React-specific glue it needed.
- **Component library licensing matters in both.** PrimeNG 22 and PrimeReact 11 both moved to
  commercial licences; the Angular version switched to Optimus UI (an MIT fork of PrimeNG 21), and
  this one uses Mantine (MIT).
- **Converting was mostly mechanical.** Services, the Breeze layer, models, routing rules and
  styles carried over with small changes. The real work was in the places listed in this guide:
  rendering vs signals, effects vs lifecycle, context vs DI, and the immutability question.

---

## 20. Quick reference

| Angular | React |
|---|---|
| `@Component` class | function returning JSX |
| template | JSX |
| `input()` | prop |
| `output()` + `emit` | callback prop |
| `model()` / `[(ngModel)]` | `value` + `onChange` |
| `signal()` | `useState()` |
| `computed()` | a `const` computed during render; `useMemo` to cache |
| `effect()` | `useEffect()` with a dependency array |
| `afterRenderEffect()` | `useEffect()` (`useLayoutEffect()` before paint) |
| `ngOnInit` / `ngOnDestroy` | `useEffect(fn, [])` / its clean-up |
| `viewChild()` | `useRef()` + `ref`; `useImperativeHandle` for a component |
| `inject()` / providers | context + `useContext()`; custom hooks |
| service with signals | external store + `useSyncExternalStore()` |
| pipe | function call |
| directive | custom hook, or a wrapping component |
| `@if` / `@for` / `@switch` | `&&` / `?:` / `.map()` / a function |
| `@defer` | `lazy()` + `<Suspense>` |
| `track` | `key` |
| `<ng-content />` | `children` |
| `<router-outlet />` | `<Outlet />` |
| `canActivate` | route `loader` |
| `canDeactivate` | `useBlocker()` |
| `HttpClient` + interceptor | `fetch` + a wrapper |
| `[innerHTML]` (sanitized) | `dangerouslySetInnerHTML` (not sanitized - use DOMPurify) |
| zone / change detection | re-rendering on state change |
| `TestBed` | Testing Library `render` |
