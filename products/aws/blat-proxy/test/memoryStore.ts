import type { BlatStore } from '../src/store.ts'

/**
 * The {@link BlatStore} contract in memory, matching the DynamoDB adapter's
 * semantics: reservations are all-or-nothing, the daily counter refuses at its
 * max rather than overshooting, and a cache entry past its expiry reads as
 * absent (DynamoDB's TTL sweep is not prompt, so the adapter checks on read).
 *
 * Single-threaded, so it cannot demonstrate the atomicity the real conditional
 * expressions provide — that is a property of DynamoDB, not of the policy this
 * fake exists to test.
 */
export function memoryStore() {
  const cache = new Map<string, { body: string; expiresAt: number }>()
  const daily = new Map<string, number>()
  const calls: string[] = []
  let lastMs: number | undefined
  let notice: string | undefined

  const store: BlatStore = {
    tryReserveSlot(nowMs, spacingMs) {
      calls.push('tryReserveSlot')
      const blockedBy = lastMs !== undefined && lastMs > nowMs - spacingMs
      if (!blockedBy) {
        lastMs = nowMs
      }
      return Promise.resolve(
        blockedBy
          ? ({ ok: false, retryAtMs: lastMs! + spacingMs } as const)
          : ({ ok: true } as const),
      )
    },

    countDaily(day, max) {
      calls.push('countDaily')
      const count = daily.get(day) ?? 0
      if (count < max) {
        daily.set(day, count + 1)
      }
      return Promise.resolve(
        count < max
          ? ({ ok: true, count: count + 1 } as const)
          : ({ ok: false } as const),
      )
    },

    readCached(key, nowSeconds) {
      calls.push('readCached')
      const entry = cache.get(key)
      return Promise.resolve(
        entry && entry.expiresAt > nowSeconds ? entry.body : undefined,
      )
    },

    writeCached(key, body, expiresAt) {
      calls.push('writeCached')
      cache.set(key, { body, expiresAt })
      return Promise.resolve()
    },

    readDailyCount(day) {
      calls.push('readDailyCount')
      return Promise.resolve(daily.get(day) ?? 0)
    },

    readNotice() {
      calls.push('readNotice')
      return Promise.resolve(notice)
    },
  }

  return {
    store,
    calls,
    cache,
    daily,
    setNotice(message: string | undefined) {
      notice = message
    },
  }
}
