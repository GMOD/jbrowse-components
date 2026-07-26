import { autorun } from 'mobx'

import { createTestEnvironment } from './testEnv.ts'

// `isCacheValid` and `getByteEstimateConfig` are MST **views**, not actions.
// MobX runs an action inside `untracked`, so while these were actions every
// observable they read — `view.bpPerPx` here, `view.visibleBp` in the byte
// estimate, `showSummary` in MAF's — registered no dependency, and any computed
// or autorun calling them silently kept a stale answer.
//
// Nothing else in the suite fails when that regresses: the one production
// caller (`FetchVisibleRegions`) independently reads `view.visibleRegions`,
// which changes on every zoom, so the missing dependency was masked. That
// coincidence was an unwritten precondition on every override — pinned here so
// converting one back to an action fails loudly instead.
test('isCacheValid re-evaluates for callers when bpPerPx changes', () => {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 8000, refName: 'ctgA' },
  ])
  view.zoomTo(10)
  display.setLoadedBpPerPx(view.bpPerPx)

  const seen: boolean[] = []
  const stop = autorun(() => {
    seen.push(display.isCacheValid(0))
  })
  expect(seen).toEqual([true])

  // Matrix mode is zoom-cache-strict, so a zoom change alone invalidates the
  // cache. As an action this second entry never arrived.
  view.zoomTo(20)
  expect(view.bpPerPx).not.toBe(10)
  expect(seen).toEqual([true, false])

  stop()
})

test('getByteEstimateConfig re-evaluates for callers when the viewport changes', () => {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 8000, refName: 'ctgA' },
  ])
  view.zoomTo(10)

  const seen: (number | undefined)[] = []
  const stop = autorun(() => {
    // The base hook's return type is nullable (MAF opts out in summary mode);
    // this display always returns a config.
    seen.push(display.getByteEstimateConfig()?.visibleBp)
  })
  expect(seen).toHaveLength(1)

  view.zoomTo(20)
  expect(seen).toHaveLength(2)
  expect(seen[1]).not.toBe(seen[0])

  stop()
})
