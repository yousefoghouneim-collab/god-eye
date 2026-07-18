import Fastify from 'fastify';
import cors from '@fastify/cors';
import 'dotenv/config';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get('/api/health', async () => ({
  status: 'ok',
  service: 'god-eye-api',
  timestamp: new Date().toISOString(),
}));

const port = parseInt(process.env.PORT ?? '3001', 10);

try {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`[GOD-EYE API] listening on :${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
