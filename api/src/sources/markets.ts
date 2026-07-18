/**
 * Markets data: global indices, crypto, commodities, Fear & Greed.
 * Sources: Yahoo Finance v7 (no key), CoinGecko (no key), alternative.me F&G.
 */
import type { BaseEntity } from '@god-eye/shared';

export const MARKETS_KEY = 'markets';
export const MARKETS_TTL = 5 * 60 * 1_000; // 5 minutes
export const MARKETS_SOURCE = 'yahoo-finance,coingecko,alternative.me';
const TTL = MARKETS_TTL;

// Tickers: major indices + commodities
const YF_SYMBOLS = [
  '^GSPC',  // S&P 500
  '^IXIC',  // NASDAQ
  '^DJI',   // Dow Jones
  '^FTSE',  // FTSE 100
  '^N225',  // Nikkei 225
  '^DAX',   // DAX
  '^HSI',   // Hang Seng
  'GC=F',   // Gold futures
  'CL=F',   // Crude oil futures
  'DX-Y.NYB', // US Dollar index
];

// CoinGecko IDs
const CRYPTO_IDS = 'bitcoin,ethereum,solana,ripple,cardano';

interface MarketData {
  type: 'index' | 'commodity' | 'crypto' | 'fear-greed';
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;   // absolute
  changePct: number | null; // percentage
  currency: string;
  updatedAt: number;
}

async function fetchIndices(): Promise<MarketData[]> {
  const symbols = YF_SYMBOLS.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; GOD-EYE/0.5)',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}`);
  const json = await res.json() as {
    quoteResponse?: { result?: Array<{
      symbol: string;
      shortName?: string;
      longName?: string;
      regularMarketPrice?: number;
      regularMarketChange?: number;
      regularMarketChangePercent?: number;
      currency?: string;
      quoteType?: string;
    }> }
  };

  return (json.quoteResponse?.result ?? []).map((q) => {
    const type: MarketData['type'] =
      q.quoteType === 'CRYPTOCURRENCY' ? 'crypto'
      : q.symbol.endsWith('=F') ? 'commodity'
      : 'index';
    return {
      type,
      symbol: q.symbol,
      name: q.shortName ?? q.longName ?? q.symbol,
      price: q.regularMarketPrice ?? null,
      change: q.regularMarketChange ?? null,
      changePct: q.regularMarketChangePercent ?? null,
      currency: q.currency ?? 'USD',
      updatedAt: Date.now(),
    };
  });
}

async function fetchCrypto(): Promise<MarketData[]> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${CRYPTO_IDS}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GOD-EYE/0.5', 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const json = await res.json() as Record<string, { usd?: number; usd_24h_change?: number }>;

  const NAME_MAP: Record<string, string> = {
    bitcoin: 'Bitcoin', ethereum: 'Ethereum', solana: 'Solana',
    ripple: 'XRP', cardano: 'Cardano',
  };

  return Object.entries(json).map(([id, data]) => ({
    type: 'crypto' as const,
    symbol: id.toUpperCase(),
    name: NAME_MAP[id] ?? id,
    price: data.usd ?? null,
    change: null,
    changePct: data.usd_24h_change ?? null,
    currency: 'USD',
    updatedAt: Date.now(),
  }));
}

async function fetchFearGreed(): Promise<MarketData | null> {
  const res = await fetch('https://api.alternative.me/fng/?limit=1', {
    headers: { 'User-Agent': 'GOD-EYE/0.5', 'Accept': 'application/json' },
  });
  if (!res.ok) return null;
  const json = await res.json() as { data?: Array<{ value?: string; value_classification?: string }> };
  const entry = json.data?.[0];
  if (!entry) return null;
  return {
    type: 'fear-greed',
    symbol: 'FNG',
    name: `Fear & Greed: ${entry.value_classification ?? '—'}`,
    price: entry.value ? parseInt(entry.value, 10) : null,
    change: null,
    changePct: null,
    currency: 'index',
    updatedAt: Date.now(),
  };
}

export interface MarketsSnapshot {
  indices: MarketData[];
  crypto: MarketData[];
  fearGreed: MarketData | null;
}

export async function fetchMarkets(): Promise<MarketsSnapshot> {
  const [indicesResult, cryptoResult, fng] = await Promise.allSettled([
    fetchIndices(),
    fetchCrypto(),
    fetchFearGreed(),
  ]);

  return {
    indices: indicesResult.status === 'fulfilled' ? indicesResult.value : [],
    crypto: cryptoResult.status === 'fulfilled' ? cryptoResult.value : [],
    fearGreed: fng.status === 'fulfilled' ? fng.value : null,
  };
}

/** Convert markets snapshot to BaseEntity array for layer rendering (no map points — display only). */
export function marketsToEntities(_snapshot: MarketsSnapshot): BaseEntity[] {
  return [];
}
