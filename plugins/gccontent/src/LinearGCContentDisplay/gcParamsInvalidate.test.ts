import PluginManager from '@jbrowse/core/PluginManager'
import { types } from '@jbrowse/mobx-state-tree'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import WigglePlugin from '@jbrowse/plugin-wiggle'

import GCContentPlugin from '../index.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// The three GC parameters reach the worker through `adapterConfig`, not as
// top-level RPC args — and `adapterConfig` is a structural arg, deliberately
// absent from the invalidation key. So the ONLY thing that makes a changed
// window size or GC mode refetch is their presence in `rpcProps()`, which
// `SettingsInvalidate` watches via `rpcPropsCacheKey`.
//
// They used to sit outside it, with `setGCMode` / `setGCContentParams` each
// calling `reload()` by hand. That covered the track menu and nothing else: any
// other writer of the slots (the config editor, a session patch) left the
// previous GC curve on screen with no error. Pinning the cache key rather than
// the setters is what keeps that from coming back.
function createDisplay() {
  const pluginManager = new PluginManager([
    new LinearGenomeViewPlugin(),
    new WigglePlugin(),
    new GCContentPlugin(),
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)
  const trackConfig = pluginManager.pluggableConfigSchemaType('track').create(
    {
      type: 'GCContentTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      adapter: {
        type: 'GCContentAdapter',
        sequenceAdapter: { type: 'IndexedFastaAdapter' },
      },
    },
    { pluginManager },
  )

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    // `rpcManager` + `configuration` are what `isSessionModel` looks for, and
    // `getSession` walks the tree for it — without one, reading `parentTrack`
    // from a display throws.
    .volatile(() => ({
      rpcManager: { call: jest.fn() },
      // `setDisplayedRegions` arms the view's reactions, which ask whether
      // the region's assembly has loaded before they run
      assemblyManager: { get: () => ({ initialized: true }) },
    }))
    .views(() => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
      },
      // every promotable-slot read walks the cascade through this; nothing is
      // promoted in these tests, so every display resolves to its promotedBase
      getDisplayTypeDefault() {
        return undefined
      },
    }))
    .actions(self => ({
      setView(view: Instance<typeof LinearGenomeModel>) {
        self.view = view
        return view
      },
    }))

  const session = Session.create({ configuration: {} }, { pluginManager })
  const view = session.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [
        {
          type: 'GCContentTrack',
          configuration: 'test_track',
          displays: [{ type: 'LinearGCContentTrackDisplay' }],
        },
      ],
    }),
  )
  return { view, display: view.tracks[0]!.displays[0]! }
}

test('each GC parameter is a cache key, so changing it invalidates the fetch', () => {
  const { display } = createDisplay()
  const initial = display.rpcPropsCacheKey

  display.setGCMode('skew')
  const afterMode = display.rpcPropsCacheKey
  expect(afterMode).not.toBe(initial)

  display.setGCContentParams({ windowSize: 50, windowDelta: 100 })
  const afterWindowSize = display.rpcPropsCacheKey
  expect(afterWindowSize).not.toBe(afterMode)

  display.setGCContentParams({ windowSize: 50, windowDelta: 10 })
  expect(display.rpcPropsCacheKey).not.toBe(afterWindowSize)
})

// The step menu caps itself at the current windowSize, but that cap can't see a
// later shrink of windowSize itself — which the menu offers right above it.
test('windowDelta never outlives a windowSize shrunk below it', () => {
  const { display } = createDisplay()
  display.setGCContentParams({ windowSize: 1000, windowDelta: 1000 })
  display.setGCContentParams({ windowSize: 20 })
  expect(display.windowSize).toBe(20)
  expect(display.windowDelta).toBe(20)
})

test('setting one GC parameter leaves the other alone', () => {
  const { display } = createDisplay()
  display.setGCContentParams({ windowSize: 500, windowDelta: 25 })
  display.setGCContentParams({ windowSize: 400 })
  expect(display.windowDelta).toBe(25)
})

// GC content is a fraction, so its axis is the quantity's own range rather than
// whatever happens to be on screen; skew stays autoscaled because its real
// values occupy a small part of [-1,1].
test('content mode pins the score domain to [0,1], skew autoscales', () => {
  const { display } = createDisplay()
  expect([display.minScoreBound, display.maxScoreBound]).toEqual([0, 1])

  display.setGCMode('skew')
  expect([display.minScoreBound, display.maxScoreBound]).toEqual([
    undefined,
    undefined,
  ])
})

test('an explicit score bound still beats the pinned default', () => {
  const { display } = createDisplay()
  display.setMaxScore(0.75)
  expect(display.maxScoreBound).toBe(0.75)
  // the end left unset still falls back to the pinned domain
  expect(display.minScoreBound).toBe(0)
})

test('the GC parameters also reach the adapter config the worker resolves', () => {
  const { display } = createDisplay()
  display.setGCMode('skew')
  display.setGCContentParams({ windowSize: 50, windowDelta: 10 })

  expect(display.adapterConfig).toMatchObject({
    type: 'GCContentAdapter',
    gcMode: 'skew',
    windowSize: 50,
    windowDelta: 10,
  })
})

// The adapter computes GC from its three parameters alone and the wiggle RPC
// bins nothing for it, so the strict-bpPerPx key the wiggle base fetches under
// would only make every zoom inside a loaded region re-download the sequence.
test('a zoom inside a loaded region keeps the cache valid', () => {
  const { view, display } = createDisplay()
  const region = {
    refName: 'ctgA',
    start: 0,
    end: 50_000,
    assemblyName: 'volvox',
  }
  view.setWidth(800)
  view.setDisplayedRegions([region])
  display.loadedRegions.set(0, { ...region, fetchKey: display.regionFetchKey })
  expect(display.isCacheValid(0)).toBe(true)

  const before = view.bpPerPx
  view.zoomTo(before / 2)
  expect(view.bpPerPx).not.toBe(before)
  expect(display.isCacheValid(0)).toBe(true)
})
