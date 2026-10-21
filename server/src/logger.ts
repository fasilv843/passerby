/**
 * Minimal logger so every server log line has the same shape:
 *   2026-10-21T06:12:00.000Z INFO  [matching] message {...}
 * Swap for pino or similar if logs need to be shipped somewhere.
 */
type Level = "info" | "warn" | "error";

function write(level: Level, scope: string, message: string, details?: unknown) {
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`;
  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (details === undefined) out(line);
  else out(line, details);
}

export function createLogger(scope: string) {
  return {
    info: (message: string, details?: unknown) => write("info", scope, message, details),
    warn: (message: string, details?: unknown) => write("warn", scope, message, details),
    error: (message: string, details?: unknown) => write("error", scope, message, details),
  };
}
