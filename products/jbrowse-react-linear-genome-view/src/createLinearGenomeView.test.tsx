import Plugin from '@jbrowse/core/Plugin'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import {
  ConfigurationSchema,
  hydrateTrackConfig,
  readConfObject,
} from '@jbrowse/core/configuration'
import { extendViewType } from '@jbrowse/core/pluggableElementTypes'
import TextSearchAdapterType from '@jbrowse/core/pluggableElementTypes/TextSearchAdapterType'
import { resolveUriLocation } from '@jbrowse/core/util/io'
import { suppressTeardownNoise } from '@jbrowse/display-test-utils'
import {
  getEnv,
  getSnapshot,
  isAlive,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { createLinearGenomeView } from './index.ts'

import type { LinearGenomeViewController, ViewModel } from './index.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { UriLocation } from '@jbrowse/core/util'
import type { TrackInput } from '@jbrowse/product-core'

jest.mock('./makeWorkerInstance', () => () => {})
// Every assembly below is a config, so nothing here resolves a hub — this keeps
// it that way. Passing a hub NAME would make a unit test fetch over the network,
// and it is one character of difference from what these tests already write.
jest.mock('@jbrowse/core/util/fetchHub', () => ({ fetchHub: jest.fn() }))

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'firstId',
          start: 0,
          end: 10,
          seq: 'cattgttgcg',
        },
      ],
    },
  },
}

function featureTrack(trackId: string) {
  return {
    type: 'FeatureTrack',
    trackId,
    name: trackId,
    assemblyNames: ['volvox'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  }
}

// same shape, minus assemblyNames — what a host that leaves the assembly to the
// view sends
function unstampedTrack(trackId: string) {
  const { assemblyNames, ...rest } = featureTrack(trackId)
  return rest
}

const shownIds = (view: { tracks: { configuration: { trackId: string } }[] }) =>
  view.tracks.map(t => t.configuration.trackId).sort()

const assemblyNamesOf = (
  session: { getTrackById: (id: string) => unknown },
  trackId: string,
) =>
  (session.getTrackById(trackId) as { assemblyNames: string[] }).assemblyNames

suppressTeardownNoise()

test('a full-config track seeds the catalog, not sessionTracks (no shadow copy)', async () => {
  const el = document.createElement('div')
  const controller = createLinearGenomeView(el, {
    assembly,
    tracks: [featureTrack('t1')],
  })
  const state = await controller.whenReady()

  // the track shows once, and it stays a catalog track — re-adding a config
  // already in the catalog must not push a duplicate into sessionTracks
  expect(shownIds(state.session.view)).toEqual(['t1'])
  expect(state.session.sessionTracks).toHaveLength(0)
  controller.destroy()
})

// The `tracks` option and `update({ tracks })` are the same statement, made at
// two times: the build applies the option through the same reconcile a later
// update goes through.
test('the declared tracks are the ones shown', async () => {
  const el = document.createElement('div')
  const controller = createLinearGenomeView(el, {
    assembly,
    tracks: [featureTrack('t1'), featureTrack('t2')],
  })
  const state = await controller.whenReady()

  expect(shownIds(state.session.view)).toEqual(['t1', 't2'])
  // seeded into the config catalog, so opening them adds no session tracks
  expect(state.session.sessionTracks).toHaveLength(0)
  controller.destroy()
})

// The write door is declarative: a host states the track set it wants and the
// controller opens and closes to match, rather than the host diffing its own
// state into add/remove calls. Closing is the half that has to be stated —
// a list is a wanted set, not an addition.
test('update({ tracks }) opens what it names and closes what it omits', async () => {
  const el = document.createElement('div')
  const controller = createLinearGenomeView(el, { assembly, tracks: [] })
  const state = await controller.whenReady()
  const { view } = state.session

  await controller.update({ tracks: [featureTrack('t1')] })
  expect(shownIds(view)).toEqual(['t1'])

  await controller.update({ tracks: [featureTrack('t2')] })
  expect(shownIds(view)).toEqual(['t2'])

  await controller.update({ tracks: [] })
  expect(shownIds(view)).toEqual([])
  controller.destroy()
})

// A field the host leaves out of an update is left alone. Without this a host
// that only knows where it wants to look — the common case for a location
// callback wired to a search box — would close every track by saying nothing
// about them.
test('a field an update omits is untouched', async () => {
  const el = document.createElement('div')
  const controller = createLinearGenomeView(el, {
    assembly,
    tracks: [featureTrack('t1')],
  })
  const state = await controller.whenReady()

  await controller.update({ location: 'ctgA:1-5' })
  expect(shownIds(state.session.view)).toEqual(['t1'])

  await controller.update({})
  expect(shownIds(state.session.view)).toEqual(['t1'])
  controller.destroy()
})

// The engine being built is not the assembly being loaded, and a host sets a
// location as soon as it has a widget. A bare navToLocString there resolves
// refNames against an assembly that has none yet and throws into an unhandled
// rejection; stating it through the view's `launch` waits instead.
test('update({ location }) before the assembly loads navigates once it has', async () => {
  const el = document.createElement('div')
  // its own longer contig: at 800px a 5bp request on the 10bp ctgA above clamps
  // to the whole thing, so the assertion could not tell a navigation from the
  // whole-assembly fallback
  const controller = createLinearGenomeView(el, {
    assembly: {
      ...assembly,
      sequence: {
        ...assembly.sequence,
        adapter: {
          type: 'FromConfigSequenceAdapter',
          features: [
            {
              refName: 'ctgA',
              uniqueId: 'firstId',
              start: 0,
              end: 4000,
              seq: 'a'.repeat(4000),
            },
          ],
        },
      },
    },
  })
  const state = await controller.whenReady()
  const { view } = state.session
  view.setWidth(800)

  await controller.update({ location: 'ctgA:1-400' })
  await waitFor(() => {
    expect(view.visibleLocStrings).toBe('ctgA:1..400')
  })
  controller.destroy()
})

// An update that lands before the async build settles has to survive it: a
// notebook cell or a Shiny observer fires as soon as the widget is created,
// which is long before a hub fetch and an assembly load have finished.
test('an update before the build settles is applied when the engine arrives', async () => {
  const el = document.createElement('div')
  const controller = createLinearGenomeView(el, { assembly, tracks: [] })

  const updated = controller.update({ tracks: [featureTrack('t1')] })
  const state = await controller.whenReady()
  await updated

  expect(shownIds(state.session.view)).toEqual(['t1'])
  controller.destroy()
})

// Hosts (R htmlwidgets, anywidget, vanilla JS) hand over track configs without
// an assemblyNames, leaving it to the view — which knows the resolved name even
// when the assembly arrived as a hub name it had to fetch. That stamping has to
// cover the tracks that arrive after mount too: those never pass through the
// build() catalog seed, so before this they reached addTrackConf bare and
// silently never displayed.
test('assemblyNames is stamped onto full configs arriving after mount', async () => {
  const el = document.createElement('div')
  const controller = createLinearGenomeView(el, { assembly, tracks: [] })
  const state = await controller.whenReady()
  const { session } = state

  await controller.update({ tracks: [unstampedTrack('t1')] })
  expect(assemblyNamesOf(session, 't1')).toEqual(['volvox'])

  await controller.update({
    tracks: [unstampedTrack('t1'), unstampedTrack('t2')],
  })
  expect(assemblyNamesOf(session, 't2')).toEqual(['volvox'])
  expect(shownIds(session.view)).toEqual(['t1', 't2'])
  controller.destroy()
})

// A worker started from a blob: URL has no base to resolve a relative path
// against, so the location has to arrive carrying the page's
function resolvedUri(session: ViewModel['session'], trackId: string) {
  const { pluginManager } = getEnv<{ pluginManager: PluginManager }>(session)
  const conf = session.getTrackById(trackId)
  const snapshot = isStateTreeNode(conf) ? getSnapshot(conf) : conf
  const { bedGzLocation } = readConfObject(
    hydrateTrackConfig(pluginManager, snapshot as Record<string, unknown>)!,
    'adapter',
  ) as { bedGzLocation: UriLocation }
  return resolveUriLocation(bedGzLocation).uri
}

const pageUrl = (path: string) => new URL(path, document.baseURI).href

test('relative uris in the options resolve against the page for the worker', async () => {
  const el = document.createElement('div')
  const controller = createLinearGenomeView(el, {
    assembly,
    makeWorkerInstance: () => ({}) as Worker,
    tracks: [
      {
        ...featureTrack('full'),
        adapter: { type: 'BedTabixAdapter', uri: 'data/full.bed.gz' },
      },
    ],
  })
  const { session } = await controller.whenReady()
  await controller.update({
    tracks: ['full', 'data/loose.bed.gz'],
  })

  expect(resolvedUri(session, 'full')).toBe(pageUrl('data/full.bed.gz'))
  const loose = session.view.tracks
    .map(t => t.configuration.trackId)
    .find(id => id !== 'full')!
  expect(resolvedUri(session, loose)).toBe(pageUrl('data/loose.bed.gz'))
  controller.destroy()
})

class GeneIndexPlugin extends Plugin {
  name = 'GeneIndexPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addTextSearchAdapterType(
      () =>
        new TextSearchAdapterType({
          name: 'GeneIndex',
          configSchema: ConfigurationSchema(
            'GeneIndex',
            { assemblyNames: { type: 'stringArray', defaultValue: [] } },
            { explicitlyTyped: true },
          ),
          AdapterClass: class {
            async searchIndex() {
              return [
                new BaseResult({
                  label: 'geneA',
                  locString: 'ctgA:100..300',
                  trackId: 'hub_genes',
                }),
              ]
            }
          } as unknown as AnyAdapter,
        }),
    )
  }
}

const hub = {
  assemblies: [
    {
      ...assembly,
      sequence: {
        ...assembly.sequence,
        adapter: {
          type: 'FromConfigSequenceAdapter',
          features: [
            {
              refName: 'ctgA',
              uniqueId: 'firstId',
              start: 0,
              end: 4000,
              seq: 'a'.repeat(4000),
            },
          ],
        },
      },
    },
  ],
  tracks: [
    {
      ...featureTrack('hub_genes'),
      adapter: {
        type: 'FromConfigAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'g',
            start: 99,
            end: 300,
            name: 'geneA',
          },
        ],
      },
    },
    featureTrack('hub_other'),
    {
      type: 'SyntenyTrack',
      trackId: 'hub_liftover',
      assemblyNames: ['volvox', 'otherGenome'],
      adapter: { type: 'PairwiseIndexedPAFAdapter', uri: 'x.pif.gz' },
    },
  ],
  aggregateTextSearchAdapters: [
    {
      type: 'GeneIndex',
      assemblyNames: ['volvox'],
    },
  ],
}

async function launchAtGene(tracks: TrackInput[]) {
  const controller = createLinearGenomeView(document.createElement('div'), {
    assembly: hub,
    location: 'geneA',
    tracks,
    plugins: [GeneIndexPlugin],
  })
  const state = await controller.whenReady()
  const { view } = state.session
  view.setWidth(800)
  await waitFor(() => {
    expect(view.visibleLocStrings).toContain('ctgA:')
  })
  return { controller, session: state.session }
}

test("a hub's tracks seed the catalog, and a string naming one opens it", async () => {
  const controller = createLinearGenomeView(document.createElement('div'), {
    assembly: hub,
    tracks: ['hub_other'],
    plugins: [GeneIndexPlugin],
  })
  const state = await controller.whenReady()

  expect(state.session.getTrackById('hub_genes')).toBeTruthy()
  expect(shownIds(state.session.view)).toEqual(['hub_other'])
  expect(state.session.sessionTracks).toHaveLength(0)
  controller.destroy()
})

test("a gene-name location with no tracks of the host's opens the hub track the hit names", async () => {
  const { controller, session } = await launchAtGene([])

  await waitFor(() => {
    expect(shownIds(session.view)).toEqual(['hub_genes'])
  })
  expect(session.snackbarMessages).toHaveLength(0)
  controller.destroy()
})

test('a gene-name location leaves a host that lists its own tracks with only those', async () => {
  const { controller, session } = await launchAtGene([featureTrack('t1')])

  expect(shownIds(session.view)).toEqual(['t1'])
  await controller.update({ location: 'geneA' })
  await waitFor(() => {
    expect(session.view.launch).toBeUndefined()
  })
  expect(shownIds(session.view)).toEqual(['t1'])
  expect(session.snackbarMessages).toHaveLength(0)
  controller.destroy()
})

// (that an explicit assemblyNames survives the stamp is withAssemblyName's own
// test — asserting it here would need a track pinned to an assembly this view
// has never heard of, which is just a resolution error in disguise)

// React unmount does not own the engine: without an explicit teardown the MST
// tree stays alive with its autoruns running and its RPC worker pool orphaned,
// which is a per-mount leak for hosts that mount and discard repeatedly (a
// Jupyter cell re-run, an SPA route change).
test('destroy tears down the engine, not just the React root', async () => {
  const controller = createLinearGenomeView(document.createElement('div'), {
    assembly,
  })
  const state = await controller.whenReady()
  const destroyDrivers = jest.spyOn(state.rpcManager, 'destroy')

  controller.destroy()

  expect(destroyDrivers).toHaveBeenCalled()
  expect(isAlive(state)).toBe(false)
})

test('destroy is idempotent, and works before the first build settles', async () => {
  const controller = createLinearGenomeView(document.createElement('div'), {
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

test('destroy while the first tracks open leaves no engine behind', async () => {
  const onError = jest.fn()
  let controller: LinearGenomeViewController | undefined
  class DestroyOnLaunch extends Plugin {
    name = 'DestroyOnLaunch'
    install(pluginManager: PluginManager) {
      extendViewType(pluginManager, 'LinearGenomeView', stateModel =>
        stateModel.actions(self => {
          const launchTrack = self.launchTrack
          return {
            launchTrack(trackId: string) {
              controller?.destroy()
              return launchTrack(trackId)
            },
          }
        }),
      )
    }
  }
  controller = createLinearGenomeView(document.createElement('div'), {
    assembly,
    tracks: [featureTrack('t1')],
    plugins: [DestroyOnLaunch],
    onError,
  })

  const state = await controller.whenReady()

  expect(isAlive(state)).toBe(false)
  expect(onError).not.toHaveBeenCalled()
})

// A host swapping genomes now destroys the controller and creates another,
// which is what setAssembly did internally. What has to hold for that to be a
// real replacement rather than a leak: the first engine is dead and its worker
// pool with it, and the second is alive and independent. Two controllers over
// the same element, since that is the host's actual sequence.
test('destroying a controller and creating another swaps the genome cleanly', async () => {
  const el = document.createElement('div')
  const first = createLinearGenomeView(el, { assembly })
  const firstState = await first.whenReady()
  first.destroy()

  const second = createLinearGenomeView(el, {
    assembly: { ...assembly, name: 'volvox2' },
  })
  const secondState = await second.whenReady()

  expect(secondState).not.toBe(firstState)
  expect(isAlive(firstState)).toBe(false)
  expect(isAlive(secondState)).toBe(true)
  expect(secondState.session.assemblyNames).toEqual(['volvox2'])
  second.destroy()
})
