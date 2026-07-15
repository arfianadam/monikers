'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { serverMessageSchema } from '@/features/game/session-protocol/schemas';
import type {
  ServerEvent,
  SessionCommand,
  SessionProjection,
} from '@/features/game/session-protocol/types';

import { createCommandId } from '../command-id';

export type SessionConnectionStatus =
  'connecting' | 'connected' | 'disconnected';
export type SessionRecoveryReason =
  'duplicate' | 'revoked' | 'expired' | 'ended';

type WithoutCommandMetadata<T> = T extends unknown
  ? Omit<T, 'id' | 'expectedRevision'>
  : never;
export type SessionCommandInput = WithoutCommandMetadata<SessionCommand>;

const RETRY_DELAYS_MS = [500, 1_000, 2_000, 5_000, 10_000] as const;

function recoveryReasonForCloseCode(
  code: number
): SessionRecoveryReason | null {
  if (code === 4009) return 'duplicate';
  if (code === 4001 || code === 4003) return 'revoked';
  if (code === 4004) return 'expired';
  if (code === 4010) return 'ended';
  return null;
}

export interface UseSessionSocketOptions {
  sessionId: string;
  onEvent?: (event: ServerEvent) => void;
}

export function useSessionSocket({
  sessionId,
  onEvent,
}: UseSessionSocketOptions) {
  const [projection, setProjection] = useState<SessionProjection | null>(null);
  const [status, setStatus] = useState<SessionConnectionStatus>('connecting');
  const [recoveryReason, setRecoveryReason] =
    useState<SessionRecoveryReason | null>(null);
  const [lastError, setLastError] = useState('');
  const [pendingCommandCount, setPendingCommandCount] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingCommands = useRef(new Map<string, SessionCommandInput>());
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let disposed = false;
    let retryTimer: number | null = null;
    let retryAttempt = 0;

    const openSocket = () => {
      if (disposed) return;
      setStatus('connecting');
      setLastError('');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(
        `${protocol}//${window.location.host}/session/${encodeURIComponent(sessionId)}/live`
      );
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        if (disposed || socketRef.current !== socket) return;
        retryAttempt = 0;
        setStatus('connected');
        setRecoveryReason(null);
      });

      socket.addEventListener('message', (message) => {
        if (disposed || typeof message.data !== 'string') return;

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(message.data) as unknown;
        } catch {
          setLastError('Oops, pesan dari server nggak bisa dibaca.');
          return;
        }

        const parsed = serverMessageSchema.safeParse(parsedJson);
        if (!parsed.success) {
          setLastError('Oops, ada pesan server yang nggak dikenali.');
          return;
        }

        const serverMessage = parsed.data;
        if (serverMessage.type === 'projection') {
          setProjection((current) => {
            if (current && serverMessage.projection.version < current.version) {
              return current;
            }
            return serverMessage.projection;
          });
          return;
        }

        if (serverMessage.type === 'command-ack') {
          pendingCommands.current.delete(serverMessage.commandId);
          setPendingCommandCount(pendingCommands.current.size);
          if (!serverMessage.ok) setLastError(serverMessage.error.message);
          return;
        }

        onEventRef.current?.(serverMessage.event);
      });

      socket.addEventListener('close', (event) => {
        if (disposed || socketRef.current !== socket) return;
        socketRef.current = null;
        pendingCommands.current.clear();
        setPendingCommandCount(0);

        const terminalReason = recoveryReasonForCloseCode(event.code);
        if (terminalReason) {
          setRecoveryReason(terminalReason);
          setStatus('disconnected');
          return;
        }

        setStatus('disconnected');
        setLastError('Koneksi putus. Lagi coba reconnect…');
        const delay =
          RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
        retryAttempt += 1;
        retryTimer = window.setTimeout(openSocket, delay);
      });

      socket.addEventListener('error', () => {
        if (socketRef.current === socket) {
          setLastError('Belum bisa tersambung ke sesi.');
        }
      });
    };

    openSocket();

    return () => {
      disposed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (socketRef.current) {
        socketRef.current.close(1000, 'Client view changed');
        socketRef.current = null;
      }
    };
  }, [retryKey, sessionId]);

  const sendCommand = useCallback((input: SessionCommandInput) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setLastError('Tunggu sampai koneksinya balik, ya.');
      return null;
    }

    const commandId = createCommandId();
    const command = {
      ...input,
      id: commandId,
    } as SessionCommand;
    pendingCommands.current.set(commandId, input);
    setPendingCommandCount(pendingCommands.current.size);
    socket.send(JSON.stringify(command));
    return commandId;
  }, []);

  const retry = useCallback(() => {
    setRecoveryReason(null);
    setRetryKey((key) => key + 1);
  }, []);

  const clearError = useCallback(() => setLastError(''), []);
  const hasPendingCommand = useCallback(
    (type: SessionCommand['type']) =>
      [...pendingCommands.current.values()].some(
        (command) => command.type === type
      ),
    []
  );
  const pendingCardWords = [...pendingCommands.current.values()].flatMap(
    (command) => (command.type === 'toggle-card' ? [command.cardWord] : [])
  );
  const pendingLobbyPlayerIds = [...pendingCommands.current.values()].flatMap(
    (command) =>
      command.type === 'move-player' ||
      command.type === 'reorder-player' ||
      command.type === 'remove-player'
        ? [command.playerId]
        : []
  );

  return {
    projection,
    status,
    recoveryReason,
    lastError,
    pendingCommandCount,
    hasPendingCommand,
    pendingCardWords,
    pendingLobbyPlayerIds,
    sendCommand,
    retry,
    clearError,
  };
}
