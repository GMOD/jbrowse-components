import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'

import type { CircularViewModel } from './model.ts'

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
    'CircularView',
    snap,
  )) as CircularViewModel
}

test('a launch key written on the view object reaches the launch state', async () => {
  const view = await open({
    assembly: 'volvox',
    displayedRegionNames: ['ctgA'],
    tracks: ['sv'],
  })
  expect(view.launch).toEqual({
    assembly: 'volvox',
    displayedRegionNames: ['ctgA'],
    tracks: ['sv'],
  })
  expect(warnings()).toEqual([])
})

// Nothing in this view's launch path mentions any of these names: the partition
// leaves a declared property on the snapshot and MST restores it. Before it,
// `applyInit` interpreted three keys and dropped every other one in silence.
test('a declared property lands natively, named nowhere in the launch path', async () => {
  const view = await open({
    assembly: 'volvox',
    paddingPx: 12,
    spacingPx: 3,
    autoFit: false,
    minVisibleWidth: 9,
  })
  expect(view.paddingPx).toBe(12)
  expect(view.spacingPx).toBe(3)
  expect(view.autoFit).toBe(false)
  expect(view.minVisibleWidth).toBe(9)
  expect(view.launch).toEqual({ assembly: 'volvox' })
})

describe('the v4 nested form', () => {
  const DEPRECATED =
    'CircularView nests its settings under "init", which is deprecated: write every setting directly on the view object.'

  test('a nested spec launches, and says the spelling is deprecated', async () => {
    const nested = await open({ init: { assembly: 'volvox', tracks: ['sv'] } })
    expect(nested.launch).toEqual({
      assembly: 'volvox',
      tracks: ['sv'],
      legacyInit: true,
    })
    expect(nested.pendingLaunch).toBeDefined()
    expect(warnings()).toContain(DEPRECATED)
  })

  test('a declared property nested inside it lands', async () => {
    const view = await open({ init: { assembly: 'volvox', paddingPx: 12 } })
    expect(view.paddingPx).toBe(12)
    expect(warnings()).toEqual([DEPRECATED])
  })
})

test('a key naming neither a launch key nor a property is named on attach', async () => {
  await open({ assembly: 'volvox', displayedRegionName: 'ctgA' })
  expect(warnings()).toContain(
    'CircularView ignored unknown key(s): displayedRegionName',
  )
})

test('an unknown key is reported once', async () => {
  await open({ displayedRegionName: 'ctgA' })
  expect(warnings()).toHaveLength(1)
})

// Read as work to do, `initialized` waits on an assembly nobody named — the
// circle sits on its spinner instead of dropping to the import form.
test('a typo alone leaves nothing pending', async () => {
  const view = await open({ displayedRegionName: 'ctgA' })
  expect(view.launch).toEqual({ unknown: { displayedRegionName: 'ctgA' } })
  expect(view.pendingLaunch).toBeUndefined()
  expect(view.hasSomethingToShow).toBe(false)
  view.setWidth(800)
  expect(view.initialized).toBe(true)
  expect(view.showLoading).toBe(false)
  expect(view.showImportForm).toBe(true)
})

// A blob naming tracks and no assembly has nothing to wait on. Read as naming
// one, `initialized` waits on an assembly that does not exist and `error`
// reports a name nobody wrote.
test('a launch blob that names no assembly waits on nothing', async () => {
  const view = await open({ tracks: ['sv'] })
  expect(view.launch).toEqual({ tracks: ['sv'] })
  expect(view.error).toBeUndefined()
  expect(view.loadingAssembly).toBeUndefined()
})

describe('the track entries discriminator', () => {
  const built = { type: 'VariantTrack', configuration: 'sv', displays: [] }

  test('a recipe entry is a launch key', async () => {
    const view = await open({ assembly: 'volvox', tracks: ['sv'] })
    expect(view.launch).toEqual({ assembly: 'volvox', tracks: ['sv'] })
    expect(view.tracks).toHaveLength(0)
  })

  test('an object naming a trackId is a recipe too', async () => {
    const entry = { trackId: 'sv', strokeColor: 'red' }
    const view = await open({ assembly: 'volvox', tracks: [entry] })
    expect(view.launch).toEqual({ assembly: 'volvox', tracks: [entry] })
    expect(view.tracks).toHaveLength(0)
  })

  test('a built track snapshot stays on the state property', async () => {
    const view = await open({ assembly: 'volvox', tracks: [built] })
    expect(view.launch).toEqual({ assembly: 'volvox' })
    expect(view.tracks).toHaveLength(1)
  })

  test('a mixed array splits per entry', async () => {
    const view = await open({ assembly: 'volvox', tracks: ['sv', built] })
    expect(view.launch).toEqual({ assembly: 'volvox', tracks: ['sv'] })
    expect(view.tracks).toHaveLength(1)
  })
})

// Kept only while there is nothing on screen, so an autosave firing mid-load
// can still rebuild the figure instead of dropping to the import form.
test('the launch state is not persisted once the circle has regions', async () => {
  expect(getSnapshot(await open({ assembly: 'volvox' })).launch).toBeDefined()
  const drawn = await open({
    assembly: 'volvox',
    displayedRegions: [
      { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
    ],
  })
  expect(getSnapshot(drawn).launch).toBeUndefined()
})
