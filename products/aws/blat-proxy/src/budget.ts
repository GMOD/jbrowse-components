import { createHash } from 'node:crypto'

import type { BlatStore } from './store.ts'

// UCSC caps program-driven BLAT at 1 hit / 15 s and 5000 / day. This proxy
// spends ONE shared apiKey for every browser user, so the cap is a property of
// the deployment rather than of a client, and it has to be enforced centrally.
export const DEFAULT_SPACING_MS = 15_000

// Deliberately under UCSC's 5000: their day boundary is not documented (this
// counts UTC days), so a boundary that does not line up with theirs would let a
// full-throttle day overlap into their next window. The headroom absorbs that.
// Exceeding the cap risks the shared key, which every browser user depends on.
export const DEFAULT_DAILY_MAX = 4500

// A BLAT hit for a given assembly + sequence is stable, so a repeat of the
// exact same query is served from the cache and spends no budget at all. That
// is the single biggest lever here: a documented example sequence, or a user
// re-running the query they just ran, costs one upstream call per day.
export const DEFAULT_CACHE_TTL_SECONDS = 86_400

// DynamoDB caps an item at 400 KB. A result that big is a pathological query
// rather than the repeat-hit case the cache exists for, so skip it.
export const MAX_CACHEABLE_BODY_BYTES = 350_000

// One client's share of the shared key. Generous, so a workshop behind one
// address fits, while a script querying every 15 s, which would otherwise take
// every slot of the day, stops at a fraction of it.
export const DEFAULT_CLIENT_HOURLY_MAX = 60
export const DEFAULT_CLIENT_DAILY_MAX = 300

const HOUR_MS = 3_600_000

export function utcDay(nowMs: number) {
  return new Date(nowMs).toISOString().slice(0, 10)
}

function nextUtcMidnightMs(nowMs: number) {
  const d = new Date(nowMs)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
}

/**
 * A caller's address, salted and hashed, so the budget table never holds an
 * address and the hash means nothing without the salt.
 */
export function clientId(sourceIp: string, salt: string) {
  return createHash('sha256')
    .update(`${salt}\n${sourceIp}`)
    .digest('hex')
    .slice(0, 32)
}

function clientWindows({
  client,
  nowMs,
  hourlyMax,
  dailyMax,
}: {
  client: string
  nowMs: number
  hourlyMax: number
  dailyMax: number
}) {
  const hourStartMs = Math.floor(nowMs / HOUR_MS) * HOUR_MS
  return [
    {
      key: `${client}#${new Date(hourStartMs).toISOString().slice(0, 13)}`,
      max: hourlyMax,
      endsMs: hourStartMs + HOUR_MS,
      share: `${hourlyMax} queries an hour`,
    },
    {
      key: `${client}#${utcDay(nowMs)}`,
      max: dailyMax,
      endsMs: nextUtcMidnightMs(nowMs),
      share: `${dailyMax} queries a day`,
    },
  ]
}

/**
 * Identifies a query by what actually determines its result: the CGI it goes
 * to, plus the parameters the client chose. `apiKey` and `output` are
 * proxy-injected rather than client-chosen, so they are dropped; the rest is
 * sorted so two clients that order their form fields differently still share a
 * cache entry. Hashed because `userSeq` alone can be 300 kb, which is no kind
 * of partition key.
 */
export function cacheKey(clientBody: string, routeName: string) {
  const params = new URLSearchParams(clientBody)
  params.delete('apiKey')
  params.delete('output')
  const sorted = [...params].sort(([a], [b]) => (a < b ? -1 : 1))
  return createHash('sha256')
    .update(`${routeName}\n${new URLSearchParams(sorted).toString()}`)
    .digest('hex')
}

export interface BudgetDenial {
  reason: string
  retryAfterSeconds: number
}

/**
 * Claims the right to make one upstream call, or explains how long the caller
 * has to wait.
 *
 * The client's share is checked first, and only read: a client over its share
 * must not take the spacing slot from everyone else, and a refused attempt,
 * including the retries a waiting client makes, spends none of its share. The
 * share is counted once the call is allowed. Reading then counting lets a burst
 * of concurrent calls from one client overshoot by a few, which the generous
 * limit absorbs.
 *
 * Spacing is taken before the daily count, because the two failure modes are
 * not symmetric: a spacing slot spent on a call that then fails the daily check
 * only delays the next request by 15 s, and only in the case where the daily
 * budget is exhausted and nothing was getting through anyway. Counting first
 * would instead leak a permanent unit of the day's budget every time the
 * spacing check refused.
 */
export async function reserveUpstreamCall({
  store,
  nowMs,
  spacingMs = DEFAULT_SPACING_MS,
  dailyMax = DEFAULT_DAILY_MAX,
  client,
  clientHourlyMax = DEFAULT_CLIENT_HOURLY_MAX,
  clientDailyMax = DEFAULT_CLIENT_DAILY_MAX,
}: {
  store: BlatStore
  nowMs: number
  spacingMs?: number
  dailyMax?: number
  /** {@link clientId} of the caller; omitted, no share is enforced */
  client?: string
  clientHourlyMax?: number
  clientDailyMax?: number
}): Promise<BudgetDenial | undefined> {
  const windows =
    client === undefined
      ? []
      : clientWindows({
          client,
          nowMs,
          hourlyMax: clientHourlyMax,
          dailyMax: clientDailyMax,
        })
  const spent = await Promise.all(
    windows.map(window => store.readClientCount(window.key)),
  )
  const exhausted = windows.find((window, i) => spent[i]! >= window.max)
  let denial: BudgetDenial | undefined
  if (exhausted) {
    denial = {
      reason:
        'This network has used its share of the shared BLAT key ' +
        `(${exhausted.share}).`,
      retryAfterSeconds: Math.ceil((exhausted.endsMs - nowMs) / 1000),
    }
  } else {
    denial = await reserveSharedKey({ store, nowMs, spacingMs, dailyMax })
    if (!denial) {
      await Promise.all(
        windows.map(window =>
          store.countClient(
            window.key,
            Math.ceil(window.endsMs / 1000) + HOUR_MS / 1000,
          ),
        ),
      )
    }
  }
  return denial
}

async function reserveSharedKey({
  store,
  nowMs,
  spacingMs,
  dailyMax,
}: {
  store: BlatStore
  nowMs: number
  spacingMs: number
  dailyMax: number
}) {
  const slot = await store.tryReserveSlot(nowMs, spacingMs)
  let denial: BudgetDenial | undefined
  if (slot.ok) {
    const day = utcDay(nowMs)
    const daily = await store.countDaily(
      day,
      dailyMax,
      Math.ceil(nextUtcMidnightMs(nowMs) / 1000) + 86_400,
    )
    if (!daily.ok) {
      denial = {
        reason:
          `The shared BLAT budget for ${day} (${dailyMax} queries) is spent. ` +
          'Supply your own UCSC apiKey to query without it.',
        retryAfterSeconds: Math.ceil((nextUtcMidnightMs(nowMs) - nowMs) / 1000),
      }
    }
  } else {
    denial = {
      reason:
        'The shared BLAT key allows one query every ' +
        `${Math.round(spacingMs / 1000)} seconds and one is in flight.`,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((slot.retryAtMs - nowMs) / 1000),
      ),
    }
  }
  return denial
}
