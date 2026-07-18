import type { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import type { WebSocket } from 'ws';

const clients = new Set<WebSocket>();

export async function registerWsRelay(app: FastifyInstance) {
  await app.register(websocket);

  app.get('/ws', { websocket: true }, (socket) => {
    clients.add(socket);
    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
    // Send heartbeat
    socket.send(JSON.stringify({ type: 'connected', ts: Date.now() }));
  });
}

/** Broadcast a layer update to all connected clients */
export function broadcast(layer: string, data: unknown) {
  const msg = JSON.stringify({ type: 'layer:data', layer, data, ts: Date.now() });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

/** Broadcast an agent command to all connected browsers */
export function broadcastCommand(command: string, params: Record<string, unknown>) {
  const msg = JSON.stringify({ type: 'agent:command', command, params, ts: Date.now() });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

/** Count of currently connected WS clients */
export function clientCount(): number {
  return clients.size;
}
