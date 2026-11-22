# TempHire (React + BreezeJS + .NET)

TempHire is a **reference implementation of a data-driven line-of-business application**: a
staffing company's people, with their addresses, phone numbers, rates, skills and work history,
searched in a grid and edited in a form, with validation, save and cancel - plus an AI assistant,
multi-tenancy, roles and OAuth 2.1 sign-in.

This repository is the **React** version. It is a framework conversion of
[temphire.angular](https://github.com/Breeze/temphire.angular): the same application, screen for
screen, with the Angular client rewritten in React. Both run on the same .NET server,
[temphire.server](https://github.com/Breeze/temphire.server), which is a git submodule in each
repository's `server/` folder (see [The server](#the-server)). It is meant for
anyone weighing a move from Angular to React - to see what changes, what doesn't, and how the
concepts map.

- **[REACT-FOR-ANGULAR-DEVELOPERS.md](docs/REACT-FOR-ANGULAR-DEVELOPERS.md)** - the concepts side
  by side, with examples from both versions of TempHire. Start here if you know Angular.
- **[CONVERSION-NOTES.md](docs/CONVERSION-NOTES.md)** - every Angular file and its React
  counterpart, and what changed on purpose.

Every converted file also names the Angular file it came from, so the two repositories can be read
side by side.

| | Angular version | This version |
|---|---|---|
| UI framework | Angular 22 (standalone, zoneless, signals) | **React 19** with TypeScript |
| Build | Angular CLI | **Vite 8** |
| Routing | Angular Router | **React Router 8** (data router) |
| Components | Optimus UI 2 (MIT fork of PrimeNG) | **Mantine 9** (MIT) |
| Forms | Signal Forms | Mantine `useForm`; entity inputs bound to Breeze |
| Tests | Vitest | **Vitest** + React Testing Library |
| Data | breeze-client 3 | breeze-client 3 - unchanged |
| Server | [temphire.server](https://github.com/Breeze/temphire.server): ASP.NET Core 10, Breeze .NET 8, EF Core 10, OpenIddict | the same server |

---

## Prerequisites

- [.NET SDK](https://dotnet.microsoft.com/download) 10.0 or later
- [Node.js](https://nodejs.org) **26.13.0**, pinned in `.node-version` (`nvs auto` picks it up)
- SQL Server **LocalDB** (Visual Studio's "Data storage and processing" workload, or SQL Server
  Express), or any SQL Server - see the server's
  [prerequisites](https://github.com/Breeze/temphire.server#prerequisites)
- For Quinn: [Ollama](https://ollama.com) with `qwen3:4b-instruct` (the default), or an Anthropic
  API key for Claude - see [Quinn](#quinn)

## Running it

The server is a git submodule, so clone with `--recurse-submodules`:

```
git clone --recurse-submodules https://github.com/Breeze/temphire.react.git
```

In a clone made without it, run `git submodule update --init` once.  After a `git pull` that moves
the submodule to another commit, run `git submodule update` to check that commit out.

TempHire's validation uses a preview of
[IdeaBlade Validation](https://github.com/Breeze/ideablade-validation), which isn't published yet.
Its packages are in `packages/` and `server/packages/`, and `npm install` and `dotnet` take them
from there (see [Validation](#validation)), so there is nothing extra to install.

Then two terminals; the server first, because the client loads its Breeze and validation metadata
from it.

**1. Server** (`http://localhost:5100`)

```
cd server/TempHire.Server
dotnet run
```

On first start it creates and seeds its two databases, `TempHireReact` and `TempHireReactIdentity`:
two companies, two users each, and 25 staffing resources per company.  The port and the database
names are this version's, set in `server.appsettings.json` (see
[Next to the Angular version](#next-to-the-angular-version)).

**2. Client** (`http://localhost:5173`)

```
cd client
npm install
npm start
```

Vite opens the app; it sends you to the server's sign-in page. Sign in as one of the
[sample users](https://github.com/Breeze/temphire.server#sample-users), such as `anna@harbor.test`
(an Editor at Harbor Staffing) or `ben@harbor.test` (a Reader there). The password is
**`password`** for all of them, and in development the sign-in page lists them for one-click
sign-in.

### Next to the Angular version

The two versions can run at the same time. This one uses ports 5100 (server) and 5173 (client),
where the Angular version uses 5000 and 4200, and its own databases, so neither touches the other's
data. The server is the same; `server.appsettings.json`, in this repository's root, gives it this
version's URL, databases and dev-server origin, overriding its `appsettings.json` (see
[In a client repository](https://github.com/Breeze/temphire.server#in-a-client-repository)). The
two share the server's user secrets, so a Claude API key stored for one is used by both.

### Building for production

```
cd client
npm run build:server     # builds into ../server/TempHire.Server/wwwroot
```

The server then serves the app itself at `http://localhost:5100`.

### Tests and checks

```
cd client
npm test                 # Vitest, in watch mode; npx vitest run for a single run
npm run lint             # ESLint, including the React Hooks rules
npm run typecheck        # TypeScript

cd ../server
dotnet test TempHire.Server.Tests   # saves, concurrency and the rules checked on save
```

---

## How the React client is built

The short version, for orientation; [REACT-FOR-ANGULAR-DEVELOPERS.md](docs/REACT-FOR-ANGULAR-DEVELOPERS.md)
explains each point.

- **Services in context.** `createAppServices` (`core/services/app-services.tsx`) creates the
  long-lived services once - the entity manager provider, the unit-of-work manager, the auth
  service - and `AppServicesProvider` puts them in React context, where components get them with
  `useServices()`. That is the app's dependency injection.
- **Breeze entities and rendering.** Breeze entities are mutable; React re-renders on state
  changes. The unit of work bridges the two: it notifies its subscribers whenever an entity in it
  changes, and a component that calls `useUnitOfWork(unitOfWork)` renders again. Inputs bound to an
  entity property (`core/validation/EntityFields.tsx`) write straight to the entity and show its
  validation errors (see [Validation](#validation)).
- **One fetch for everything.** `apiFetch` attaches the access token, renews it before it expires,
  and signs in again on a 401. Breeze is configured to use it too.
- **Routing.** React Router loaders check the session and the roles before a page renders - what
  Angular's guards did - and `useBlocker` asks before leaving Resource Management with unsaved
  edits.
- **Dialogs** are promise-returning functions (`openDialog`, `confirm`, ...) over Mantine's modals,
  which reject with `DialogCancelledError` when cancelled, as in the Angular and WPF versions.

### Entity classes are generated

The classes in `client/src/app/core/model` are generated from the server's model by Breeze's
entity generator, as in the Angular version:

```
cd client
npm run model            # export the metadata from the server, then generate
npm run model:generate   # generate from the checked-in metadata.json only
```

See `client/src/app/core/model/README.md` for which parts of those files you may edit.

---

## Quinn

A round button in the bottom right corner opens a chat pane with **Quinn**, who answers questions
about your company's staffing data in plain language. The people Quinn mentions are links that
open them in Resource Management. Quinn runs in the server, which exposes the data as an MCP server
at `/mcp`; it calls the tools with your own access token, so it sees only your company's data, and
only if your role allows.

The `Agent` section of `server/TempHire.Server/appsettings.json` picks the model: **Ollama**
(default, local) or **Claude**.

- **Ollama:** install it from <https://ollama.com/download>, then `ollama pull qwen3:4b-instruct`.
- **Claude:** run `server/Set-ClaudeApiKey.ps1 -UseClaude` in PowerShell; it prompts for the API
  key and stores it in the server's user secrets, never in `appsettings.json`. `-UseOllama`
  switches back.

**Budgets.**  Answers from a paid model cost money, so the server gives each user and each company a
budget in dollars per day, week and month, for each model: as shipped, $0.50 a day per user and $10
a month per company for Claude (about 38 and 770 questions); Ollama is free and unlimited.

- **The user menu.**  The signed-in user in the top right corner opens a menu with **Usage** and
  **Logout**.
- **The usage page** (`client/src/app/usage/`, route `/usage`) shows, per model, what Quinn's
  answers cost you and your company today, this week and this month, against the budgets, with the
  tokens they took.  Bars turn amber at 80% and red when a budget is used up; an unlimited model
  shows its tokens only.
- **Quinn's pane** reads the same figures when it opens and after every answer.  While a budget is
  used up it says which one and how long until it starts over, counting down, and disables the
  question box until then; the server refuses such a question anyway.  A budget can be overrun
  slightly: the question that crosses it is answered in full.

The server's README describes [how Quinn works](https://github.com/Breeze/temphire.server#how-it-works),
[compares the two models](https://github.com/Breeze/temphire.server#ollama-or-claude), and covers
[setting up Ollama](https://github.com/Breeze/temphire.server#setting-up-ollama),
[setting up Claude](https://github.com/Breeze/temphire.server#setting-up-claude) and
[the budgets](https://github.com/Breeze/temphire.server#budgets-usage-and-quotas) - what they buy,
how usage is counted, and how to change the budgets or the prices - in detail.

## Validation

> **Preview.**  Validation uses a preview of IdeaBlade Validation (`0.1.0-preview.10`), which
> isn't published to NuGet or npm yet: the builds are in `packages/` and `server/packages/`, where
> `client/package.json` and the server's `nuget.config` find them (`packages/README.md` explains
> how to update them).  The
> framework's API may still change before its first release, and so may its name - the
> `IdeaBlade.Validation` / `@ideablade/validation` packages and their namespaces and imports.

The rules are the server's, in two places: the entities' data annotations (`[Required]`,
`[StringLength]`), which reach the client in the Breeze metadata, and the validation metadata
(`server/TempHire.Server/Validation/validation.metadata.json`) for the rules annotations cannot express -
U.S. addresses with a state and a ZIP code, phone number formats, rates, valid dates, and a resource
with at least one address and one phone number who is at least 18 years old when hired.  Both are
read by [IdeaBlade.Validation / `@ideablade/validation`](https://github.com/Breeze/ideablade-validation),
which surfaces every rule as the same kind of `ValidationError` on both sides; the server's README
describes the server half in [Validation](https://github.com/Breeze/temphire.server#validation).
On the client:

- **At sign-in** `EntityManagerProvider` loads the validation metadata (`api/validation/Metadata`)
  next to the Breeze metadata, gives it Breeze's display names (`displayNameMetadata`) and installs
  it into Breeze (`installBreezeValidators`), so Breeze runs every rule before a save.
- **The app's validation service** is created in `createAppServices` and provided by
  `<ValidationProvider>` in `main.tsx`.  Resource Management has its own
  (`useValidationScope(unitOfWork.entityStore)`), whose entity store is the unit of work being
  shown.  It also validates that unit of work continuously (`validateEntityStore()`): every live
  entity against every rule, sync and async, the metadata's and Breeze's, again whenever an entity
  changes.  The fields, the tab marks and the Save button follow that one result.  Saving goes
  through `SaveHandler` (`core/services/save-handler.ts`, `useServices().saveHandler`), which
  every workspace uses: it validates the unit of work again when Save is clicked
  (`validateEntityStoreOneTime`), since the continuous result catches up with an edit a moment
  later and a Save clicked right after an edit would otherwise miss it.  Nothing is saved while
  any rule is broken, async ones included: the handler shows every error and says why.  After a
  save (or a deletion, `commit`) it drops the shared unit of work's cache, so the read-only views
  re-read what was saved.
- **Entity editors** wrap each card or row in `<ValidationForm model={entity}>`, which validates the
  whole entity; each `Entity*` input (`core/validation/EntityFields.tsx`) shows the errors to show
  about its property (`useFieldValidation`), and reports the user's edits and leaving the field
  with `markTouched`.  Breeze's own rules reach the inputs through the `breeze` validator, the same
  way as the server's.  A rule about two fields shows on both: "at least 18 years old when hired"
  names both dates, and changing either re-checks the other.
- **A new resource is not all red at once.**  `ResourceMgt` creates an `ErrorVisibility` with
  `breezeIsNew`, reports the unit of work's validation to it (`observeEntities`), and provides it
  to the detail (`ErrorVisibilityProvider`); validation itself is unchanged.  Loaded entities show
  all their errors.  A new one - a resource, or an address or phone number added to one - starts
  with its first errors hidden: a field's show once the user edits or leaves it, and an error the
  user causes shows at once, on every field it is about, touched or not.  Save stays enabled while
  rules are broken: clicking it shows every error, and a "Not saved" notification says why nothing
  happened and where to look.  An entity added after that starts with its errors hidden again.  The library's
  [Showing errors](https://github.com/Breeze/ideablade-validation/blob/main/docs/concepts.md#showing-errors-error-visibility)
  describes the rules.
- **Rules about a whole entity**, such as "at least one address", have no field.  Validating the
  whole unit of work keeps them current - deleting a resource's last address breaks the resource's
  rule without changing the resource - and the address and phone lists show them from the same
  result (`useEntityStoreValidation()`), through `useShownErrors`, so they follow the same rules: a
  new resource's messages show on a save attempt, or when the user deletes the last address or
  phone number.  A new resource starts without an address or a phone number, and the last one of
  each can be deleted, so the rule is the user's to satisfy.
- **Tabs with errors are marked.**  Each detail tab shows a red count of the errors it has to show,
  so a problem on a tab the user is not looking at does not have to be hunted for.  The counts come
  from the same validation of the unit of work, not from the fields - the lazy tabs have none until
  they are opened - and follow the error visibility (`useErrorVisibility()` and
  `useErrorVisibilityVersion()` in `ResourceDetail`): a new resource's tabs are marked once the
  user breaks a rule or tries to save.  `resource-tabs.ts` places each error on a tab by the type of
  its entity, and the resource's own rules by their id; its test fails for an entity type or a rule
  nobody has placed.
- **The name editor** validates a `ResourceName` view model with the service
  (`core/validation/client-validation-metadata.ts`); its properties inherit `StaffingResource`'s
  Breeze rules with `from`, so nothing is restated.  It shows a name's errors once the user has
  left its field (Mantine's `validateInputOnBlur`), not through the screen's `ErrorVisibility`, and
  OK waits until the names are valid.
- **Display names live in one place**, `core/model-display-names.ts`, and the validation messages
  use them too.

### On the server: validating the database as it will be after the save

The server checks every save against the same metadata, and not only against what the save holds:
it loads the related entities the rules read, applies the save on top, and validates **the
database as it will be after the save**.  So a rule that two users break together - each deleting
a different one of a resource's two addresses - is caught even though neither save was wrong on its
own, and no concurrency check would catch it.  The code that loads those entities is TempHire's
own, written from its model, and an AI coding assistant can keep it in step with the rules.  The
server's README explains it in
[Validating the database as it will be after the save](https://github.com/Breeze/temphire.server#validating-the-database-as-it-will-be-after-the-save).

### Concurrency

Every entity the client can save has a `RowVersion`, and a save that would overwrite or delete a
row someone else saved in the meantime fails with a concurrency conflict (409); see
[Concurrency](https://github.com/Breeze/temphire.server#concurrency) in the server's README.  The
client tells the user so, in plain words, rather than showing the database's message: someone else
changed this data, so click Refresh to load the latest, then make the changes again and save
(`CONCURRENCY_CONFLICT` in `core/services/error-handler.ts`).

## The server

The server is **ASP.NET Core 10** with the **Breeze .NET server 8** and **EF Core 10** on SQL
Server, shared with the Angular version.  It lives in its own repository,
[temphire.server](https://github.com/Breeze/temphire.server), included here as a git submodule in
`server/`, and its README documents it.  In short, it:

- serves the Breeze metadata, queries and saves, and the validation metadata, and checks every
  save against the same rules as the client, on the database as it will be after the save;
- confines each user to their company's data, the company taken from their email domain;
- signs users in as its own OAuth 2.1 authorization server, with ASP.NET Core Identity and
  OpenIddict, and enforces the Editor and Reader roles;
- runs Quinn, with an MCP server that other MCP clients such as Claude Code can use as well -
  with this version's port:

  ```
  claude mcp add --transport http temphire-react http://localhost:5100/mcp
  ```

- creates, migrates and seeds its databases on startup.

What this version sets differently - the server's URL, its databases and the dev server's origin -
is in `server.appsettings.json` (see [Next to the Angular version](#next-to-the-angular-version)).

The sections of its README:

- [Running it](https://github.com/Breeze/temphire.server#running-it), with the
  [sample users](https://github.com/Breeze/temphire.server#sample-users) and the
  [tests](https://github.com/Breeze/temphire.server#tests)
- [Quinn, the assistant](https://github.com/Breeze/temphire.server#quinn-the-assistant):
  [how it works](https://github.com/Breeze/temphire.server#how-it-works),
  [Ollama or Claude](https://github.com/Breeze/temphire.server#ollama-or-claude),
  [setting up Ollama](https://github.com/Breeze/temphire.server#setting-up-ollama),
  [setting up Claude](https://github.com/Breeze/temphire.server#setting-up-claude)
- [Multi-tenancy](https://github.com/Breeze/temphire.server#multi-tenancy)
- [Users and sign-in](https://github.com/Breeze/temphire.server#users-and-sign-in):
  [using TempHire's MCP server from Claude Code](https://github.com/Breeze/temphire.server#using-temphires-mcp-server-from-claude-code),
  [roles](https://github.com/Breeze/temphire.server#roles),
  [adding an external provider such as Microsoft Entra ID](https://github.com/Breeze/temphire.server#adding-an-external-provider-such-as-microsoft-entra-id)
- [Validation](https://github.com/Breeze/temphire.server#validation):
  [validating the database as it will be after the save](https://github.com/Breeze/temphire.server#validating-the-database-as-it-will-be-after-the-save),
  [concurrency](https://github.com/Breeze/temphire.server#concurrency)
- [The database schema](https://github.com/Breeze/temphire.server#the-database-schema) and
  [using a different database](https://github.com/Breeze/temphire.server#using-a-different-database)
- [Configuration](https://github.com/Breeze/temphire.server#configuration),
  [layout](https://github.com/Breeze/temphire.server#layout) and
  [known gaps](https://github.com/Breeze/temphire.server#known-gaps)

**Changing the server.**  `server/` is a clone of temphire.server: commit and push there, then
commit the submodule's new commit here, so this repository records which server version it runs
with.

---

## Layout

```
temphire.react/
├── server.appsettings.json         # what the server does differently for this version
├── server/                         # git submodule: temphire.server (see its README's Layout)
│   ├── TempHire.sln
│   ├── TempHire.Model/             # entities, DbContexts, migrations, sample data
│   ├── TempHire.Server/            # Breeze, validation, OAuth, Quinn and MCP
│   └── TempHire.Server.Tests/      # saves, concurrency and save-time rules (dotnet test)
├── packages/                       # the @ideablade/validation preview
└── client/
    ├── metadata.json               # Breeze metadata exported from the server
    ├── vite.config.ts              # build, dev server and tests
    └── src/
        ├── main.tsx                # start-up: providers, Breeze, the router
        ├── styles.css              # the app's look
        └── app/
            ├── App.tsx             # the shell: toolbar, page, Quinn
            ├── app.routes.tsx      # routes, loaders, lazy pages
            ├── core/
            │   ├── model/          # generated entity classes
            │   ├── services/       # auth, apiFetch, Breeze managers, units of work, dialogs, toolbar
            │   ├── hooks/          # useUnitOfWork, useBusy
            │   ├── validation/     # the Entity* inputs, the client validation metadata
            │   └── theme/          # the Mantine theme
            ├── auth-callback/      # where sign-in returns to
            ├── home/
            ├── resource-mgt/       # the workspace, its search, detail, dialogs and sections
            ├── quinn/              # the chat pane
            └── usage/              # Quinn's usage and budgets, from the user menu
```

## Configuration

| Setting | Where | Notes |
|---|---|---|
| `urls`, `ConnectionStrings:*`, `AllowedClientOrigins` | `server.appsettings.json` | This version's server URL (`http://localhost:5100`), databases (`TempHireReact`, `TempHireReactIdentity`) and dev server origin (`http://localhost:5173`), overriding the server's `appsettings.json` |
| Ports | `server.appsettings.json`, `client/vite.config.ts` | 5100 and 5173; the client's `environment.ts` names the server's |
| `Agent:*` | `server/TempHire.Server/appsettings.json`, user secrets | Quinn's model and budgets (`Agent:Quotas`); see [Quinn](#quinn) |

The server's other settings are in [its README](https://github.com/Breeze/temphire.server#configuration).

## Known gaps

- **The breeze-client 3.0.0 empty-body workaround** is carried over from the Angular version
  (`core/services/breeze-fetch.ts`); its spec fails once a release with the fix is installed, which
  is the signal to remove it.
- **The main bundle is large**: about 740 kB, 230 kB compressed - React, Mantine and Breeze - and
  Vite warns about it. The pages themselves load as separate chunks.
- **No end-to-end tests.** The unit tests cover the services, guards, Breeze field binding, Quinn's
  conversation and a component regression, and the server tests its saves; the screens were checked
  by hand in a browser.
