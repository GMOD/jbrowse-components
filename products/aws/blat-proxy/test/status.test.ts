import { describe, expect, it } from 'vitest'

import { proxyStatus } from '../src/status.ts'
import { memoryStore } from './memoryStore.ts'

const NOW = Date.UTC(2026, 8, 2, 12)

describe('proxyStatus', () => {
  it('is ok with no notice, and reports the day budget', async () => {
    const { store } = memoryStore()
    await store.countDaily('2026-09-02', 4500, 0)
    expect(await proxyStatus({ store, nowMs: NOW, dailyMax: 4500 })).toEqual({
      ok: true,
      budget: { day: '2026-09-02', used: 1, max: 4500 },
    })
  })

  it('relays an operator notice as not ok', async () => {
    const { store, setNotice } = memoryStore()
    setNotice('UCSC changed hgBlat; upgrade to 5.1')
    const status = await proxyStatus({ store, nowMs: NOW, dailyMax: 4500 })
    expect(status.ok).toBe(false)
    expect(status.message).toBe('UCSC changed hgBlat; upgrade to 5.1')
  })

  // serveQuery fails closed without the store, so a status that said ok here
  // would promise a query the proxy is about to refuse
  it('is not ok when the store is unreachable', async () => {
    const { store } = memoryStore()
    store.readNotice = () => Promise.reject(new Error('dynamo down'))
    const status = await proxyStatus({ store, nowMs: NOW, dailyMax: 4500 })
    expect(status.ok).toBe(false)
    expect(status.message).toMatch(/budget store/)
  })

  it('is ok unmetered', async () => {
    expect(
      await proxyStatus({ store: undefined, nowMs: NOW, dailyMax: 4500 }),
    ).toEqual({ ok: true })
  })
})
