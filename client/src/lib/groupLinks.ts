/** The shareable link for a group room. */
export const groupRoomUrl = (roomId: string, origin = window.location.origin) => `${origin}/group/${roomId}`;

/** Room ids are 11 URL-safe characters; anything else in the URL is a typo or a stale link. */
export const isValidRoomId = (roomId: string | undefined): roomId is string =>
  typeof roomId === "string" && /^[A-Za-z0-9_-]{8,16}$/.test(roomId);
