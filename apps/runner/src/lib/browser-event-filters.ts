export function isIgnorableConsoleError(message: string): boolean {
  return message.trim().startsWith("Failed to load resource: net::ERR_BLOCKED_BY_CLIENT");
}

export function blockedRequestPayload(input: {
  url: string;
  method?: string;
  resourceType?: string;
}): Record<string, unknown> {
  return {
    url: input.url,
    status: 0,
    reason: "blocked_by_scope",
    ...(input.method ? { method: input.method } : {}),
    ...(input.resourceType ? { resourceType: input.resourceType } : {})
  };
}
