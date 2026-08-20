import { destroy, types } from '@jbrowse/mobx-state-tree'
import { autorun, observable, runInAction } from 'mobx'

import { leadingEdgeAutorun } from './leadingEdgeAutorun.ts'

const Host = types.model('Host', {}).volatile(() => ({}))

function host() {
  return Host.create()
}

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

test('runs the first pass on a microtask, then debounces', async () => {
  const o = observable.box(0)
  const seen: number[] = []
  leadingEdgeAutorun(
    host(),
    () => {
      seen.push(o.get())
      return true
    },
    { name: 'test', delay: 50 },
  )

  // leading edge: one microtask, not a timer
  expect(seen).toEqual([])
  await Promise.resolve()
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
})

test('stays on the leading edge until the body reports work', async () => {
  const o = observable.box(0)
  const seen: number[] = []
  leadingEdgeAutorun(
    host(),
    () => {
      const v = o.get()
      seen.push(v)
      // mirrors a fetch autorun bailing on a not-ready guard: runs before the
      // real work must not arm the debounce
      return v >= 2
    },
    { name: 'test', delay: 50 },
  )

  await Promise.resolve()
  expect(seen).toEqual([0])
  runInAction(() => {
    o.set(1)
  })
  await Promise.resolve()
  expect(seen).toEqual([0, 1])
  runInAction(() => {
    o.set(2)
  })
  await Promise.resolve()
  expect(seen).toEqual([0, 1, 2])
  runInAction(() => {
    o.set(3)
  })
  await Promise.resolve()
  expect(seen).toEqual([0, 1, 2])
  await new Promise(r => setTimeout(r, 120))
  expect(seen).toEqual([0, 1, 2, 3])
})

// The reason the leading edge yields once rather than running inside the
// install call: a model is routinely built and configured in one synchronous
// block, and the run has to see the finished state.
test('a change made in the same tick as the install is coalesced into the first run', async () => {
  const o = observable.box(0)
  const seen: number[] = []
  leadingEdgeAutorun(
    host(),
    () => {
      seen.push(o.get())
      return true
    },
    { name: 'test', delay: 50 },
  )
  runInAction(() => {
    o.set(7)
  })

  await Promise.resolve()
  expect(seen).toEqual([7])
})

test('destroying the host disposes the autorun', async () => {
  const o = observable.box(0)
  const self = host()
  let ran = 0
  leadingEdgeAutorun(
    self,
    () => {
      o.get()
      ran++
    },
    { name: 'test', delay: 50 },
  )
  await Promise.resolve()
  expect(ran).toBe(1)
  destroy(self)
  runInAction(() => {
    o.set(1)
  })
  await Promise.resolve()
  expect(ran).toBe(1)
})
