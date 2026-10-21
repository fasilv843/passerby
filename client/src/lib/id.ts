/** Unique id for chat entries. crypto.randomUUID() needs a secure context, which plain-HTTP LAN testing lacks. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto && globalThis.isSecureContext) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
