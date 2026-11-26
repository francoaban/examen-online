const SECRET_ENV_NAME =
  /(?:secret|token|password|credential|private[_-]?key|database_url)/i;

function redactSensitiveValues(value: string): string {
  let redacted = value;

  for (const [name, secret] of Object.entries(process.env)) {
    if (!SECRET_ENV_NAME.test(name) || !secret || secret.length < 4) continue;
    redacted = redacted.split(secret).join("[REDACTED]");
  }

  return redacted
    .replace(/\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(
      /\b(password|secret|token|authorization)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1=[REDACTED]",
    );
}

export function logError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const record = {
    level: "error",
    context,
    error: redactSensitiveValues(message),
    name: error instanceof Error ? redactSensitiveValues(error.name) : typeof error,
    stack:
      error instanceof Error && error.stack
        ? redactSensitiveValues(error.stack)
        : undefined,
    ts: new Date().toISOString(),
  };

  console.error(JSON.stringify(record));
}
