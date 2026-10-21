-- Atomic matchmaking. Redis runs the whole script without interleaving
-- any other command, so two servers can never grab the same waiting user.
--
-- KEYS    queues this user accepts, most specific first,
--         e.g. q:video:ml:IN, q:video:ml:*, q:video:*:*
-- ARGV[1] user id (socket id)
-- ARGV[2] action:
--           "join"  - search the queues; wait in all of them if nobody is there
--           "widen" - same as join, but only if the user is still waiting
--                     (someone may have matched them a moment ago)
--           "leave" - stop waiting
-- ARGV[3] prefix for the per-user "waiting" set (redisKeys.waitingPrefix)
--
-- Each waiting user has a set "<prefix><id>" listing every queue they sit in,
-- so they can be removed from all of them in one step when matched or leaving.
--
-- Returns {"matched", otherId} | {"waiting"} | {"gone"} | {"left"}

local me = ARGV[1]
local action = ARGV[2]
local waitingPrefix = ARGV[3]

local function leave(id)
  local set = waitingPrefix .. id
  for _, queue in ipairs(redis.call('SMEMBERS', set)) do
    redis.call('LREM', queue, 0, id)
  end
  redis.call('DEL', set)
end

if action == 'widen' and redis.call('EXISTS', waitingPrefix .. me) == 0 then
  return {'gone'}
end

leave(me)
if action == 'leave' then
  return {'left'}
end

for _, queue in ipairs(KEYS) do
  local other = redis.call('LPOP', queue)
  if other then
    leave(other)
    return {'matched', other}
  end
end

for _, queue in ipairs(KEYS) do
  redis.call('RPUSH', queue, me)
  redis.call('SADD', waitingPrefix .. me, queue)
end
return {'waiting'}
