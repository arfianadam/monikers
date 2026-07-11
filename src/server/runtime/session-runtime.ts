import type { RandomSource } from '@/features/game/cards/deck';
import { CARD_CATALOG } from '@/features/game/cards/catalog';
import type { Card } from '@/features/game/domain/game-types';
import type {
  CommandAcknowledgement,
  ServerEvent,
  SessionCommand,
  SessionProjection,
} from '@/features/game/session-protocol/types';
import { projectSession } from '@/server/session/session-projection';
import {
  connectParticipant,
  departParticipant,
  disconnectParticipant,
  getNextSessionDeadline,
  reconcileSessionDeadlines,
  reduceSessionCommand,
  type SessionLifecycleTransition,
} from '@/server/session/session-reducer';
import {
  replaceJoinCode,
  type SessionDependencies,
  type SessionState,
} from '@/server/session/session-state';

import type { LeaveResult } from './session-http';
import {
  InMemorySessionRepository,
  SESSION_CLEANUP_INTERVAL_MS,
  type SessionRecord,
} from './session-repository';

export type SessionDeletionReason = 'left' | 'ended' | 'expired';

export interface SessionRuntimeUpdate {
  record: SessionRecord;
  events: ServerEvent[];
  revokedActorIds: string[];
  forceProjection: boolean;
}

export interface SessionRuntimeDeletion {
  sessionId: string;
  reason: SessionDeletionReason;
  announce: boolean;
}

export interface SessionCommandOutcome extends SessionRuntimeUpdate {
  acknowledgement: CommandAcknowledgement;
  deletion?: SessionRuntimeDeletion;
}

export interface SessionRuntimeOptions {
  repository?: InMemorySessionRepository;
  catalog?: readonly Card[];
  random?: RandomSource;
  randomFactory?: () => RandomSource;
  now?: () => number;
  cleanupIntervalMs?: number;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
  setInterval?: typeof globalThis.setInterval;
  clearInterval?: typeof globalThis.clearInterval;
  onMaintenance?: () => void;
}

type UpdateListener = (update: SessionRuntimeUpdate) => void;
type DeletionListener = (deletion: SessionRuntimeDeletion) => void;

interface ScheduledDeadline {
  at: number;
  handle: ReturnType<typeof globalThis.setTimeout>;
}

const MAX_TIMER_DELAY_MS = 2_147_483_647;

function actorIdsRevokedByTransition(
  previous: SessionState,
  next: SessionState
): string[] {
  if (previous.mode !== 'own-device') return [];
  if (next.mode !== 'own-device') return [];

  return Object.values(previous.participants)
    .filter((participant) => {
      if (participant.departureStatus !== 'active') return false;
      return (
        !next.participants[participant.id] ||
        next.participants[participant.id].departureStatus === 'departed'
      );
    })
    .map((participant) => participant.id);
}

function activeOwnDeviceParticipantCount(state: SessionState): number {
  if (state.mode !== 'own-device') return 0;
  return Object.values(state.participants).filter(
    (participant) => participant.departureStatus === 'active'
  ).length;
}

export class SessionRuntime {
  readonly repository: InMemorySessionRepository;

  private readonly now: () => number;
  private readonly dependencies: SessionDependencies;
  private readonly randomFactory?: () => RandomSource;
  private readonly setTimeoutFn: typeof globalThis.setTimeout;
  private readonly clearTimeoutFn: typeof globalThis.clearTimeout;
  private readonly clearIntervalFn: typeof globalThis.clearInterval;
  private readonly deadlines = new Map<string, ScheduledDeadline>();
  private readonly updateListeners = new Set<UpdateListener>();
  private readonly deletionListeners = new Set<DeletionListener>();
  private readonly cleanupHandle: ReturnType<typeof globalThis.setInterval>;
  private readonly onMaintenance: () => void;
  private closed = false;

  constructor(options: SessionRuntimeOptions = {}) {
    this.now = options.now ?? Date.now;
    this.repository =
      options.repository ?? new InMemorySessionRepository({ now: this.now });
    this.dependencies = {
      catalog: options.catalog ?? CARD_CATALOG,
      random: options.random,
    };
    this.randomFactory = options.randomFactory;
    this.setTimeoutFn = options.setTimeout ?? globalThis.setTimeout;
    this.clearTimeoutFn = options.clearTimeout ?? globalThis.clearTimeout;
    this.clearIntervalFn = options.clearInterval ?? globalThis.clearInterval;
    this.onMaintenance = options.onMaintenance ?? (() => undefined);

    const setIntervalFn = options.setInterval ?? globalThis.setInterval;
    this.cleanupHandle = setIntervalFn(
      () => this.cleanupExpiredSessions(),
      options.cleanupIntervalMs ?? SESSION_CLEANUP_INTERVAL_MS
    );
    this.cleanupHandle.unref?.();
  }

  get serverTime() {
    return this.now();
  }

  onUpdate(listener: UpdateListener) {
    this.updateListeners.add(listener);
    return () => this.updateListeners.delete(listener);
  }

  onDeletion(listener: DeletionListener) {
    this.deletionListeners.add(listener);
    return () => this.deletionListeners.delete(listener);
  }

  project(
    record: SessionRecord,
    actorId: string | null,
    serverTime = this.now()
  ): SessionProjection {
    return projectSession(record.state, {
      participantId: actorId,
      serverTime,
    });
  }

  async connect(record: SessionRecord, actorId: string) {
    return this.repository.enqueue(record, () => {
      if (!this.recordIsLive(record)) return null;
      if (!this.actorCanConnect(record.state, actorId)) {
        this.repository.revokeActor(record, actorId);
        return null;
      }

      const previousState = record.state;
      const transition = connectParticipant(previousState, actorId, this.now());
      this.repository.markConnected(record, actorId);
      const update = this.applyLifecycleTransition(
        record,
        previousState,
        transition,
        true
      );
      this.emitUpdate(update);
      return update;
    });
  }

  async disconnect(record: SessionRecord, actorId: string) {
    return this.repository.enqueue(record, () => {
      if (!this.recordIsLive(record)) return null;

      const previousState = record.state;
      this.repository.markDisconnected(record, actorId);
      const transition = disconnectParticipant(
        previousState,
        actorId,
        this.now()
      );
      const update = this.applyLifecycleTransition(
        record,
        previousState,
        transition,
        true
      );
      this.emitUpdate(update);
      return update;
    });
  }

  async executeCommand(
    record: SessionRecord,
    actorId: string,
    command: SessionCommand
  ): Promise<SessionCommandOutcome | null> {
    return this.repository.enqueue(record, () => {
      if (!this.recordIsLive(record)) return null;

      const previousState = record.state;
      const reconciled = reconcileSessionDeadlines(previousState, this.now());
      if (reconciled.state !== previousState) {
        this.repository.replaceState(record, reconciled.state);
      }

      const cached = this.repository.getCachedCommand(
        record,
        actorId,
        command.id
      );
      if (cached) {
        const update = this.finishUpdate(
          record,
          previousState,
          reconciled.events,
          false
        );
        return { ...update, acknowledgement: cached };
      }

      const transition = reduceSessionCommand(
        record.state,
        { actorId, receivedAt: this.now(), command },
        this.randomFactory
          ? { ...this.dependencies, random: this.randomFactory() }
          : this.dependencies
      );
      const outcome = this.applyCommandTransition(
        record,
        previousState,
        transition.state,
        [...reconciled.events, ...transition.events],
        transition.acknowledgement
      );
      this.repository.cacheCommand(record, actorId, outcome.acknowledgement);

      if (outcome.deletion) {
        this.cancelDeadline(record.state.sessionId);
        this.repository.delete(record.state.sessionId);
      }

      return outcome;
    });
  }

  async rejectRateLimitedCommand(
    record: SessionRecord,
    actorId: string,
    commandId: string
  ): Promise<SessionCommandOutcome | null> {
    return this.repository.enqueue(record, () => {
      if (!this.recordIsLive(record)) return null;

      const previousState = record.state;
      const reconciled = reconcileSessionDeadlines(previousState, this.now());
      if (reconciled.state !== previousState) {
        this.repository.replaceState(record, reconciled.state);
      }

      const cached = this.repository.getCachedCommand(
        record,
        actorId,
        commandId
      );
      const acknowledgement: CommandAcknowledgement = cached ?? {
        type: 'command-ack',
        commandId,
        ok: false,
        revision: record.state.revision,
        error: {
          code: 'RATE_LIMITED',
          message: 'Terlalu banyak aksi. Tunggu sebentar lalu coba lagi.',
        },
      };
      if (!cached) {
        this.repository.cacheCommand(record, actorId, acknowledgement);
      }

      return {
        ...this.finishUpdate(record, previousState, reconciled.events, false),
        acknowledgement,
      };
    });
  }

  publishCommandOutcome(outcome: SessionCommandOutcome) {
    this.emitUpdate(outcome);
    if (outcome.deletion) this.emitDeletion(outcome.deletion);
  }

  stateChanged(
    record: SessionRecord,
    details: {
      events?: ServerEvent[];
      revokedActorIds?: string[];
      forceProjection?: boolean;
    } = {}
  ) {
    if (!this.recordIsLive(record)) return;
    let events = details.events ?? [];
    let state = record.state;
    for (const actorId of record.connectedActorIds) {
      const transition = connectParticipant(state, actorId, this.now());
      state = transition.state;
      if (transition.events.length > 0) {
        events = [...events, ...transition.events];
      }
    }
    if (state !== record.state) this.repository.replaceState(record, state);
    this.scheduleDeadline(record);
    this.emitUpdate({
      record,
      events,
      revokedActorIds: details.revokedActorIds ?? [],
      forceProjection: details.forceProjection ?? true,
    });
  }

  leave(record: SessionRecord, actorId: string, now: number): LeaveResult {
    const previousState = record.state;
    const transition = departParticipant(previousState, actorId, now);
    this.repository.replaceState(record, transition.state);
    this.repository.revokeActor(record, actorId);

    const deleted =
      transition.state.phase === 'ended' ||
      (transition.state.mode === 'own-device' &&
        activeOwnDeviceParticipantCount(transition.state) === 0);

    return {
      deleted,
      events: transition.events,
      revokedActorIds: [actorId],
    };
  }

  sessionDeleted(
    sessionId: string,
    reason: SessionDeletionReason,
    announce = reason === 'ended'
  ) {
    this.cancelDeadline(sessionId);
    this.emitDeletion({ sessionId, reason, announce });
  }

  cleanupExpiredSessions() {
    if (this.closed) return [];
    const deletedSessionIds = this.repository.cleanupExpired();
    for (const sessionId of deletedSessionIds) {
      this.sessionDeleted(sessionId, 'expired', false);
    }
    this.onMaintenance();
    return deletedSessionIds;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.clearIntervalFn(this.cleanupHandle);
    for (const sessionId of this.deadlines.keys()) {
      this.cancelDeadline(sessionId);
    }
    this.updateListeners.clear();
    this.deletionListeners.clear();
  }

  private actorCanConnect(state: SessionState, actorId: string) {
    if (state.mode === 'single-device') return actorId === state.controllerId;
    if (state.phase === 'pending') return actorId === state.controllerId;
    return state.participants[actorId]?.departureStatus === 'active';
  }

  private recordIsLive(record: SessionRecord) {
    return this.repository.get(record.state.sessionId) === record;
  }

  private applyCommandTransition(
    record: SessionRecord,
    previousState: SessionState,
    transitionState: SessionState,
    transitionEvents: ServerEvent[],
    acknowledgement: CommandAcknowledgement
  ): SessionCommandOutcome {
    let state = transitionState;
    const events: ServerEvent[] = [];

    for (const event of transitionEvents) {
      if (event.type === 'code-rotation-requested') {
        if (state.mode === 'own-device') {
          state = replaceJoinCode(state, this.repository.allocateJoinCode());
        }
      } else {
        events.push(event);
      }
    }

    if (state !== record.state) this.repository.replaceState(record, state);
    const adjustedAcknowledgement =
      acknowledgement.revision === state.revision
        ? acknowledgement
        : { ...acknowledgement, revision: state.revision };
    const update = this.finishUpdate(record, previousState, events, false);
    const ended = events.some((event) => event.type === 'session-ended');

    return {
      ...update,
      acknowledgement: adjustedAcknowledgement,
      deletion: ended
        ? {
            sessionId: state.sessionId,
            reason: 'ended',
            announce: false,
          }
        : undefined,
    };
  }

  private applyLifecycleTransition(
    record: SessionRecord,
    previousState: SessionState,
    transition: SessionLifecycleTransition,
    forceProjection: boolean
  ): SessionRuntimeUpdate {
    if (transition.state !== previousState) {
      this.repository.replaceState(record, transition.state);
    }
    return this.finishUpdate(
      record,
      previousState,
      transition.events,
      forceProjection
    );
  }

  private finishUpdate(
    record: SessionRecord,
    previousState: SessionState,
    events: ServerEvent[],
    forceProjection: boolean
  ): SessionRuntimeUpdate {
    const revokedActorIds = actorIdsRevokedByTransition(
      previousState,
      record.state
    );
    for (const actorId of revokedActorIds) {
      this.repository.revokeActor(record, actorId);
    }
    this.scheduleDeadline(record);
    return {
      record,
      events,
      revokedActorIds,
      forceProjection:
        forceProjection || record.state !== previousState || events.length > 0,
    };
  }

  private scheduleDeadline(record: SessionRecord) {
    if (this.closed || !this.recordIsLive(record)) return;
    const sessionId = record.state.sessionId;
    const now = this.now();
    const deadline = getNextSessionDeadline(record.state, now);
    const scheduled = this.deadlines.get(sessionId);

    if (deadline === null) {
      this.cancelDeadline(sessionId);
      return;
    }
    if (scheduled?.at === deadline) return;
    this.cancelDeadline(sessionId);

    const delay = Math.min(MAX_TIMER_DELAY_MS, Math.max(0, deadline - now));
    const handle = this.setTimeoutFn(() => {
      this.deadlines.delete(sessionId);
      void this.reconcileDeadline(record);
    }, delay);
    handle.unref?.();
    this.deadlines.set(sessionId, { at: deadline, handle });
  }

  private async reconcileDeadline(record: SessionRecord) {
    await this.repository.enqueue(record, () => {
      if (!this.recordIsLive(record) || this.closed) return;
      const previousState = record.state;
      const transition = reconcileSessionDeadlines(previousState, this.now());
      const update = this.applyLifecycleTransition(
        record,
        previousState,
        transition,
        true
      );
      this.emitUpdate(update);
    });
  }

  private cancelDeadline(sessionId: string) {
    const scheduled = this.deadlines.get(sessionId);
    if (!scheduled) return;
    this.clearTimeoutFn(scheduled.handle);
    this.deadlines.delete(sessionId);
  }

  private emitUpdate(update: SessionRuntimeUpdate) {
    for (const listener of this.updateListeners) listener(update);
  }

  private emitDeletion(deletion: SessionRuntimeDeletion) {
    for (const listener of this.deletionListeners) listener(deletion);
  }
}
