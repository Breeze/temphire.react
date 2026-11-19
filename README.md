# TempHire (React + BreezeJS + .NET)

TempHire is a **reference implementation of a data-driven line-of-business application**: a
staffing company's people, with their addresses, phone numbers, rates, skills and work history,
searched in a grid and edited in a form, with validation, save and cancel - plus an AI assistant,
multi-tenancy, roles and OAuth 2.1 sign-in.

This repository is the **React** version. It is a framework conversion of
[temphire.angular](https://github.com/Breeze/temphire.angular): the same application, screen for
screen, with the Angular client rewritten in React and the .NET server unchanged. It is meant for
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
| Server | ASP.NET Core 10, Breeze .NET 8, EF Core 10, OpenIddict | the same server |

---

## Prerequisites

- [.NET SDK](https://dotnet.microsoft.com/download) 10.0 or later
- [Node.js](https://nodejs.org) **26.13.0**, pinned in `.node-version` (`nvs auto` picks it up)
- SQL Server **LocalDB** (Visual Studio's "Data storage and processing" workload, or SQL Server
  Express), or any SQL Server - see the connection strings in `server/TempHire.Server/appsettings.json`
- For Quinn: [Ollama](https://ollama.com) with `qwen3:4b-instruct` (the default), or an Anthropic
  API key for Claude - see [Quinn](#quinn)

## Running it

TempHire's validation uses a preview of
[IdeaBlade Validation](https://github.com/Breeze/ideablade-validation), which isn't published yet.
Its packages are in `packages/`, and `dotnet` and `npm install` take them from there (see
[Validation](#validation)), so there is nothing extra to install.

Then two terminals; the server first, because the client loads its Breeze and validation metadata
from it.

**1. Server** (`http://localhost:5100`)

```
cd server/TempHire.Server
dotnet run
```

On first start it creates and seeds its two databases, `TempHireReact` and `TempHireReactIdentity`:
two companies, two users each, and 25 staffing resources per company.

**2. Client** (`http://localhost:5173`)

```
cd client
npm install
npm start
```

Vite opens the app; it sends you to the server's sign-in page. The password is **`password`** for
all the sample users, and in development the sign-in page lists them for one-click sign-in:

| User | Company | Role |
|---|---|---|
| `anna@harbor.test` | Harbor Staffing | Editor |
| `ben@harbor.test` | Harbor Staffing | Reader |
| `carla@summit.test` | Summit Talent | Editor |
| `david@summit.test` | Summit Talent | Reader |

An **Editor** can add, change and delete staffing resources; a **Reader** can only look.

### Next to the Angular version

The two versions can run at the same time. This one uses ports 5100 (server) and 5173 (client),
where the Angular version uses 5000 and 4200, and its own databases, so neither touches the other's
data. They share the server's user secrets, so a Claude API key stored for one is used by both.

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

The [Angular version's README](https://github.com/Breeze/temphire.angular#quinn-the-assistant)
describes how Quinn works, and compares the two models, in detail; none of it changed.

## Validation

> **Preview.**  Validation uses a preview of IdeaBlade Validation (`0.1.0-preview.3`), which
> isn't published to NuGet or npm yet: the builds are in `packages/`, where `nuget.config` and
> `client/package.json` find them (`packages/README.md` explains how to update them).  The
> framework's API may still change before its first release, and so may its name - the
> `IdeaBlade.Validation` / `@ideablade/validation` packages and their namespaces and imports.

The rules are the server's, in two places: the entities' data annotations (`[Required]`,
`[StringLength]`), which reach the client in the Breeze metadata, and the validation metadata
(`TempHire.Server/Validation/validation.metadata.json`) for the rules annotations cannot express -
U.S. addresses with a state and a ZIP code, phone number formats, rates, valid dates, and a resource
with at least one address and one phone number who is at least 18 years old when hired.  Both are
read by [IdeaBlade.Validation / `@ideablade/validation`](https://github.com/Breeze/ideablade-validation),
which surfaces every rule as the same kind of `ValidationError` on both sides; the Angular version's
[Validation comes from the server](https://github.com/Breeze/temphire.angular#validation-comes-from-the-server)
describes the server half.  On the client:

- **At sign-in** `EntityManagerProvider` loads the validation metadata (`api/validation/Metadata`)
  next to the Breeze metadata, gives it Breeze's display names (`displayNameMetadata`) and installs
  it into Breeze (`installBreezeValidators`), so Breeze runs every rule before a save.
- **The app's validation service** is created in `createAppServices` and provided by
  `<ValidationProvider>` in `main.tsx`.  Resource Management has its own
  (`useValidationScope(unitOfWork.entityStore)`), whose entity store is the unit of work being
  shown.  It also validates that unit of work continuously (`validateEntityStore()`): every live
  entity against every rule, sync and async, the metadata's and Breeze's, again whenever an entity
  changes.  Save reacts to that one result: it stays disabled while any rule is broken, and while
  async rules have yet to answer.
- **Entity editors** wrap each card or row in `<ValidationForm model={entity}>`, which validates the
  whole entity; each `Entity*` input shows the errors about its property (`useFieldValidation`).
  Breeze's own rules reach the inputs through the `breeze` validator, the same way as the server's.
  A rule about two fields shows on both: "at least 18 years old when hired" names both dates, and
  changing either re-checks the other.
- **Rules about a whole entity**, such as "at least one address", have no field.  Validating the
  whole unit of work keeps them current - deleting a resource's last address breaks the resource's
  rule without changing the resource - and the address and phone lists show them from the same
  result (`useEntityStoreValidation()`).  A new resource starts without an address or a phone
  number, and the last one of each can be deleted, so the rule is the user's to satisfy.
- **The name editor** validates a `ResourceName` view model with the service
  (`core/validation/client-validation-metadata.ts`); its properties inherit `StaffingResource`'s
  Breeze rules with `from`, so nothing is restated.
- **Display names live in one place**, `core/model-display-names.ts`, and the validation messages
  use them too.

### On the server: validating the database as it will be after the save

A Breeze save bundle holds only what the client changed: the entities it added, modified or
deleted.  A resource's other addresses, its phone numbers, and the resource itself aren't in it
unless they changed too.  But a rule about related entities needs them.  "A staffing resource has
at least one address" reads the resource's addresses (`store('Address')` in the metadata), and a
save that deletes an address has to be checked against the addresses that remain.

So before it validates, the server loads what the rules read (`SaveValidationStore`, used by
`TempHirePersistenceManager`):

- **the staffing resources concerned**: the ones in the save, and the ones whose addresses, phone
  numbers, rates, skills or work experience the save adds, changes, deletes or moves to another
  resource;
- **their stored children**, of every child type, so that `store('Address')` sees all of a
  resource's addresses, not just the ones in the save;
- **with the save applied on top**: deleted rows are taken out, added and changed ones put in.

The rules then run against **the database as it will be after the save**, not as the client saw it
when it loaded the data.  That difference matters: another user may have changed or deleted records
in the meantime.  Say a resource has two addresses, and two users each delete a different one.  On
each user's screen one address remains, so both saves are valid on the client.  The first save
goes through.  The second save deletes an address that nobody else touched, so the concurrency
check below has nothing to catch.  But checked against the database, the resource would be left
with no address, and the server refuses the save.  Data integrity holds even when no single save
was wrong on its own (`ARuleBrokenByTwoUsersTogetherIsCaught` in `TempHire.Server.Tests`).

**This isn't something the validation framework does for you.**  It knows the rules, but not the
model.  To IdeaBlade Validation, `store('Address')` is a name to look up.  Which addresses belong to
which resource, which entities a save can affect, and how to load them from the database are
knowledge of TempHire's model, so `SaveValidationStore` is TempHire's own code.  An AI coding
assistant such as Claude can write and maintain it: it reads the rules in
`validation.metadata.json`, sees which entities they read (`store(type)`), and works out from the
model how to load them.  That's how this one was written.  It loads a resource and all of its
children generically, so a new rule about a resource and its children needs no change.  A rule that
reads beyond that, such as one comparing a resource with other resources, does.  When the rules
change, ask the assistant to check that the store still loads everything they read.

### Concurrency

Every entity the client can save (`AuditEntityBase`) has a `RowVersion`, an EF Core concurrency
token, as DevForce's `ConcurrencyStrategy.AutoIncrement` was in the original.  A save only updates
or deletes a row while it still has the version the client loaded.  If another user saved or deleted
it in the meantime, the whole save fails with a concurrency conflict (409) and nothing is written.
The client tells the user so, in plain words, rather than showing the database's message: someone
else changed this data, so click Refresh to load the latest, then make the changes again and save
(`CONCURRENCY_CONFLICT` in `core/services/error-handler.ts`).  The lookups (states, address, phone number
and rate types) have no version: they are read-only, and the server refuses any save that includes
one.

A concurrency check covers the rows in the save, and validation covers the rules that read rows
outside it, as in the example above.  Neither serializes two saves that run at exactly the same
moment: both read the database before either writes.  Closing that gap would take a database
constraint, or a serializable transaction around validating and writing.

## The server

The server is the Angular version's, unchanged apart from the client's origin, its ports and its
database names. Its own documentation therefore applies as it is:

- [Multi-tenancy](https://github.com/Breeze/temphire.angular#multi-tenancy) - each user's company
  comes from their email domain, and every query and save is confined to it;
- [Users and sign-in](https://github.com/Breeze/temphire.angular#users-and-sign-in) - ASP.NET Core
  Identity, the Editor and Reader roles, and OAuth 2.1 with OpenIddict;
- [Using TempHire's MCP server from Claude Code](https://github.com/Breeze/temphire.angular#using-temphires-mcp-server-from-claude-code) -
  with this version's port:

  ```
  claude mcp add --transport http temphire-react http://localhost:5100/mcp
  ```

- [The database schema](https://github.com/Breeze/temphire.angular#the-database-schema) and
  [using a different database](https://github.com/Breeze/temphire.angular#using-a-different-database).

---

## Layout

```
temphire.react/
├── TempHire.React.sln
├── server/                         # the .NET server, as in temphire.angular
│   └── TempHire.Server.Tests/      # saves, concurrency and save-time rules (dotnet test)
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
            └── quinn/              # the chat pane
```

## Configuration

| Setting | Where | Notes |
|---|---|---|
| `ConnectionStrings:TempHire`, `TempHireIdentity` | `server/TempHire.Server/appsettings.json` | `TempHireReact` and `TempHireReactIdentity` |
| `AllowedClientOrigins` | `appsettings.json` | The Vite dev server, `http://localhost:5173` |
| Ports | `server/TempHire.Server/Properties/launchSettings.json`, `client/vite.config.ts` | 5100/5101 and 5173; the client's `environment.ts` names the server's |
| `Agent:*` | `appsettings.json`, user secrets | Quinn's model; see [Quinn](#quinn) |
| `OAuth:Origins` | `appsettings.json` (optional) | The server's public origins, behind a proxy |

## Known gaps

- **The breeze-client 3.0.0 empty-body workaround** is carried over from the Angular version
  (`core/services/breeze-fetch.ts`); its spec fails once a release with the fix is installed, which
  is the signal to remove it.
- **The main bundle is large**: about 740 kB, 230 kB compressed - React, Mantine and Breeze - and
  Vite warns about it. The pages themselves load as separate chunks.
- **No end-to-end tests.** The unit tests cover the services, guards, Breeze field binding, Quinn's
  conversation and a component regression, and the server tests its saves; the screens were checked
  by hand in a browser.
