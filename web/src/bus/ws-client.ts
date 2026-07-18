import { DataBus } from './data-bus.js';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function getWsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket(getWsUrl());

  ws.onopen = () => {
    console.log('[WS] connected');
    DataBus.emit('freshness:update', { ws: 'connected' });
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string) as { type: string; layer?: string; data?: unknown; command?: string; params?: Record<string, unknown> };
      if (msg.type === 'layer:data' && msg.layer) {
        DataBus.emit('layer:data', { layer: msg.layer, data: msg.data });
      } else if (msg.type === 'agent:command' && msg.command) {
        DataBus.emit('agent:command', { command: msg.command, params: msg.params ?? {} });
      }
    } catch {
      // ignore bad frames
    }
  };

  ws.onclose = () => {
    console.log('[WS] disconnected, reconnecting in 3s');
    DataBus.emit('freshness:update', { ws: 'disconnected' });
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3000);
}

export function initWsClient() {
  connect();
}
