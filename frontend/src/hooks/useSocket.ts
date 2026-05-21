import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

let globalSocket: Socket | null = null;

export function useSocket(
  event: string,
  handler: (data: any) => void
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!globalSocket) {
      globalSocket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
      });
    }

    const cb = (data: any) => handlerRef.current(data);
    globalSocket.on(event, cb);

    return () => {
      globalSocket?.off(event, cb);
    };
  }, [event]);
}
