// Atomic Redis admission: per-sender spacing and fixed UTC hourly quota.
export const admissionScript = `
local t=redis.call('TIME')
local now=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)
local hour=math.floor(now/3600000)
local stored=tonumber(redis.call('HGET',KEYS[1],'hour') or '-1')
local count=tonumber(redis.call('HGET',KEYS[1],'count') or '0')
if stored~=hour then count=0 end
local limit=tonumber(ARGV[1])
if count>=limit then return {(hour+1)*3600000,0,hour,count} end
local next=tonumber(redis.call('HGET',KEYS[1],'next') or '0')
if next>now then return {next,0,hour,count} end
count=count+1
redis.call('HSET',KEYS[1],'hour',hour,'count',count,'next',now+tonumber(ARGV[2]))
redis.call('PEXPIRE',KEYS[1],7200000)
return {0,count==limit and 1 or 0,hour,count}
`;
// Release uses Redis server time too, so host clock skew cannot shorten send spacing.
export const releaseSlotScript = `
local t=redis.call('TIME')
local now=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)
redis.call('HSET',KEYS[1],'next',now+tonumber(ARGV[1]))
redis.call('PEXPIRE',KEYS[1],7200000)
return now+tonumber(ARGV[1])
`;
