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

export function utcDay(nowMs: number) {
  return new Date(nowMs).toISOString().slice(0, 10)
}

function nextUtcMidnightMs(nowMs: number) {
  const d = new Date(nowMs)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
}

/**
 * Identifies a query by what actually determines its result. `apiKey` and
 * `output` are proxy-injected rather than client-chosen, so they are dropped;
 * the rest is sorted so two clients that order their form fields differently
 * still share a cache entry. Hashed because `userSeq` alone can be 300 kb,
 * which is no kind of partition key.
 */
export function cacheKey(clientBody: string) {
  const params = new URLSearchParams(clientBody)
  params.delete('apiKey')
  params.delete('output')
  const sorted = [...params].sort(([a], [b]) => (a < b ? -1 : 1))
  return createHash('sha256')
    .update(new URLSearchParams(sorted).toString())
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
}: {
  store: BlatStore
  nowMs: number
  spacingMs?: number
  dailyMax?: number
}): Promise<BudgetDenial | undefined> {
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
