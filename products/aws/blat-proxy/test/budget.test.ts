import { describe, expect, it } from 'vitest'

import {
  cacheKey,
  clientId,
  reserveUpstreamCall,
  utcDay,
} from '../src/budget.ts'
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

describe('a client share of the shared key', () => {
  const share = { spacingMs: 0, clientHourlyMax: 2, clientDailyMax: 3 }

  it('refuses a client past its hourly share, until the hour turns', async () => {
    const { store } = memoryStore()
    for (const offset of [0, 1000]) {
      expect(
        await reserveUpstreamCall({
          store,
          nowMs: NOON + offset,
          client: 'a',
          ...share,
        }),
      ).toBeUndefined()
    }

    const denial = await reserveUpstreamCall({
      store,
      nowMs: NOON + 60_000,
      client: 'a',
      ...share,
    })

    expect(denial?.reason).toMatch(/2 queries an hour/)
    expect(denial?.retryAfterSeconds).toBe(3600 - 60)
    expect(
      await reserveUpstreamCall({
        store,
        nowMs: NOON + 3_600_000,
        client: 'a',
        ...share,
      }),
    ).toBeUndefined()
  })

  it('refuses a client past its daily share across hours', async () => {
    const { store } = memoryStore()
    for (const hour of [0, 1, 2]) {
      await reserveUpstreamCall({
        store,
        nowMs: NOON + hour * 3_600_000,
        client: 'a',
        ...share,
      })
    }
    const denial = await reserveUpstreamCall({
      store,
      nowMs: NOON + 3 * 3_600_000,
      client: 'a',
      ...share,
    })
    expect(denial?.reason).toMatch(/3 queries a day/)
  })

  it('leaves the shared slot and day alone for a client past its share', async () => {
    const { store, calls, daily } = memoryStore()
    await reserveUpstreamCall({ store, nowMs: NOON, client: 'a', ...share })
    await reserveUpstreamCall({ store, nowMs: NOON + 1, client: 'a', ...share })
    calls.length = 0

    await reserveUpstreamCall({ store, nowMs: NOON + 2, client: 'a', ...share })

    expect(calls).toEqual(['readClientCount', 'readClientCount'])
    expect(daily.get('2026-07-26')).toBe(2)
    expect(
      await reserveUpstreamCall({
        store,
        nowMs: NOON + 3,
        client: 'b',
        ...share,
      }),
    ).toBeUndefined()
  })

  it('spends none of a client share on an attempt the spacing slot refuses', async () => {
    const { store, clients } = memoryStore()
    await reserveUpstreamCall({ store, nowMs: NOON, client: 'a' })
    for (const offset of [1000, 2000, 3000]) {
      await reserveUpstreamCall({ store, nowMs: NOON + offset, client: 'a' })
    }
    expect([...clients.values()]).toEqual([1, 1])
  })

  it('keys a client by a salted hash, never its address', () => {
    const id = clientId('203.0.113.7', 'salt')
    expect(id).not.toContain('203.0.113.7')
    expect(id).toBe(clientId('203.0.113.7', 'salt'))
    expect(id).not.toBe(clientId('203.0.113.7', 'other salt'))
    expect(id).not.toBe(clientId('203.0.113.8', 'salt'))
  })
})
