import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { stateModelFactory } from './model.ts'

// The shape three of the demo builders author (`scripts/build_lct_ld.sh`,
// `build_tcga_cohort_cnv.sh`, `build_tcga_cohort_mutations.sh`): a spec's
// launch keys written straight onto a `defaultSession` view. It used to render
// a default view and say nothing.
const FLAT = {
  type: 'LinearGenomeView',
  assembly: 'hg38',
  loc: 'chr2:134,000,000-137,150,000',
}

const NESTED = {
  type: 'LinearGenomeView',
  init: { assembly: 'hg38', loc: 'chr2:134,000,000-137,150,000' },
}

const notify = jest.fn()

function open(snap: unknown) {
  const pm = new PluginManager([])
  pm.createPluggableElements()
  pm.configure()
  return types
    .model({
      rpcManager: types.frozen(),
      configuration: types.frozen(),
      view: stateModelFactory(pm),
    })
    .actions(() => ({ notify }))
    .create({ rpcManager: {}, configuration: {}, view: snap } as any).view
}

let warn: jest.SpyInstance

beforeEach(() => {
  notify.mockClear()
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
})

const warnings = () => warn.mock.calls.map(c => `${c[0]}`)

test('a launch key written on the view object reaches the launch state', () => {
  const view = open(FLAT)
  expect(view.launch).toEqual({
    assembly: 'hg38',
    loc: 'chr2:134,000,000-137,150,000',
  })
  expect(warnings()).toEqual([])
  expect(notify).not.toHaveBeenCalled()
})

test('the nested v4 form produces the same launch state, and says it is going', () => {
  const view = open(NESTED)
  expect(view.launch).toEqual({ ...open(FLAT).launch, legacyInit: true })
  expect(warnings()).toEqual([
    'LinearGenomeView nests its settings under "init", which is deprecated: write every setting directly on the view object.',
  ])
})

test('a key naming neither a launch key nor a property is named on attach', () => {
  open({ type: 'LinearGenomeView', assembly: 'hg38', locc: 'chr1' })
  expect(warnings()).toEqual(['LinearGenomeView ignored unknown key(s): locc'])
  expect(notify).toHaveBeenCalledWith(
    'LinearGenomeView ignored unknown key(s): locc',
    'warning',
  )
})

// The partition subsumes captureUnknownSnapshotKeys for this view. Both wired
// up, a typo warns twice and notifies twice.
test('an unknown key is reported once, not once per capture', () => {
  open({ type: 'LinearGenomeView', locc: 'chr1' })
  expect(warnings()).toHaveLength(1)
  expect(notify).toHaveBeenCalledTimes(1)
})

// A blob holding only what afterAttach reports is not work to do. Read as one,
// `initialized` waits on the assembly `launch.assembly` does not name, and the
// view sits on its spinner forever.
test('a typo alone leaves nothing pending', () => {
  const view = open({ type: 'LinearGenomeView', locc: 'chr1' })
  expect(view.launch).toEqual({ unknown: { locc: 'chr1' } })
  expect(view.pendingLaunch).toBeUndefined()
})

test('a plain view prop stays on the snapshot', () => {
  const view = open({
    type: 'LinearGenomeView',
    assembly: 'hg38',
    colorByCDS: true,
    hideHeader: true,
  })
  expect(view.colorByCDS).toBe(true)
  expect(view.hideHeader).toBe(true)
  expect(view.launch).toEqual({ assembly: 'hg38' })
})

// The pre-window viewport spelling, which is no longer a declared property.
// Two things keep it working and either alone would: the partition runs after
// the model's own remap (`withLaunchInput` is added first, and MST runs
// preprocessors in reverse — the rule itself is pinned in
// packages/core/src/util/withLaunchInput.test.ts), and `passThrough` names the
// pair besides, which is also what the v4 partition a synteny row still goes
// through reads.
test('a legacy viewport snapshot converts rather than reporting typos', () => {
  const view = open({ type: 'LinearGenomeView', bpPerPx: 10, offsetPx: 1000 })
  expect(warnings()).toEqual([])
  expect(view.legacyBpPerPx).toBe(10)
  expect(view.windowStartBp).toBe(10000)
})

// Kept only while there is nothing on screen, so an autosave firing mid-load
// can still rebuild the view instead of dropping to the import form.
test('the launch state is not persisted once the view has navigated', () => {
  expect(getSnapshot(open(FLAT)).launch).toBeDefined()
  const navigated = open({
    ...FLAT,
    displayedRegions: [
      { refName: 'chr2', start: 0, end: 100, assemblyName: 'hg38' },
    ],
  })
  expect(getSnapshot(navigated).launch).toBeUndefined()
})

describe('the track entries discriminator', () => {
  // A bare PluginManager registers no track type, so the `tracks` union is
  // empty and MST refuses anything left on the property. That refusal IS the
  // assertion: an entry the discriminator wrongly lifted would never reach it.
  const built = { type: 'FeatureTrack', configuration: 'genes', displays: [] }

  test('a recipe entry is a launch key', () => {
    expect(
      open({ type: 'LinearGenomeView', tracks: ['genes'] }).launch,
    ).toEqual({ tracks: ['genes'] })
  })

  test('an object naming a trackId is a recipe too', () => {
    const entry = {
      trackId: 'genes',
      displays: [{ type: 'LinearBasicDisplay' }],
    }
    expect(open({ type: 'LinearGenomeView', tracks: [entry] }).launch).toEqual({
      tracks: [entry],
    })
  })

  test('a built track snapshot stays on the state property', () => {
    expect(() => open({ type: 'LinearGenomeView', tracks: [built] })).toThrow(
      '/view/tracks/0',
    )
  })

  test('a mixed array splits per entry', () => {
    // the recipe is gone from the property — the built entry it kept is at
    // index 0, not 1
    expect(() =>
      open({ type: 'LinearGenomeView', tracks: ['genes', built] }),
    ).toThrow('/view/tracks/0')
  })
})

describe('the highlight discriminator', () => {
  const persisted = { refName: 'chr1', start: 1, end: 2, assemblyName: 'hg38' }

  test('a string needs the assembly manager, so it launches', () => {
    expect(
      open({ type: 'LinearGenomeView', highlight: ['chr1:1-100'] }).launch,
    ).toEqual({ highlight: ['chr1:1-100'] })
  })

  test('an object is the persisted shape and stays on the property', () => {
    const view = open({ type: 'LinearGenomeView', highlight: [persisted] })
    expect(view.launch).toBeUndefined()
    expect(view.highlight).toHaveLength(1)
  })
})
