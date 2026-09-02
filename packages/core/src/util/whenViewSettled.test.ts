import { observable, runInAction } from 'mobx'

import { whenViewSettled } from './whenViewSettled.ts'

function uninitializedView(): { initialized: boolean; error: unknown } {
  return observable({ initialized: false, error: undefined })
}

test('resolves true once the view initializes', async () => {
  const view = uninitializedView()
  const p = whenViewSettled(view)
  runInAction(() => {
    view.initialized = true
  })
  await expect(p).resolves.toBe(true)
})

// the hang this exists to prevent: an assembly that fails to load leaves
// `initialized` false forever, so a bare when() never settles at all
test('resolves false on an error the view can never initialize past', async () => {
  const view = uninitializedView()
  const p = whenViewSettled(view)
  runInAction(() => {
    view.error = new Error('assembly volvox failed to load')
  })
  await expect(p).resolves.toBe(false)
})

test('an already-initialized view settles without waiting', async () => {
  await expect(
    whenViewSettled({ initialized: true, error: undefined }),
  ).resolves.toBe(true)
})

// initialized wins: a track error on a view that did come up is the caller's
// business, not a reason to report the view itself as failed
test('an initialized view carrying an error still settles true', async () => {
  await expect(
    whenViewSettled({ initialized: true, error: new Error('a track failed') }),
  ).resolves.toBe(true)
})

function launchingView(): {
  initialized: boolean
  error: unknown
  pendingLaunch?: unknown
} {
  return observable({
    initialized: true,
    error: undefined,
    pendingLaunch: { loc: 'chr1:1-100' },
  })
}

// `initialized` can go true mid-launch (LGV's flips when displayedRegions
// land, with tracks still to attach), so the wait holds until the launch
// machinery consumes the blob
test('an initialized view still applying its launch is not settled', async () => {
  const view = launchingView()
  const p = whenViewSettled(view)
  let done = false
  void p.then(() => {
    done = true
  })
  await Promise.resolve()
  expect(done).toBe(false)
  runInAction(() => {
    view.pendingLaunch = undefined
  })
  await expect(p).resolves.toBe(true)
})

test('a launch failure that errors the view settles false', async () => {
  const view = launchingView()
  const p = whenViewSettled(view)
  runInAction(() => {
    view.error = new Error('launch failed')
  })
  await expect(p).resolves.toBe(false)
})
