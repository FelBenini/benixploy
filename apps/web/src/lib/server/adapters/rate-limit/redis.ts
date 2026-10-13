import type { Redis } from "ioredis";
import type { RateLimiter, RateLimitResult } from "../../ports/rate-limiter";

// Sliding-window limit: a sorted set of hit timestamps, trimmed on every
// read. The key expires by itself, so no sweep job is needed. A per-key
// counter keeps members unique when two hits land in the same millisecond.
const SCRIPT = `
local hitsKey = KEYS[1]
local seqKey = KEYS[2]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local minScore = now - windowMs

redis.call('ZREMRANGEBYSCORE', hitsKey, '-inf', minScore)
local count = redis.call('ZCARD', hitsKey)
if count >= limit then
  local oldest = redis.call('ZRANGE', hitsKey, 0, 0, 'WITHSCORES')
  local retryAfterMs = 0
  if oldest[2] then
    retryAfterMs = oldest[2] + windowMs - now
  end
  return { 0, retryAfterMs }
end

local seq = redis.call('INCR', seqKey)
redis.call('ZADD', hitsKey, now, now .. ':' .. seq)
local ttl = math.ceil(windowMs / 1000)
redis.call('EXPIRE', hitsKey, ttl)
redis.call('EXPIRE', seqKey, ttl)
return { 1, 0 }
`;

const SCRIPT_NUM_KEYS = 2;

export class RedisRateLimiter implements RateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly prefix: string,
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  private hitsKey(key: string): string {
    return `rl:${this.prefix}:${key}:hits`;
  }

  private seqKey(key: string): string {
    return `rl:${this.prefix}:${key}:seq`;
  }

  async consume(key: string): Promise<RateLimitResult> {
    const [allowed, retryAfterMs] = (await this.redis.eval(
      SCRIPT,
      SCRIPT_NUM_KEYS,
      this.hitsKey(key),
      this.seqKey(key),
      Date.now(),
      this.windowMs,
      this.limit,
    )) as [number, number];
    return { allowed: allowed === 1, retryAfterMs };
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(this.hitsKey(key), this.seqKey(key));
  }
}
