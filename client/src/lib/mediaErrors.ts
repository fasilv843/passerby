/** Turns a getUserMedia() error into a message for the lobby. */
export function describeMediaError(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  const hint = "You can still use text-only chat.";
  switch (name) {
    case "NotAllowedError":
      return `Camera and microphone permission required. ${hint}`;
    case "NotFoundError":
      return `Camera or microphone not found. ${hint}`;
    case "NotReadableError":
      return `Camera or microphone is in use by another app. ${hint}`;
    default:
      return `Unable to access camera/microphone. ${hint}`;
  }
}
