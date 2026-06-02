type Entry = {
  count: number;
  resetAt: number;
};

export class RunCreateRateLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  check(key: string, now = Date.now()): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
    const current = this.entries.get(key);
    if (!current || current.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true };
    }

    if (current.count >= this.maxRequests) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
      };
    }

    current.count += 1;
    this.entries.set(key, current);
    return { allowed: true };
  }
}
