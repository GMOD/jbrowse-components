import { isAlive } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { createCircularGenomeView } from './index.ts'

jest.mock('./makeWorkerInstance', () => () => {})
// Every assembly below is a config, so nothing here resolves a hub — this keeps
// it that way. Passing a hub NAME would make a unit test fetch over the network,
// and it is one character of difference from what these tests already write.
jest.mock('@jbrowse/core/util/fetchHub', () => ({ fetchHub: jest.fn() }))

function refSeq(refName: string, uniqueId: string, seq: string) {
  return { refName, uniqueId, start: 0, end: seq.length, seq }
}

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        refSeq('ctgA', 'firstId', 'cattgttgcggagttgaaca'),
        refSeq('ctgB', 'secondId', 'ACATGCTAGCTACGTGCATG'),
      ],
    },
  },
}

function variantTrack(trackId: string) {
  return {
    type: 'VariantTrack',
    trackId,
    name: trackId,
    assemblyNames: ['volvox'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  }
}

const shownIds = (view: { tracks: { configuration: { trackId: string } }[] }) =>
  view.tracks.map(t => t.configuration.trackId).sort()

const regionNames = (view: { displayedRegions: { refName: string }[] }) =>
  view.displayedRegions.map(r => r.refName)

// The circular view draws its whole figure from displayedRegions, and only the
// view's `init` blob can build them — an empty displayedRegions is the import
// form. So a controller that seeded nothing would mount to an empty ring.
test('the whole assembly is on the ring when no regions are named', async () => {
  const el = document.createElement('div')
  const controller = createCircularGenomeView(el, { assembly })
  const state = await controller.whenReady()
  const { view } = state.session
  // the init autorun waits on a measured width, which jsdom never supplies
  view.setWidth(800)

  await waitFor(() => {
    expect(regionNames(view)).toEqual(['ctgA', 'ctgB'])
  })
  controller.destroy()
})

test('displayedRegionNames restricts the ring at build time', async () => {
  const el = document.createElement('div')
  const controller = createCircularGenomeView(el, {
    assembly,
    displayedRegionNames: ['ctgB'],
  })
  const state = await controller.whenReady()
  const { view } = state.session
  view.setWidth(800)

  await waitFor(() => {
    expect(regionNames(view)).toEqual(['ctgB'])
  })
  controller.destroy()
})

// Re-stating the region names redraws the ring. It goes through the view's own
// `init` field rather than a setDisplayedRegions written here, so the alias and
// glob resolution is the one the URL and session-spec launches use.
test('update({ displayedRegionNames }) redraws the ring', async () => {
  const el = document.createElement('div')
  const controller = createCircularGenomeView(el, { assembly })
  const state = await controller.whenReady()
  const { view } = state.session
  view.setWidth(800)
  await waitFor(() => {
    expect(regionNames(view)).toEqual(['ctgA', 'ctgB'])
  })

  await controller.update({ displayedRegionNames: ['ctgB'] })
  await waitFor(() => {
    expect(regionNames(view)).toEqual(['ctgB'])
  })

  // an empty list is "the whole assembly", the same as never naming any
  await controller.update({ displayedRegionNames: [] })
  await waitFor(() => {
    expect(regionNames(view)).toEqual(['ctgA', 'ctgB'])
  })
  controller.destroy()
})

// The write door is declarative: a host states the track set it wants and the
// controller opens and closes to match, rather than the host diffing its own
// state into add/remove calls. Closing is the half that has to be stated — a
// list is a wanted set, not an addition.
test('update({ tracks }) opens what it names and closes what it omits', async () => {
  const el = document.createElement('div')
  const controller = createCircularGenomeView(el, { assembly, tracks: [] })
  const state = await controller.whenReady()
  const { view } = state.session

  await controller.update({ tracks: [variantTrack('t1')] })
  expect(shownIds(view)).toEqual(['t1'])

  await controller.update({ tracks: [variantTrack('t2')] })
  expect(shownIds(view)).toEqual(['t2'])

  await controller.update({ tracks: [] })
  expect(shownIds(view)).toEqual([])
  controller.destroy()
})

// A field the host leaves out of an update is left alone — otherwise a host
// that only re-states its region names would close every track by saying
// nothing about them.
test('a field an update omits is untouched', async () => {
  const el = document.createElement('div')
  const controller = createCircularGenomeView(el, {
    assembly,
    tracks: [variantTrack('t1')],
  })
  const state = await controller.whenReady()

  await controller.update({ displayedRegionNames: ['ctgB'] })
  expect(shownIds(state.session.view)).toEqual(['t1'])
  controller.destroy()
})

// An update that lands before the async build settles has to survive it: a
// notebook cell or a Shiny observer fires as soon as the widget is created,
// which is long before a hub fetch and an assembly load have finished.
test('an update before the build settles is applied when the engine arrives', async () => {
  const el = document.createElement('div')
  const controller = createCircularGenomeView(el, { assembly, tracks: [] })

  const updated = controller.update({ tracks: [variantTrack('t1')] })
  const state = await controller.whenReady()
  await updated

  expect(shownIds(state.session.view)).toEqual(['t1'])
  controller.destroy()
})

test('a full-config track seeds the catalog, not sessionTracks (no shadow copy)', async () => {
  const el = document.createElement('div')
  const controller = createCircularGenomeView(el, {
    assembly,
    tracks: [variantTrack('t1')],
  })
  const state = await controller.whenReady()

  expect(shownIds(state.session.view)).toEqual(['t1'])
  expect(state.session.sessionTracks).toHaveLength(0)
  controller.destroy()
})

// React unmount does not own the engine: without an explicit teardown the MST
// tree stays alive with its autoruns running and its RPC worker pool orphaned,
// which is a per-mount leak for hosts that mount and discard repeatedly (a
// Jupyter cell re-run, an SPA route change).
test('destroy tears down the engine, not just the React root', async () => {
  const controller = createCircularGenomeView(document.createElement('div'), {
    assembly,
  })
  const state = await controller.whenReady()
  const destroyDrivers = jest.spyOn(state.rpcManager, 'destroy')

  controller.destroy()

  expect(destroyDrivers).toHaveBeenCalled()
  expect(isAlive(state)).toBe(false)
})

test('destroy is idempotent, and works before the first build settles', async () => {
  const controller = createCircularGenomeView(document.createElement('div'), {
    assembly,
  })

  // StrictMode runs a ref callback's cleanup immediately after setup, so this
  // lands before the async build ever renders
  expect(() => {
    controller.destroy()
    controller.destroy()
  }).not.toThrow()
  await controller.whenReady()
})
