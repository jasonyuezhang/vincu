import { defaultWebSocketFactory } from "@getvincu/client/internal/daemon-client-websocket-transport";
import type { WebSocketFactory } from "@getvincu/client/internal/daemon-client-transport-types";

export function createAppWebSocketFactory(): WebSocketFactory {
  return defaultWebSocketFactory;
}
