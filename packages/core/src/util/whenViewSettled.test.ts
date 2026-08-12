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
