/**
 * Every Redis key the server uses, in one place.
 *
 *   room:<uuid>             hash   { id, user1Id, user2Id }
 *   userRoom:<socket id>    string room key the user is in
 *   q:<mode>:<lang>:<cc>    list   users waiting with these preferences ("*" = any)
 *   waiting:<socket id>     set    queues a waiting user sits in (used by matchOrWait.lua)
 */
export const redisKeys = {
  roomPrefix: "room:",
  userRoom: (userId: string) => `userRoom:${userId}`,
  queue: (mode: string, language: string, country: string) => `q:${mode}:${language}:${country}`,
  waitingPrefix: "waiting:",
};
