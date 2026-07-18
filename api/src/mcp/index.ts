/**
 * MCP (Model Context Protocol) server — SSE transport.
 * Spec: https://spec.modelcontextprotocol.io/specification/
 *
 * Flow:
 *   1. Client opens GET /mcp/sse  → receives endpoint URL via SSE
 *   2. Client POSTs JSON-RPC 2.0 to /mcp/messages?sessionId=<uuid>
 *   3. Server sends JSON-RPC response back via that session's SSE stream
 */
import type { FastifyInstance, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { TOOLS, callTool } from './tools.js';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'god-eye', version: '0.6.0' };

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: unknown;
}

// Active SSE sessions: sessionId → reply (SSE stream)
const sessions = new Map<string, FastifyReply>();

function sendSse(reply: FastifyReply, event: string, data: unknown) {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function handleRpc(req: JsonRpcRequest, sessionId: string): Promise<unknown> {
  const session = sessions.get(sessionId);

  const respond = (result: unknown) => {
    const response = req.id != null
      ? { jsonrpc: '2.0', id: req.id, result }
      : null;
    if (response && session) sendSse(session, 'message', response);
    return response;
  };

  const respondError = (code: number, message: string) => {
    const response = req.id != null
      ? { jsonrpc: '2.0', id: req.id, error: { code, message } }
      : null;
    if (response && session) sendSse(session, 'message', response);
    return response;
  };

  switch (req.method) {
    case 'initialize': {
      return respond({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    }

    case 'notifications/initialized':
      // Acknowledgement — no response needed
      return null;

    case 'ping':
      return respond({});

    case 'tools/list':
      return respond({ tools: TOOLS });

    case 'tools/call': {
      const params = req.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};
      if (!toolName) return respondError(-32602, 'Missing tool name');
      try {
        const result = await callTool(toolName, toolArgs);
        return respond(result);
      } catch (e) {
        return respondError(-32603, `Tool execution failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    default:
      return respondError(-32601, `Method not found: ${req.method}`);
  }
}

export async function registerMcpRoutes(app: FastifyInstance) {
  // SSE endpoint — client opens this to get the message URL
  app.get('/mcp/sse', async (req, reply) => {
    const sessionId = randomUUID();
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders();

    sessions.set(sessionId, reply);
    req.log.info(`[MCP] session opened: ${sessionId}`);

    // Send endpoint event (tells client where to POST messages)
    const host = req.headers['host'] ?? 'localhost:3001';
    const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'http';
    const endpoint = `${proto}://${host}/mcp/messages?sessionId=${sessionId}`;
    reply.raw.write(`event: endpoint\ndata: ${JSON.stringify(endpoint)}\n\n`);

    // Heartbeat every 15s to keep connection alive
    const heartbeat = setInterval(() => {
      if (sessions.has(sessionId)) {
        reply.raw.write(': heartbeat\n\n');
      } else {
        clearInterval(heartbeat);
      }
    }, 15_000);

    reply.raw.on('close', () => {
      sessions.delete(sessionId);
      clearInterval(heartbeat);
      req.log.info(`[MCP] session closed: ${sessionId}`);
    });

    // Keep the request open
    await new Promise<void>((resolve) => {
      reply.raw.on('close', resolve);
    });
  });

  // Message endpoint — client POSTs JSON-RPC here
  app.post<{ Querystring: { sessionId?: string } }>(
    '/mcp/messages',
    { config: { rawBody: true } },
    async (req, reply) => {
      const sessionId = req.query['sessionId'];
      if (!sessionId || !sessions.has(sessionId)) {
        reply.code(404).send({ error: 'Unknown session' });
        return;
      }

      let rpcReq: JsonRpcRequest;
      try {
        rpcReq = req.body as JsonRpcRequest;
      } catch {
        reply.code(400).send({ error: 'Invalid JSON' });
        return;
      }

      // Handle batched requests
      if (Array.isArray(rpcReq)) {
        for (const r of rpcReq) {
          await handleRpc(r as JsonRpcRequest, sessionId);
        }
        reply.code(202).send();
        return;
      }

      await handleRpc(rpcReq, sessionId);
      reply.code(202).send();
    }
  );

  // Simple health/info endpoint for discovery
  app.get('/mcp', async () => ({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    protocol: PROTOCOL_VERSION,
    sse: '/mcp/sse',
    tools: TOOLS.map(t => t.name),
  }));
}
