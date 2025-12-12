import { useEffect, useRef, useCallback, useState } from "react";

interface WebSocketMessage {
  type: "start" | "chunk" | "complete" | "error" | "pong";
  content?: string;
  message?: string;
  sources?: string[];
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export const useWebSocket = (
  url: string | null,
  options: UseWebSocketOptions = {}
) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isManualDisconnectRef = useRef(false);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");

  // Store callbacks in refs to avoid dependency issues
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      window.clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: "ping" }));
          console.log("[WebSocket] Sent ping");
        } catch (error) {
          console.error("[WebSocket] Error sending ping:", error);
        }
      }
    }, 30000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      window.clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (isManualDisconnectRef.current) {
      console.log("[WebSocket] Manual disconnect, not reconnecting");
      return;
    }

    if (reconnectAttemptsRef.current >= 10) {
      console.log("[WebSocket] Max reconnection attempts reached");
      setConnectionState("error");
      return;
    }

    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(
      1000 * Math.pow(2, reconnectAttemptsRef.current),
      30000
    );
    console.log(
      `[WebSocket] Scheduling reconnect attempt ${
        reconnectAttemptsRef.current + 1
      }/10 in ${delay}ms`
    );

    reconnectTimeoutRef.current = window.setTimeout(() => {
      reconnectAttemptsRef.current++;
      connect();
    }, delay);
  }, []);

  const connect = useCallback(() => {
    if (
      !url ||
      wsRef.current?.readyState === WebSocket.CONNECTING ||
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    console.log(
      `[WebSocket] Connecting to: ${url} (attempt ${
        reconnectAttemptsRef.current + 1
      })`
    );
    setConnectionState("connecting");

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log("[WebSocket] Connected successfully");
        setConnectionState("connected");
        reconnectAttemptsRef.current = 0;
        startHeartbeat();
        callbacksRef.current.onConnect?.();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log("[WebSocket] Received message:", message);

          if (message.type === "pong") {
            console.log("[WebSocket] Received pong");
            return;
          }

          callbacksRef.current.onMessage?.(message);
        } catch (error) {
          console.error("[WebSocket] Error parsing message:", error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log(
          `[WebSocket] Disconnected - Code: ${event.code}, Reason: ${event.reason}`
        );

        wsRef.current = null;
        setConnectionState("disconnected");
        stopHeartbeat();
        callbacksRef.current.onDisconnect?.();

        if (!isManualDisconnectRef.current) {
          if (event.code !== 1000 && event.code !== 1001) {
            console.log(
              "[WebSocket] Abnormal closure, attempting to reconnect..."
            );
            scheduleReconnect();
          } else {
            console.log("[WebSocket] Normal closure, not reconnecting");
          }
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("[WebSocket] Connection error:", error);
        setConnectionState("error");
        callbacksRef.current.onError?.(error);
      };
    } catch (error) {
      console.error("[WebSocket] Error creating WebSocket:", error);
      setConnectionState("error");
      scheduleReconnect();
    }
  }, [url, startHeartbeat, stopHeartbeat, scheduleReconnect]);

  const disconnect = useCallback(() => {
    console.log("[WebSocket] Manual disconnect requested");
    isManualDisconnectRef.current = true;

    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }

    setConnectionState("disconnected");
    reconnectAttemptsRef.current = 0;
  }, [stopHeartbeat]);

  const sendMessage = useCallback(
    (message: any) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          const messageStr = JSON.stringify(message);
          console.log("[WebSocket] Sending message");
          wsRef.current.send(messageStr);
          return true;
        } catch (error) {
          console.error("[WebSocket] Error sending message:", error);
          return false;
        }
      }

      console.warn(
        `[WebSocket] Cannot send message - Connection state: ${connectionState}`
      );
      return false;
    },
    [connectionState]
  );

  const forceReconnect = useCallback(() => {
    console.log("[WebSocket] Force reconnect requested");
    isManualDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;

    disconnect();

    setTimeout(() => {
      isManualDisconnectRef.current = false;
      connect();
    }, 1000);
  }, [disconnect, connect]);

  // Only depend on URL changes, not callback changes
  useEffect(() => {
    if (url) {
      isManualDisconnectRef.current = false;
      connect();
    }

    return () => {
      isManualDisconnectRef.current = true;
      disconnect();
    };
  }, [url]); // Only URL dependency!

  const isConnected = wsRef.current?.readyState === WebSocket.OPEN;

  return {
    sendMessage,
    connect,
    disconnect,
    forceReconnect,
    isConnected,
    connectionState,
  };
};
