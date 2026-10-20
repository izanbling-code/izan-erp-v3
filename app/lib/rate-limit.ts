// app/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.UPSTASH_URL ||
  process.env.KV_REST_API_URL;
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.UPSTASH_TOKEN ||
  process.env.KV_REST_API_TOKEN;

if (!redisUrl || !redisToken) {
  throw new Error(
    "Login rate limiting requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or their configured aliases)."
  );
}

// Create a new ratelimiter, that allows 5 requests per 1 minute
export const authRateLimit = new Ratelimit({
  redis: new Redis({ url: redisUrl, token: redisToken }),
  limiter: Ratelimit.slidingWindow(5, "1 m"), // 5 attempts per minute[reference:2][reference:3]
  analytics: true,
  prefix: "@upstash/ratelimit/auth",
});