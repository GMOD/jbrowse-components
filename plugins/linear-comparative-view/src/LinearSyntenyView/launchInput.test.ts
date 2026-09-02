import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'

import type { LinearSyntenyViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

let warn: jest.SpyInstance

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
})

const warnings = () => warn.mock.calls.map(c => `${c[0]}`)

async function open(snap: Record<string, unknown>) {
  return (await createTestSession().launchView(
    'LinearSyntenyView',
    snap,
  )) as LinearSyntenyViewModel
}

const ROWS = [{ assembly: 'volvox' }, { assembly: 'volvox2' }]

test('a launch key written on the view object reaches the launch state', async () => {
  const view = await open({
    views: ROWS,
    tracks: ['a_track'],
    levelHeights: [200],
  })
  expect(view.launch).toEqual({
    views: ROWS,
    tracks: ['a_track'],
    levelHeights: [200],
  })
  expect(warnings()).toEqual([])
})

// The gap the partition closed: a property was authorable only once someone
// wrote an arm for it, and `drawLocationMarkers` shipped without one. None of
// these names is mentioned in this plugin's launch code at all.
test('any declared property lands natively, named nowhere in the launch path', async () => {
  const view = await open({
    views: ROWS,
    opacityByIdentity: true,
    lodMode: 'coarse',
    overdrawPx: 42,
    cigarMode: 'matches',
    alpha: 0.55,
  })
  expect(view.opacityByIdentity).toBe(true)
  expect(view.lodMode).toBe('coarse')
  expect(view.overdrawPx).toBe(42)
  expect(view.cigarMode).toBe('matches')
  expect(view.alpha).toBe(0.55)
  expect(view.launch).toEqual({ views: ROWS })
})

test('a property a composed mixin contributes lands too', async () => {
  const view = await open({
    views: ROWS,
    colorBy: 'query',
    showColorLegend: true,
  })
  expect(view.colorBy).toBe('query')
  expect(view.showColorLegend).toBe(true)
})

test('an omitted property keeps its default', async () => {
  const view = await open({ views: ROWS })
  expect(view.cigarMode).toBe('full')
  // nothing customized, nothing promoted; straight is the promotedBase
  expect(view.effectiveDrawCurves).toBe(false)
})

describe('the v4 nested form', () => {
  const DEPRECATED =
    'LinearSyntenyView nests its settings under "init", which is deprecated: write every setting directly on the view object.'

  test('a nested spec launches, and says the spelling is deprecated', async () => {
    const nested = await open({ init: { views: ROWS, tracks: ['a_track'] } })
    expect(nested.launch).toEqual({
      views: ROWS,
      tracks: ['a_track'],
      legacyInit: true,
    })
    expect(nested.pendingLaunch).toBeDefined()
    expect(warnings()).toContain(DEPRECATED)
  })

  // The v4 demos wrote `"init": { "colorBy": "reference", … }` and v4 applied
  // it, so unwrapping has to reach a declared property too.
  test('a declared property nested inside it lands', async () => {
    const view = await open({ init: { views: ROWS, colorBy: 'reference' } })
    expect(view.colorBy).toBe('reference')
    expect(warnings()).toEqual([DEPRECATED])
  })
})

test('a key naming neither a launch key nor a property is named on attach', async () => {
  await open({ views: ROWS, drawCurvez: true })
  expect(warnings()).toContain(
    'LinearSyntenyView ignored unknown key(s): drawCurvez',
  )
})

test('an unknown key is reported once', async () => {
  await open({ drawCurvez: true })
  expect(warnings()).toHaveLength(1)
})

// Read as work to do, `hasSomethingToShow` is true with no rows coming and the
// view sits on its spinner rather than dropping to the import form.
test('a typo alone leaves nothing pending', async () => {
  const view = await open({ drawCurvez: true })
  expect(view.launch).toEqual({ unknown: { drawCurvez: true } })
  expect(view.pendingLaunch).toBeUndefined()
  expect(view.hasSomethingToShow).toBe(false)
})

describe('the rows discriminator', () => {
  const built = {
    type: 'LinearGenomeView',
    displayedRegions: [
      { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
    ],
  }

  test('a row carrying `type` is a built snapshot MST restores', async () => {
    const view = await open({ views: [built, built] })
    expect(view.launch).toBeUndefined()
    expect(view.views).toHaveLength(2)
  })

  test('a row without one is a recipe the launcher opens', async () => {
    const view = await open({ views: ROWS })
    expect(view.launch).toEqual({ views: ROWS })
    expect(view.views).toHaveLength(0)
  })

  // `views: [{}, {}]` is the deliberate request for the import form, and the
  // only route to it from a session spec.
  test('two empty rows are recipes, not built rows', async () => {
    const view = await open({ views: [{}, {}] })
    expect(view.launch).toEqual({ views: [{}, {}] })
    expect(view.views).toHaveLength(0)
  })

  test('a mixed list is refused whole rather than split', async () => {
    const view = await open({ views: [built, { assembly: 'volvox2' }] })
    expect(view.views).toHaveLength(0)
    expect(view.launch?.views).toBeUndefined()
    expect(view.pendingLaunch).toBeUndefined()
    expect(warnings()).toContain(
      'LinearSyntenyView refused views: the list mixes built view snapshots with recipes to open one, and the rows index against the levels between them. Write all of them one way.',
    )
  })
})

// LinearComparativeView converts a pre-`levels` snapshot's top-level `tracks`
// into a level, and a composed base's preprocessor runs AFTER everything the
// subclass adds — so the lift has to happen first or a spec's per-level trackId
// list becomes `levels[0].tracks` and is never opened.
test('the tracks lift wins over the base pre-levels conversion', async () => {
  const view = await open({ views: ROWS, tracks: [['a_track']] })
  expect(view.launch).toEqual({ views: ROWS, tracks: [['a_track']] })
  expect(getSnapshot(view).levels).toEqual([])
})
