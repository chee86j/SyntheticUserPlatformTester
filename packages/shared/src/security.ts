const REDACTED = "[redacted]";
const SENSITIVE_KEY_PARTS = [
  "password",
  "passwd",
  "token",
  "cookie",
  "authorization",
  "secret",
  "apikey",
  "api_key",
  "api-key",
  "session"
];

export function redactSensitiveText(value: string): string {
  return value
    .replace(/(bearer\s+)[a-z0-9._-]+/gi, `$1${REDACTED}`)
    .replace(/((?:token|password|passwd|cookie|secret|authorization|api[_-]?key|session)\s*[:=]\s*)([^,\s]+)/gi, `$1${REDACTED}`)
    .replace(/\b(?:sk|ak)-[a-z0-9_-]{8,}\b/gi, REDACTED);
}

export function redactSensitiveValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item));
  }

  if (value && typeof value === "object") {
    return redactSensitiveRecord(value as Record<string, unknown>);
  }

  return value;
}

export function redactSensitiveRecord<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (isSensitiveKey(key)) {
        return [key, REDACTED];
      }

      return [key, redactSensitiveValue(value)];
    })
  ) as T;
}

export function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function redactEventPayload(payload: Record<string, unknown>, maxStringLength = 500): Record<string, unknown> {
  const redacted = redactSensitiveRecord(payload);
  return trimNestedStrings(redacted, maxStringLength) as Record<string, unknown>;
}

export function isAllowedUrl(input: { url: string; allowedDomains: string[]; baseUrl?: string }): boolean {
  const rawAllowed = new Set(normalizeAllowedDomains(input.allowedDomains));

  if (input.baseUrl) {
    try {
      rawAllowed.add(new URL(input.baseUrl).hostname.toLowerCase());
    } catch {
      // ignore invalid base URL here; config validation happens elsewhere
    }
  }

  if (rawAllowed.size === 0) {
    return false;
  }

  try {
    const candidate = new URL(input.url);
    if (candidate.protocol === "about:" || candidate.protocol === "data:" || candidate.protocol === "blob:") {
      return true;
    }

    if (candidate.protocol !== "http:" && candidate.protocol !== "https:") {
      return false;
    }

    const hostname = candidate.hostname.toLowerCase();
    return [...rawAllowed].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function normalizeAllowedDomains(domains: string[]): string[] {
  return Array.from(
    new Set(
      domains
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean)
        .map((domain) => {
          try {
            return new URL(domain.startsWith("http://") || domain.startsWith("https://") ? domain : `https://${domain}`)
              .hostname
              .toLowerCase();
          } catch {
            return domain;
          }
        })
    )
  );
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part.replace(/[^a-z0-9]/gi, "")));
}

function trimNestedStrings(value: unknown, maxLength: number): unknown {
  if (typeof value === "string") {
    return trimText(value, maxLength);
  }

  if (Array.isArray(value)) {
    return value.map((item) => trimNestedStrings(item, maxLength));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, trimNestedStrings(nested, maxLength)])
    );
  }

  return value;
}
