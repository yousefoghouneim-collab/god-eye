/**
 * Agent Bus — HTTP command endpoint + SSE event stream.
 * Lets external scripts/agents drive the live browser session directly.
 *
 * Security: requests to POST /api/agent/command must include
 *   X-Agent-Signature: sha256=<hex-hmac-sha256 of raw body, keyed with AGENT_SECRET>
 * If AGENT_SECRET is not set, the bus is disabled (returns 503).
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import { broadcastCommand } from '../relay/ws.js';

const AGENT_SECRET = process.env['AGENT_SECRET'] ?? '';

// SSE subscribers for agent event stream
const eventSubscribers = new Set<FastifyReply>();

function agentEnabled() {
  return AGENT_SECRET.length > 0;
}

function verifyHmac(body: string, signature: string): boolean {
  if (!AGENT_SECRET) return false;
  const expected = `sha256=${createHmac('sha256', AGENT_SECRET).update(body).digest('hex')}`;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function emitAgentEvent(event: string, data: unknown) {
  const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const sub of eventSubscribers) {
    sub.raw.write(line);
  }
}

// Valid agent commands mirroring MCP tools
const VALID_COMMANDS = new Set([
  'fly_to', 'set_layer', 'place_pin', 'clear_pins', 'get_dossier',
]);

export async function registerAgentRoutes(app: FastifyInstance) {
  // POST /api/agent/command — fire a command at the browser
  app.post<{ Body: { command: string; params?: Record<string, unknown> } }>(
    '/api/agent/command',
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!agentEnabled()) {
        reply.code(503).send({ error: 'Agent bus disabled. Set AGENT_SECRET to enable.' });
        return;
      }

      const rawBody = JSON.stringify(req.body);
      const sig = (req.headers['x-agent-signature'] as string | undefined) ?? '';
      if (!verifyHmac(rawBody, sig)) {
        reply.code(401).send({ error: 'Invalid signature' });
        return;
      }

      const body = req.body as { command?: string; params?: Record<string, unknown> };
      const { command, params = {} } = body;
      if (!command || !VALID_COMMANDS.has(command)) {
        reply.code(400).send({
          error: `Unknown command. Valid: ${[...VALID_COMMANDS].join(', ')}`,
        });
        return;
      }

      broadcastCommand(command, params);
      emitAgentEvent('command_dispatched', { command, params, ts: Date.now() });
      return { ok: true, command, params };
    }
  );

  // GET /api/agent/events — SSE stream of agent activity (read-only observers)
  app.get('/api/agent/events', async (req, reply) => {
    if (!agentEnabled()) {
      reply.code(503).send({ error: 'Agent bus disabled.' });
      return;
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders();

    eventSubscribers.add(reply);
    reply.raw.write(`event: connected\ndata: {"ts":${Date.now()}}\n\n`);

    const heartbeat = setInterval(() => {
      reply.raw.write(': ping\n\n');
    }, 15_000);

    reply.raw.on('close', () => {
      eventSubscribers.delete(reply);
      clearInterval(heartbeat);
    });

    await new Promise<void>((resolve) => {
      reply.raw.on('close', resolve);
    });
  });

  // GET /api/agent/status — basic info about the bus
  app.get('/api/agent/status', async () => ({
    enabled: agentEnabled(),
    subscribers: eventSubscribers.size,
    validCommands: [...VALID_COMMANDS],
  }));

  // Convenience: list watch areas (managed by watch-officer)
  app.get('/api/agent/watches', async () => {
    const { listWatches } = await import('../agent/watches.js');
    return { watches: listWatches() };
  });

  app.post<{ Body: { lat1: number; lng1: number; lat2: number; lng2: number; label: string } }>(
    '/api/agent/watches',
    async (req, reply) => {
      if (!agentEnabled()) {
        reply.code(503).send({ error: 'Agent bus disabled.' });
        return;
      }
      const rawBody = JSON.stringify(req.body);
      const sig = (req.headers['x-agent-signature'] as string | undefined) ?? '';
      if (!verifyHmac(rawBody, sig)) {
        reply.code(401).send({ error: 'Invalid signature' });
        return;
      }
      const { addWatch } = await import('../agent/watches.js');
      const body = req.body as { lat1?: number; lng1?: number; lat2?: number; lng2?: number; label?: string };
      const { lat1, lng1, lat2, lng2, label } = body;
      if (lat1 == null || lng1 == null || lat2 == null || lng2 == null || !label) {
        reply.code(400).send({ error: 'lat1, lng1, lat2, lng2, label required' });
        return;
      }
      const watch = addWatch({ lat1, lng1, lat2, lng2, label });
      return { ok: true, watch };
    }
  );

  app.delete<{ Params: { id: string } }>('/api/agent/watches/:id', async (req, reply) => {
    if (!agentEnabled()) { reply.code(503).send({ error: 'Agent bus disabled.' }); return; }
    const { removeWatch } = await import('../agent/watches.js');
    removeWatch(req.params['id']);
    return { ok: true };
  });
}
