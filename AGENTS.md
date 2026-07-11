# AGENTS.md

## Project

Monikers is a local party game supporting pass-and-play and same-room play on
each player's device. It is a Next.js App Router application served by one
long-lived custom Node process. That process owns a small HTTP lifecycle API,
native-browser WebSocket connections through `ws`, and authoritative in-memory
sessions. Sessions survive refresh/reconnect but not a Node restart. There is
no durable persistence, account authentication, or horizontal scaling.

User-facing copy, metadata, and accessibility labels are in Bahasa Indonesia.

Default to behavior- and visual-preserving changes. Treat gameplay, content,
card data, and design changes as separate product work.

## Toolchain

- Node.js 20 or newer.
- pnpm 11.5.2, as pinned by `packageManager`.
- Next.js 15, React 19, strict TypeScript, and Zustand 5.
- CSS Modules for component styles.
- Vitest for unit tests and Playwright Chromium/WebKit for browser tests.

Install dependencies with:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium webkit
```

## Commands

- `pnpm dev`: start the typed custom server with Turbopack on port 3000.
- `pnpm format`: format the repository.
- `pnpm format:check`: check formatting without edits.
- `pnpm lint`: lint source and configuration files with ESLint.
- `pnpm typecheck`: run strict TypeScript checking without emitting files.
- `pnpm test`: run colocated Vitest unit tests once.
- `pnpm test:watch`: run Vitest in watch mode.
- `pnpm check`: run format, lint, typecheck, and unit checks.
- `pnpm build`: create the production Next.js build.
- `pnpm start`: run the production custom server; `PORT` defaults to 3000.
- `pnpm test:e2e`: build and run the full Playwright flow and visual suite.
- `pnpm test:e2e:update`: intentionally replace screenshot baselines.

`next/font` fetches Geist during a clean production build, so the build may need
network access when the font is not cached.

## Architecture

```text
src/app/                         Next.js entry points and document globals
src/features/game/cards/         Raw card data, catalog, and deck operations
src/features/game/domain/        Framework-free types, rules, and scoring
src/features/game/store/         Scoped Zustand store and provider
src/features/game/session/       Stage composition and store lifetime
src/features/game/session-entry/ Home and code-join flows
src/features/game/session-client/ Projection-driven session client and hooks
src/features/game/session-protocol/ Shared schemas and protocol unions
src/features/game/own-device/    Own-device lobby/selection/turn/recovery UI
src/features/game/setup/         Setup screen and numeric controls
src/features/game/card-selection/ Private handoff and card picker
src/features/game/turn/          Turn controller, browser effects, and views
src/features/game/score/         Round/final score views
src/shared/hooks/                Hooks used by more than one feature
src/shared/ui/                   Feature-independent UI components
src/server/session/              Serializable aggregate, reducer, projections
src/server/runtime/              Repository, HTTP, WebSocket, deadlines
server.ts                        Custom Next.js/HTTP/WebSocket process entry
tests/e2e/                       Full game flow and committed screenshots
```

Keep dependency direction explicit:

```text
app -> session client -> feature screens/controllers -> protocol + shared UI
server runtime -> session reducer -> cards + game domain
legacy store -> cards + domain
cards catalog -> raw JSON data
```

- Domain modules must not import React, browser APIs, the store, or raw data.
- Shared UI and hooks must not import game features.
- Only `cards/catalog.ts` should assemble the raw JSON decks.
- Use direct `@/` imports. Do not add barrel `index.ts` files.

## State

The server session aggregate owns authoritative serializable game state. The
client receives recipient-specific, versioned projections and sends typed
commands with unique IDs. It must not submit whole state, replay commands after
disconnect, or mutate gameplay optimistically. Server deadlines, rather than
browser ticks, decide turn expiration.

The scoped Zustand store remains for framework-free transition coverage and
behavior comparison; canonical `/session/<id>` gameplay is server-authoritative.

Feature-level screens/controllers may subscribe to narrow selectors.
Presentational components remain prop-driven. Never put sockets, heartbeat
metadata, timeout handles, DOM refs, Audio instances, focus mechanics, or
temporary input drafts in the serializable aggregate. Runtime metadata belongs
under `src/server/runtime`; browser concerns belong in focused hooks under the
owning feature.

Pure deck, rule, scoring, and state-transition behavior must remain testable
without rendering React.

## Gameplay Invariants

- Setup defaults to 4 players and 5 cards per player.
- Player count is 2-20; cards per player is 1-10.
- Flow is setup -> private selection -> turn -> round score -> next round, with
  final score after round 3.
- Every player privately chooses the configured count from count plus two
  options. Chosen cards are excluded from later players' options.
- A card's `word` is its identity. The catalog de-duplicates words.
- All three rounds reuse and reshuffle the originally chosen deck.
- Each new round starts with Team 1; teams alternate after incomplete turns.
- Turns last 60 seconds. Timeout rotates the active card to the back and banks
  cards guessed during that turn.
- A team can skip once, then earns another skip after a correct guess.
- Ending a turn early banks its guessed cards and preserves remaining cards.
- Card level is its point value. Scores accumulate by team and round.
- A correct guess plays the bell; any turn ending plays the ring.
- Leave/back protection is active throughout every session phase.
- Stage/view changes scroll to the top and move focus to the primary heading.

## Components And Styles

- Use lowercase kebab-case responsibility folders.
- Give meaningful components PascalCase folders and files.
- Colocate `Component.tsx`, `Component.module.css`, and focused tests when useful.
- Split by behavioral or reusable responsibility, not arbitrary markup chunks.
- Treat files above roughly 250 lines as a review signal, not an automatic rule.
- `src/app/globals.css` is only for tokens, reset, document defaults, and global
  accessibility/motion behavior.
- A component owns its CSS Module. Do not reach into another module's generated
  classes or add `:global` escape hatches for feature styling.
- Extend shared primitives through documented props and `className`.
- Preserve CSS variables, focus visibility, reduced motion, and semantic HTML.
- Check the existing max-width, short-portrait, landscape, narrow-landscape,
  and short-desktop media rules when changing layout.
- Keep visible copy and ARIA labels in Bahasa Indonesia.

## Cards And Assets

Raw cards live in `src/features/game/cards/data/` and have this shape:

```ts
{
  level: 1 | 2 | 3 | 4;
  word: string;
  description: string;
}
```

Do not silently rewrite or de-duplicate the JSON files. Catalog-level
de-duplication is deliberate. Sound URLs are stable public contracts:
`/sounds/bell.wav` and `/sounds/ring.wav`.

## Verification

Run `pnpm check` for every code change. Run `pnpm test:e2e` for changes to game
flow, state, components, styling, responsive behavior, accessibility, card
selection, scoring, timers, or browser effects.

The Playwright suite completes a two-player, one-card-per-player game through
all three rounds in desktop and mobile Chromium. It also exercises timeout,
skip reset, early turn ending, team handoff, and sound dispatch. Seven primary
stage screenshots are committed per standard viewport, with focused baselines
for 360px, short portrait, landscape, narrow landscape, and short desktop
layouts. Update snapshots only for an intentional visual change, inspect every
changed image, and explain the change.

Unit tests must cover pure rules and store transitions. Use injected random
sources for deterministic deck tests. Prefer semantic browser locators over CSS
selectors or test IDs.

Browser automation does not prove audible output or native unload behavior.
Manually smoke-test sounds, back/unload confirmation, keyboard focus, a normal
phone portrait, a short portrait, and a short landscape after related changes.

## Change Discipline

- Keep refactors separate from fixes, content edits, and redesigns.
- Preserve existing runtime algorithms unless the change is explicitly scoped
  and protected by new regression tests.
- Do not add durable persistence, accounts, or horizontally shared state
  implicitly.
- Avoid unrelated dependency upgrades and generated metadata churn.
- Use Conventional Commit prefixes such as `feat:`, `fix:`, `refactor:`,
  `test:`, `docs:`, and `build:` when creating commits.
