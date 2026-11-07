# Bytefight

Public real-time multiplayer quiz battle for programming topics (C#, SQL, EF Core, ASP.NET, HTML, CSS, JS). Players register with username + password, join rooms by a 5-char code, answer the same timed multiple-choice questions together, and get a 5–12 rating and XP after each match. First audience: IT Academy STEP students.

The full product and build plan is the source of truth. Read it before any work:

@docs/PLAN.md

## Repository

One monorepo:

- `api/`: .NET 10 solution `Bytefight.slnx`. Clean Architecture in 4 projects (`Bytefight.Domain`, `Bytefight.Application`, `Bytefight.Infrastructure`, `Bytefight.Api`) plus 4 test projects (`Bytefight.UnitTests`, `Bytefight.IntegrationTests`, `Bytefight.ArchitectureTests`, `Bytefight.Tests.Common`).
- `web/`: Nx + pnpm workspace. Apps `game`, `admin`, `game-e2e`, `admin-e2e`. Libraries `libs/shared/{ui,question-card,api-client,tokens}`.
- PostgreSQL 17 via EF Core (Npgsql). Local run with Docker Compose (api, web, postgres).

Full layout: `docs/PLAN.md` §8.

## API rules

- Dependencies point inward: Api → Infrastructure → Application → Domain. Domain references nothing; Application references only Domain. Architecture tests enforce this.
- Application is organised as **modules → features → use cases**: `Modules/<Module>/Features/<Feature>/<UseCase>/`. Modules: `Identity`, `Content`, `Game`, `Stats`. One use case folder holds its command or query, handler, FluentValidation validator and response type.
- Modules are folders, not projects. A module never calls another module's features directly; cross-module reactions use MediatR notifications (e.g. `MatchFinished` → Stats).
- **MediatR is pinned to 12.5.0** in `Directory.Packages.props`. Versions 13+ are commercial: never upgrade, never suggest upgrading.
- Game logic lives in Domain: `Room` owns the state machine; `Scoring`, `Rating`, `Xp` are pure static functions. Handlers load, call and save; they hold no game rules.
- **Repository pattern over EF Core.** Application never references EF Core. Writes go through one repository per aggregate root (`IUserRepository`, `ICategoryRepository`, `IQuestionRepository`, `IMatchRepository`) plus `IUnitOfWork.SaveChangesAsync`. Reads that return DTOs (lists, profile, history, leaderboard, question stats) go through read interfaces per module (`IContentReader`, `IStatsReader`) that project with EF Core in Infrastructure. Interfaces live in `Application/Abstractions`, implementations in `Infrastructure/Persistence`.
- No generic `IRepository<T>`, no AutoMapper, no generic "Services" folder. Prefer explicit code; do not add a pattern the current phase does not need.
- **The server is the only authority** for time, answers, points, ratings and XP. Never send a correct answer, explanation or another player's pick to the client before the reveal phase.
- Live rooms stay in memory (`IRoomStore` → `ConcurrentDictionary`); every room mutation goes through that room's `SemaphoreSlim`. Time comes only from `IClock`. A finished match is written to PostgreSQL in one transaction.
- One SignalR event to clients: `Snapshot` (whole public room state). Clients never patch state locally.
- The formulas in `docs/PLAN.md` §4 are exact; do not change them without asking.
- All user-facing API messages (validation, errors) are in Georgian. Identifiers, code and comments are in English.

## Web rules

- Angular 21, standalone components, **Signals only** in app code (`signal`, `computed`, `effect`, `input()`, `output()`); no RxJS in components or stores. The SignalR client callbacks feed signals directly.
- Tailwind CSS. Colours, fonts and radii come only from `libs/shared/tokens` (values in `docs/PLAN.md` §11). Light and dark themes must both work.
- UI text is Georgian, written directly in templates. No i18n library.
- A question is rendered only by `libs/shared/question-card`; the admin preview uses the same component as the game.
- Nx tags: `scope:game`, `scope:admin`, `scope:shared`. Apps may import `shared`; `game` and `admin` never import each other.
- Effects and sounds stay light and soft (`docs/PLAN.md` §12) and respect `prefers-reduced-motion` and the user's sound settings.

## Tests

- `Bytefight.UnitTests`: Domain (formulas, state machine, picker rules); Application only for handlers with real logic.
- `Bytefight.IntegrationTests`: WebApplicationFactory + Testcontainers PostgreSQL + SignalR test clients.
- `Bytefight.ArchitectureTests`: layer dependencies and module isolation.
- `Bytefight.Tests.Common`: shared builders, `FakeClock`, database fixture.
- Web: Playwright e2e only (`game-e2e`, `admin-e2e`). No Angular unit tests.
- Add tests together with the code they cover.

## How to work in this repo

- Work one phase at a time from `docs/PLAN.md` §13. The phase's "Done when" is the acceptance check.
- **Before writing code for a phase or a non-trivial change, present a short plan and wait for approval.** Do not change files outside the agreed scope.
- Keep `docs/PLAN.md` in sync: if an approved decision changes the plan, update the relevant section in the same change.

## Commands

Fill these in during Phase 0:

- Run everything: `docker compose up`
- API tests: `dotnet test api/Bytefight.slnx`
- New migration: `dotnet ef migrations add <Name> -p api/src/Bytefight.Infrastructure -s api/src/Bytefight.Api`
- Web dev servers: `cd web && pnpm nx serve game` / `pnpm nx serve admin`
- E2E: `cd web && pnpm nx run-many -t e2e`
