/**
 * Country News Route — /api/news?country=<name>
 * Fetches Google News RSS server-side, parses headlines, caches 15 min.
 */
import type { FastifyInstance } from 'fastify';
import { cachedFetch } from '../cache/redis.js';

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  snippet: string;
}

function extractCdata(tag: string, xml: string): string {
  const m = xml.match(new RegExp(`<${tag}(?:[^>]*)>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's'));
  return m ? m[1].trim() : '';
}

function extractAttr(attr: string, xml: string): string {
  const m = xml.match(new RegExp(`${attr}="([^"]*)"`, 's'));
  return m ? m[1].trim() : '';
}

function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemMatches = xml.matchAll(/<item>(.*?)<\/item>/gs);
  for (const match of itemMatches) {
    const block = match[1];
    const title = extractCdata('title', block).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const link = extractCdata('link', block) || extractAttr('url', block.match(/<link>(.*?)<\/link>/s)?.[0] ?? '');
    const source = extractCdata('source', block);
    const pubDate = extractCdata('pubDate', block);
    const snippet = extractCdata('description', block)
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .slice(0, 200);

    if (title && link) {
      items.push({ title, link, source, pubDate, snippet });
    }
    if (items.length >= 10) break;
  }
  return items;
}

async function fetchCountryNews(country: string): Promise<NewsItem[]> {
  const q = encodeURIComponent(country);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GOD-EYE/0.2 (private research; RSS reader)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Google News RSS ${res.status}`);
  const xml = await res.text();
  return parseRss(xml);
}

export async function registerNewsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { country?: string } }>('/api/news', async (req, reply) => {
    const country = (req.query.country ?? '').trim().slice(0, 100);
    if (!country) {
      return reply.code(400).send({ error: 'country parameter required' });
    }

    try {
      const cacheKey = `news:${country.toLowerCase()}`;
      const cached = await cachedFetch<NewsItem[]>(
        cacheKey,
        15 * 60 * 1000, // 15 min
        'Google News RSS',
        () => fetchCountryNews(country),
      );
      return { ok: true, country, items: cached.data, fetchedAt: cached.fetchedAt };
    } catch (err) {
      app.log.warn(`[news] fetch failed for "${country}": ${(err as Error).message}`);
      return reply.code(502).send({ ok: false, error: 'news fetch failed', items: [] });
    }
  });
}
