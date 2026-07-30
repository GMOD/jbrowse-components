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
    }))
    .views(() => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
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
  return view.tracks[0]!.displays[0]!
}

test('each GC parameter is a cache key, so changing it invalidates the fetch', () => {
  const display = createDisplay()
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

test('the GC parameters also reach the adapter config the worker resolves', () => {
  const display = createDisplay()
  display.setGCMode('skew')
  display.setGCContentParams({ windowSize: 50, windowDelta: 10 })

  expect(display.adapterConfig).toMatchObject({
    type: 'GCContentAdapter',
    gcMode: 'skew',
    windowSize: 50,
    windowDelta: 10,
  })
})
