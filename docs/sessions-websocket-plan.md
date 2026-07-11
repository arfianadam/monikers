# Server-Authoritative Sessions and Own-Device Play

## Summary

- Replace the browser-owned game with an authoritative in-memory session
  service running beside Next.js in one long-lived Node process, using a
  [Next.js custom server](https://nextjs.org/docs/15/app/guides/custom-server),
  native browser WebSockets, and [`ws`](https://github.com/websockets/ws).
- Both modes receive opaque `/session/<id>` URLs and resume through path-scoped
  `HttpOnly` cookies. Only own-device sessions receive public six-character
  join codes.
- Preserve existing rules and single-device stage presentation. Add
  multiplayer-specific lobby, simultaneous card selection, waiting,
  role-based turn, and recovery views.
- Sessions survive refreshes and temporary disconnections, but not Node
  restarts. Deployment and durable storage remain outside this change.

## Runtime, State, and Protocol

- Add a typed custom server entry point and update development, production,
  Playwright, package-lock, README, and AGENTS instructions. Add `ws`, Zod, the
  required server TypeScript runner, and Playwright WebKit support.
- Introduce a serializable session aggregate and pure session reducer around
  the existing deck, scoring, and turn transitions:
  - Common state: mode, phase, configuration, revision, controller, and game
    state.
  - Own-device state: roster, team order, readiness, private
    offers/selections, per-team clue-giver cursors, current clue-giver, and
    departure status.
  - Keep sockets, heartbeat state, timeout handles, rate limits, and cleanup
    metadata outside serializable state.
  - Keep separate selection reducers: existing sequential selection for
    single-device mode and simultaneous private selection for own-device mode.
    Both feed the same post-selection turn/scoring core.
- Add an in-memory repository behind a storage interface:
  - Index sessions by cryptographically random internal ID and live join code.
  - Run cleanup every five minutes and remove rooms 24 hours after the final
    connection closes.
  - Explicit session ending deletes immediately.
  - Reconcile expired deadlines whenever a timer fires, command arrives, or
    client reconnects.
- Provide a small HTTP lifecycle surface handled by the same server instance:
  - Create a pending single- or own-device session, set its resume cookie, and
    return its route.
  - Activate an own-device creator after their name is accepted, then generate
    the public code.
  - Preview a valid code using only controller name and player count.
  - Join with code and display name, creating a membership cookie.
  - Explicitly leave or end a session and clear/revoke the corresponding
    credential.
  - Unknown and expired codes share a generic error; valid but full or started
    rooms return precise errors.
- Upgrade WebSockets only below `/session/<id>/live` so the path-scoped cookie
  is included. Validate same-origin requests and replace an older socket when
  the same participant reconnects in another tab.
- Define shared Zod schemas and TypeScript discriminated unions for:
  - `SessionMode`, phases, participants, presence, and public/private
    projections.
  - Actor-authorized commands grouped into lobby, selection, turn, round,
    replay, and cancellation actions.
  - Command acknowledgements, stable error codes, ephemeral sound events, and
    projections containing `version` and `serverTime`.
- Serialize commands per room. Commands carry unique IDs and relevant
  phase/turn identifiers; cache recent results for idempotency. Clients never
  submit whole state, replay offline commands, or mutate gameplay
  optimistically.
- Send full recipient-specific projections after connection and meaningful
  changes:
  - Lobby projections contain configuration, controller, roster, team order,
    readiness, and presence.
  - Selection projections contain only the recipient's offer/draft plus each
    player's `Memilih...`/`Selesai` status.
  - Turn projections expose public player/team/timer/count/score information
    to everyone, but send the card and controls only to the active
    clue-giver.
  - Guessed card identities stay private until the round recap.
  - Single-device sessions send the one controller browser the state needed
    for the existing handoff workflow.
- Use server deadlines rather than per-client ticks. Projections carry
  `turnEndsAt`; clients derive the display countdown. Commands received after
  the deadline lose the race, regardless of the client display.
- Generate codes from uppercase ambiguity-free letters and digits, accept
  lowercase/spaces/hyphens, collision-check against live rooms, and allow
  controller rotation in the lobby.
- Enforce the agreed creation, failed-code, and per-connection rate limits;
  validate every command's phase, actor, ranges, active card/turn, and existing
  one-second correct-answer cooldown.

## Session and Gameplay Behavior

- Home presents three direct Indonesian actions: single device, create
  own-device session, and join by code.
- Single-device mode:
  - Creates its server session before setup and uses the session URL
    throughout.
  - Retains the current 4-player/5-card defaults, sequential private handoff,
    team-only turns, and existing screens.
  - Has no public join code or participant-ready flow.
  - `Main lagi` resets to the existing default setup inside the same session.
- Own-device lobby:
  - The creator becomes the first player and controller after entering a
    unique 1-24-grapheme Unicode display name.
  - Derive player count from the 2-20-player roster; only the controller
    changes cards per player.
  - Assign newcomers to the smaller team, alternating tie-breaks, and append
    them to that team's order.
  - Allow the controller to move players between teams and reorder them with
    explicit up/down buttons.
  - Permit temporary imbalance but require both teams, a size difference of at
    most one, all players connected, and all players ready before starting.
  - Apply readiness resets exactly as agreed: all players for
    joins/configuration/removal; renamed or team-moved player only; moved and
    swapped players for reordering; disconnected player after the grace
    period.
  - Allow code copy/rotation and controller removal. A removed device token
    cannot rejoin that session.
- Card selection:
  - Atomically deal each player a disjoint private set of
    `cardsPerPlayer + 2` from the deduplicated catalog.
  - Allow private editing until confirmation; confirmation requires the exact
    count and becomes irreversible.
  - Advance automatically to Team 1's first handoff when everyone confirms.
  - If selection is blocked by a departed player, let the controller either
    keep waiting or cancel back to the lobby. Cancellation discards every
    offer and selection; the next start deals fresh cards.
- Turn rotation:
  - Freeze team membership/order when selection starts.
  - Maintain independent round-robin cursors for both teams, advance the
    acting team after every completed, expired, or early-ended turn, and
    preserve cursors across rounds.
  - Continue starting every round with Team 1 and alternate teams after
    incomplete turns.
  - Give a disconnected scheduled clue-giver 30 seconds to return, then skip
    to the next connected teammate. Pause if that team has nobody connected.
  - Only the scheduled clue-giver starts the 60-second timer and receives the
    card/actions. Their active timer continues through refresh or
    disconnection.
  - Permanently departed players cannot reclaim membership; retain their
    selected cards and earned scores but skip their future turns.
  - Play bell/ring events only on the active clue-giver's device and only after
    server acceptance.
- Controller lifecycle:
  - Transfer control after a 30-second disconnection to the longest-connected
    remaining player, using join order as the tie-breaker. Do not restore
    control automatically if the former controller returns.
  - Restrict next-round and replay actions to the controller.
  - Allow a confirmed return to the lobby from an in-progress own-device game,
    preserving session/code/remaining memberships/team order while clearing
    gameplay and readiness.
  - `Main lagi` after final score reopens the same code and lobby, preserves
    configuration and remaining roster/team order, removes permanently
    departed players, and resets readiness.
  - Provide a separately confirmed destructive session-ending action.
- Reconnection and navigation:
  - Retry WebSockets with capped exponential backoff plus a manual `Coba lagi`
    action; disable mutating controls while disconnected.
  - Show a solid green dot when connected, gently pulsing yellow/red dots with
    visible Indonesian text when connecting/disconnected, and suppress pulsing
    under reduced motion.
  - Apply leave/back protection throughout every session phase. Use accessible
    in-app dialogs for explicit destructive actions and native prompts only
    for browser unload/navigation.
  - Request a best-effort wake lock on own-device clients from selection
    through between-round scores, releasing it in the lobby/final screen and
    reacquiring after foregrounding.

## Routes and UI Integration

- Add `/session/[id]` as the canonical route for both modes and `/join/[code]`
  for share links; manual code entry uses one accessible field.
- Replace `/` with the new three-path entry screen while reusing the existing
  visual system and Bahasa Indonesia copy.
- Add focused own-device views for creator activation, lobby/team management,
  private selection, selection waiting, turn handoff, public turn watching,
  duplicate-tab/revoked/expired recovery, and reconnecting states.
- Adapt current stage controllers to consume server projections and issue
  commands while retaining presentational components where their props still
  match.
- Reuse score components for every device, showing controller-only actions or
  an appropriate waiting state.
- Keep secret data out of unauthorized component props and DOM, not merely
  hidden through CSS.
- Preserve heading focus, scroll restoration, semantic controls, live
  announcements, visible focus, safe-area handling, short/landscape layouts,
  and 44px touch targets. Lobby layouts must remain usable with 20 players.

## Verification and Acceptance

- Preserve and extend pure unit coverage for existing rules, deterministic
  decks, scoring, and transitions.
- Add fake-clock session reducer tests for:
  - Both creation modes, code/token lifecycle, cleanup, controller transfer,
    readiness resets, team assignment/reordering, and replay/reset.
  - Maximum-size disjoint dealing, private confirmation, cancellation, and
    automatic selection completion.
  - Per-team rotation across rounds, disconnected/departed players, fully
    offline teams, active disconnects, deadline races, timeout banking, skip
    reset, and early ending.
  - Actor permissions, idempotent commands, stale turn rejection, rate limits,
    and role projections that never leak offers/cards.
- Add HTTP/WebSocket integration tests using an ephemeral server for cookie
  resume, join preview/admission, duplicate sockets, reconnect, origin
  rejection, code rotation, late-join rejection, and session expiration.
- Adapt the existing Chromium flow to create and resume a single-device
  session, including refresh recovery, while preserving stage layouts apart
  from the intentional connection indicator.
- Add a multi-context Chromium flow covering creator/joiner cookies, lobby
  management, simultaneous private selection, role switching, all three
  rounds, scoring, sounds, reconnect grace, controller transfer, replay, and
  secret-card DOM isolation.
- Add a focused Playwright WebKit flow through join, lobby, simultaneous
  selection, one turn, and reconnect; keep WebKit free of screenshot
  baselines.
- Add intentional Chromium baselines for the new home, join, dense lobby,
  private/waiting selection, public/active turn, and connection-error states;
  inspect every changed image.
- Run `pnpm check`, the production build, and the full Playwright suite.
  Manually smoke-test iOS Safari and Android Chrome for audio, wake lock,
  clipboard, focus, unload prompts, backgrounding, and network loss.

Assumptions and exclusions: same-origin co-located play only; no accounts,
durable restart persistence, deployment configuration, horizontal scaling, QR
codes, spectators, remote chat/voice, cross-device identity takeover, custom
team names, undo, offline play, or optimistic gameplay updates.
