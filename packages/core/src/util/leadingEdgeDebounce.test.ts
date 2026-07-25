import { autorun, observable, runInAction } from 'mobx'

import { leadingEdgeDebounce } from './leadingEdgeDebounce.ts'

// The whole point of the helper: MobX's own `{ delay }` defers even the first
// run, which is what this replaces.
test('mobx built-in delay defers the first run (the problem being solved)', async () => {
  const o = observable.box(0)
  let ran = 0
  const dispose = autorun(
    () => {
      o.get()
      ran++
    },
    { delay: 50 },
  )
  expect(ran).toBe(0)
  await new Promise(r => setTimeout(r, 120))
  expect(ran).toBe(1)
  dispose()
})

test('runs the first pass synchronously, then debounces', async () => {
  const o = observable.box(0)
  const debounce = leadingEdgeDebounce(50)
  const seen: number[] = []
  const dispose = autorun(
    () => {
      seen.push(o.get())
      debounce.prime()
    },
    { scheduler: debounce.scheduler },
  )

  // leading edge: no timer wait before the first run
  expect(seen).toEqual([0])

  runInAction(() => {
    o.set(1)
  })
  runInAction(() => {
    o.set(2)
  })
  runInAction(() => {
    o.set(3)
  })
  // primed now, so the reruns are deferred and coalesce
  expect(seen).toEqual([0])
  await new Promise(r => setTimeout(r, 120))
  expect(seen).toEqual([0, 3])
  dispose()
})

test('stays on the leading edge until prime() is called', async () => {
  const o = observable.box(0)
  const debounce = leadingEdgeDebounce(50)
  const seen: number[] = []
  const dispose = autorun(
    () => {
      const v = o.get()
      seen.push(v)
      // mirrors a fetch autorun bailing on a not-ready guard: runs before the
      // real work must not arm the debounce
      if (v >= 2) {
        debounce.prime()
      }
    },
    { scheduler: debounce.scheduler },
  )

  expect(seen).toEqual([0])
  runInAction(() => {
    o.set(1)
  })
  expect(seen).toEqual([0, 1])
  runInAction(() => {
    o.set(2)
  })
  expect(seen).toEqual([0, 1, 2])
  runInAction(() => {
    o.set(3)
  })
  expect(seen).toEqual([0, 1, 2])
  await new Promise(r => setTimeout(r, 120))
  expect(seen).toEqual([0, 1, 2, 3])
  dispose()
})
