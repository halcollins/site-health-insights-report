// Result caching utilities

// Result caching store (in production, use Redis or database)
const resultCache = new Map<string, { result: any; timestamp: number }>();
export const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

export function getCachedResult(cacheKey: string): any | null {
  const cachedResult = resultCache.get(cacheKey);
  if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_DURATION) {
    console.log(`✅ Returning cached result for ${cacheKey}`);
    return cachedResult.result;
  }
  return null;
}

export function setCachedResult(cacheKey: string, result: any): void {
  resultCache.set(cacheKey, { result, timestamp: Date.now() });
  console.log(`💾 Cached result for ${cacheKey}`);
}