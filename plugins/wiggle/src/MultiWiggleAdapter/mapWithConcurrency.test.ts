import { mapWithConcurrency } from './mapWithConcurrency.ts'

// Resolves when released, and records that it started — enough to observe how
// many are in flight without leaning on timers.
function gate() {
  let release!: () => void
  const promise = new Promise<void>(res => {
    release = res
  })
  return { promise, release }
}

describe('mapWithConcurrency', () => {
  it('preserves input order regardless of completion order', async () => {
    const out = await mapWithConcurrency([3, 1, 2], 3, async n => {
      await new Promise(res => setTimeout(res, n))
      return n * 10
    })
    expect(out).toEqual([30, 10, 20])
  })

  it('passes the index', async () => {
    const out = await mapWithConcurrency(['a', 'b', 'c'], 2, (s, i) =>
      Promise.resolve(`${s}${i}`),
    )
    expect(out).toEqual(['a0', 'b1', 'c2'])
  })

  it('never exceeds the limit, and does start that many', async () => {
    const gates = Array.from({ length: 10 }, gate)
    let inFlight = 0
    let peak = 0
    const started: number[] = []

    const all = mapWithConcurrency(gates, 3, async (g, i) => {
      started.push(i)
      inFlight++
      peak = Math.max(peak, inFlight)
      await g.promise
      inFlight--
      return i
    })

    // let the pool fill
    await Promise.resolve()
    expect(started).toEqual([0, 1, 2])

    for (const g of gates) {
      g.release()
      await new Promise(res => setTimeout(res, 0))
    }
    expect(await all).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(peak).toBe(3)
  })

  it('runs everything when the limit exceeds the item count', async () => {
    let peak = 0
    let inFlight = 0
    const out = await mapWithConcurrency([1, 2], 50, async n => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await Promise.resolve()
      inFlight--
      return n
    })
    expect(out).toEqual([1, 2])
    expect(peak).toBe(2)
  })

  it('handles an empty list without hanging', async () => {
    expect(await mapWithConcurrency([], 4, () => Promise.resolve(1))).toEqual(
      [],
    )
  })

  it('rejects like Promise.all, and stops starting new work', async () => {
    const started: number[] = []
    await expect(
      mapWithConcurrency([0, 1, 2, 3, 4, 5], 2, async i => {
        started.push(i)
        await Promise.resolve()
        if (i === 0) {
          throw new Error('boom')
        }
        return i
      }),
    ).rejects.toThrow('boom')
    // the two that were already in flight ran; the rest never started
    expect(started.length).toBeLessThan(6)
  })
})
