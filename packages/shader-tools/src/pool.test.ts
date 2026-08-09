import { pool } from './pool.ts'

// A promise plus its resolvers, so a test decides when each task finishes and
// in what order. No timers: the interesting properties here are all about
// ordering, and a test that sleeps to get an ordering only usually gets it.
function deferred() {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test('runs every item and returns no errors when none throw', async () => {
  const seen: number[] = []
  const errors = await pool([1, 2, 3, 4, 5], 2, async n => {
    seen.push(n)
  })
  expect(errors).toEqual([])
  expect([...seen].sort()).toEqual([1, 2, 3, 4, 5])
})

test('holds concurrency at the limit', async () => {
  const gates = Array.from({ length: 6 }, deferred)
  let inFlight = 0
  let peak = 0
  const run = pool(gates, 2, async g => {
    inFlight++
    peak = Math.max(peak, inFlight)
    await g.promise
    inFlight--
  })
  // Releasing one at a time means a third task can only have started because a
  // slot freed, never because the cap leaked.
  for (const g of gates) {
    g.resolve()
    await Promise.resolve()
  }
  await run
  expect(peak).toBe(2)
})

test('a limit above the item count spawns no idle workers', async () => {
  const errors = await pool(['only'], 16, async () => {})
  expect(errors).toEqual([])
  expect(await pool([], 16, async () => {})).toEqual([])
})

// One shader failing to compile must not cancel the rest. Reporting all four
// broken shaders at once is the difference between one round of fixing and four
// — and the old serial loop threw on the first, so this is new behavior worth
// pinning rather than an accident of the rewrite.
test('runs the remaining items after one throws', async () => {
  const seen: string[] = []
  const errors = await pool(['a', 'bad', 'c'], 2, async item => {
    seen.push(item)
    if (item === 'bad') {
      throw new Error(`no: ${item}`)
    }
  })
  expect([...seen].sort()).toEqual(['a', 'bad', 'c'])
  expect(errors).toHaveLength(1)
  expect(errors[0]!.item).toBe('bad')
  expect((errors[0]!.error as Error).message).toBe('no: bad')
})

// Failures are reported in input order even though the work finishes in
// whatever order the machine produces, so a build's report is the same every
// run and diffable against the last one.
test('reports errors in input order, not completion order', async () => {
  const gates = new Map(
    ['a', 'b', 'c'].map(name => [name, deferred()] as const),
  )
  const run = pool([...gates.keys()], 3, async name => {
    await gates.get(name)!.promise
  })
  // Finish them backwards.
  gates.get('c')!.reject(new Error('c failed'))
  gates.get('b')!.reject(new Error('b failed'))
  gates.get('a')!.reject(new Error('a failed'))
  const errors = await run
  expect(errors.map(e => e.item)).toEqual(['a', 'b', 'c'])
  expect(errors.map(e => e.index)).toEqual([0, 1, 2])
})

// The driver passes file objects, and two shaders can carry equal-looking
// entries. An indexOf-based sort would key on identity and mis-order (or, for
// genuinely duplicate values, collapse) them; the index is captured at dispatch.
test('orders duplicate items by position rather than identity', async () => {
  const errors = await pool(['dup', 'ok', 'dup'], 1, async item => {
    if (item === 'dup') {
      throw new Error('dup failed')
    }
  })
  expect(errors.map(e => e.index)).toEqual([0, 2])
})
