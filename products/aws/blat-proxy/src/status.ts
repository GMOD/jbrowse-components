import { utcDay } from './budget.ts'

import type { BlatStore } from './store.ts'

export interface ProxyStatus {
  ok: boolean
  message?: string
  budget?: { day: string; used: number; max: number }
}

/**
 * What a client asks before it queries: whether the shared proxy is usable
 * right now, and a sentence for the user if it is not. An operator-set notice
 * (the `notice` item in the budget table) is the kill switch for a UCSC-side
 * change that the shipped client cannot absorb; an unreachable store is
 * reported as an outage because serveQuery fails closed without it.
 */
export async function proxyStatus({
  store,
  nowMs,
  dailyMax,
}: {
  store: BlatStore | undefined
  nowMs: number
  dailyMax: number
}): Promise<ProxyStatus> {
  let status: ProxyStatus
  if (store) {
    const day = utcDay(nowMs)
    try {
      const [notice, used] = await Promise.all([
        store.readNotice(),
        store.readDailyCount(day),
      ])
      status = notice
        ? { ok: false, message: notice, budget: { day, used, max: dailyMax } }
        : { ok: true, budget: { day, used, max: dailyMax } }
    } catch (error) {
      console.error('BLAT status read failed:', error)
      status = {
        ok: false,
        message:
          'The shared BLAT proxy cannot reach its rate budget store, so queries through it are refused until it recovers.',
      }
    }
  } else {
    status = { ok: true }
  }
  return status
}
