import { Request, Response, NextFunction } from "express";

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

// Clean old buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, 300_000);

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  // Higher limit for ingest endpoints (reporters do bulk sync)
  const isIngest = req.path.startsWith("/api/ingest");
  const maxRequests = isIngest ? 600 : 120;

  const key = `rate:${ip}`;
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count++;

  if (bucket.count > maxRequests) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.status(429).json({
      error: "Too many requests",
      retry_after: retryAfter,
    });
    return;
  }

  res.setHeader("X-RateLimit-Limit", maxRequests);
  res.setHeader("X-RateLimit-Remaining", maxRequests - bucket.count);
  res.setHeader("X-RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));

  next();
}
