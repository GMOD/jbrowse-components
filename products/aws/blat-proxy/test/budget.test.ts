import { describe, expect, it } from 'vitest'

import { cacheKey, reserveUpstreamCall, utcDay } from '../src/budget.ts'
import { memoryStore } from './memoryStore.ts'

const NOON = Date.parse('2026-07-26T12:00:00Z')

describe('cacheKey', () => {
  it('is the same query however the client ordered its fields', () => {
    expect(cacheKey('userSeq=ACGT&db=hg38&type=DNA', 'blat')).toBe(
      cacheKey('type=DNA&db=hg38&userSeq=ACGT', 'blat'),
    )
  })

  it('ignores the parameters the proxy itself forces on', () => {
    expect(
      cacheKey('userSeq=ACGT&db=hg38&apiKey=one&output=json', 'blat'),
    ).toBe(cacheKey('userSeq=ACGT&db=hg38&apiKey=two', 'blat'))
  })

  it('separates queries that differ in sequence or assembly', () => {
    const base = cacheKey('userSeq=ACGT&db=hg38', 'blat')
    expect(cacheKey('userSeq=ACGTA&db=hg38', 'blat')).not.toBe(base)
    expect(cacheKey('userSeq=ACGT&db=hg19', 'blat')).not.toBe(base)
  })

  it('separates the two CGIs, which answer differently shaped results', () => {
    expect(cacheKey('db=hg38', 'blat')).not.toBe(cacheKey('db=hg38', 'ispcr'))
  })
})

describe('utcDay', () => {
  it('keys by the UTC calendar day', () => {
    expect(utcDay(Date.parse('2026-07-26T23:59:59Z'))).toBe('2026-07-26')
    expect(utcDay(Date.parse('2026-07-27T00:00:01Z'))).toBe('2026-07-27')
  })
})

describe('reserveUpstreamCall', () => {
  it('allows a call when the slot is free and the day has room', async () => {
    const { store, daily } = memoryStore()
    expect(await reserveUpstreamCall({ store, nowMs: NOON })).toBeUndefined()
    expect(daily.get('2026-07-26')).toBe(1)
  })

  it('refuses a second call inside the spacing window, saying when to retry', async () => {
    const { store } = memoryStore()
    await reserveUpstreamCall({ store, nowMs: NOON, spacingMs: 15_000 })

    const denial = await reserveUpstreamCall({
      store,
      nowMs: NOON + 4000,
      spacingMs: 15_000,
    })

    expect(denial?.retryAfterSeconds).toBe(11)
    expect(denial?.reason).toMatch(/15 seconds/)
  })

  it('allows the next call once the spacing window has passed', async () => {
    const { store } = memoryStore()
    await reserveUpstreamCall({ store, nowMs: NOON, spacingMs: 15_000 })
    expect(
      await reserveUpstreamCall({
        store,
        nowMs: NOON + 15_000,
        spacingMs: 15_000,
      }),
    ).toBeUndefined()
  })

  it('refuses once the day is spent, and points at the UTC rollover', async () => {
    const { store } = memoryStore()
    await reserveUpstreamCall({ store, nowMs: NOON, dailyMax: 1 })

    const denial = await reserveUpstreamCall({
      store,
      nowMs: NOON + 60_000,
      spacingMs: 0,
      dailyMax: 1,
    })

    expect(denial?.reason).toMatch(/2026-07-26/)
    // noon UTC plus a minute -> just under 12h to midnight
    expect(denial?.retryAfterSeconds).toBe(12 * 3600 - 60)
  })

  it('starts a fresh budget on the next UTC day', async () => {
    const { store } = memoryStore()
    await reserveUpstreamCall({ store, nowMs: NOON, dailyMax: 1 })
    expect(
      await reserveUpstreamCall({
        store,
        nowMs: NOON + 86_400_000,
        dailyMax: 1,
      }),
    ).toBeUndefined()
  })

  // A spacing slot spent on a call the daily budget then refuses costs one
  // 15s window, and only on a day that is already exhausted. Counting first
  // would instead leak a unit of the day's budget on every spacing refusal.
  it('takes the spacing slot before counting the day', async () => {
    const { store, calls } = memoryStore()
    await reserveUpstreamCall({ store, nowMs: NOON })
    expect(calls).toEqual(['tryReserveSlot', 'countDaily'])
  })

  it('does not count the day when the spacing slot is refused', async () => {
    const { store, daily } = memoryStore()
    await reserveUpstreamCall({ store, nowMs: NOON, spacingMs: 15_000 })
    await reserveUpstreamCall({ store, nowMs: NOON + 1, spacingMs: 15_000 })
    expect(daily.get('2026-07-26')).toBe(1)
  })
})
