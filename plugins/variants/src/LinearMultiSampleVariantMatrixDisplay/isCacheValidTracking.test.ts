import { getMembers } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { createTestEnvironment } from './testEnv.ts'

// `isCacheValid`, `regionHasData` and `rpcProps` are read from reactive
// contexts — the `FetchVisibleRegions` autorun and the `rpcPropsCacheKey`
// computed. Declared in an `.actions()` block they become MST actions, MobX runs
// them untracked, the observables they read (`view.bpPerPx` here, settings in
// `rpcProps`) register no dependency, and the caller silently keeps a stale
// answer. That is how this display's byte gate went dead when
// `getByteEstimateConfig` landed in an `.actions()` block.
//
// Nothing else in the suite catches it: `FetchVisibleRegions` independently reads
// `view.visibleRegions`, which changes on every zoom, so the missing dependency
// is masked. Two pins, then — the declaration site below, and the tracking
// behavior it buys further down. Getters can't regress this way (MST throws on a
// getter inside `.actions()`), which is why the gate's opt-in is now the boolean
// getter `measuresBytesPreFlight` and the zoom rule the getter
// `regionFetchKey`. See BaseLinearDisplay/CLAUDE.md.
test('the reactive method hooks are views, not actions', () => {
  const { display } = createTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('regionHasData')
  expect(actions).not.toContain('rpcProps')
})

test('isCacheValid re-evaluates for callers when bpPerPx changes', () => {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  const region = {
    assemblyName: 'volvox',
    start: 0,
    end: 8000,
    refName: 'ctgA',
  }
  view.setDisplayedRegions([region])
  view.zoomTo(10)
  display.setLoadedRegion(0, region)

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
