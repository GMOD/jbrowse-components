import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import {
  displayTestSessionModel,
  testAssembly,
} from '@jbrowse/display-test-utils'
import { types } from '@jbrowse/mobx-state-tree'
import { linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory } from '@jbrowse/plugin-linear-genome-view'

import { configSchemaFactory } from './configSchema.ts'
import { stateModelFactory } from './model.ts'

import type { MultiWaySyntenyDisplayModel } from './model.ts'

/**
 * A real MultiWaySyntenyDisplay on a SyntenyTrack, in a real LGV, beside a
 * GFF3 gene track for the anchor assembly — which is what makes
 * `laneGeneAdapters` find a lane adapter and therefore what gives
 * `laneGenesFetchSpecs` a non-empty spec list. Everything the phase and the
 * reload gate are about is downstream of that list being non-empty, so a mock
 * would be reimplementing the thing under test.
 *
 * **Read the display synchronously.** `afterAttach` reaches its installers
 * through a dynamic import, so nothing is in flight until the microtask
 * queue runs — which is what lets these drive the committed keys by hand
 * rather than racing a fetch that has no worker behind it.
 */
export function createDisplay() {
  return createDisplayWithSession().display
}

/** the same display, with the harness session it lives in for its snackbars */
const HELD_ASSEMBLIES = new Set(['volvox', 'volvox_random', 'volvox_ins'])

export function createDisplayWithSession() {
  const pluginManager = new PluginManager()
  const configSchema = configSchemaFactory()

  // Config-only: `laneGeneAdapters` matches on the adapter's TYPE NAME, and an
  // unregistered one reads back as an empty config rather than failing
  for (const name of ['MCScanBlocksAdapter', 'Gff3TabixAdapter']) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name,
          configSchema: ConfigurationSchema(
            name,
            {},
            { explicitlyTyped: true },
          ),
          getAdapterClass: () => {
            throw new Error(`${name} is config-only in tests`)
          },
        }),
    )
  }

  // FeatureTrack as well as the synteny one: `laneGeneAdapters` picks a lane's
  // annotation out of the session's tracks, so the gene track has to be a real
  // config of a real type for it to find.
  //
  // Built INSIDE the callback, the way a plugin does it: `createBaseTrackConfig`
  // resolves the adapter union at the moment it runs, and run eagerly out here
  // that union is still empty — every adapter config then reads back as `{}`
  // and no lane ever finds a gene track.
  for (const name of ['SyntenyTrack', 'FeatureTrack']) {
    pluginManager.addTrackType(() => {
      const trackConfigSchema = ConfigurationSchema(
        name,
        {},
        {
          baseConfiguration: createBaseTrackConfig(pluginManager),
          explicitIdentifier: 'trackId',
        },
      )
      return new TrackType({
        name,
        configSchema: trackConfigSchema,
        stateModel: createBaseTrackModel(
          pluginManager,
          name,
          trackConfigSchema,
        ),
      })
    })
  }

  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'MultiWaySyntenyDisplay',
        configSchema,
        stateModel: stateModelFactory(configSchema),
        trackType: 'SyntenyTrack',
        viewType: 'LinearGenomeView',
        // never rendered here; this harness exercises the model
        ReactComponent: () => null,
      }),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const trackSchema = pluginManager.pluggableConfigSchemaType('track')
  const syntenyTrack = trackSchema.create(
    {
      type: 'SyntenyTrack',
      trackId: 'multiway_track',
      assemblyNames: ['volvox', 'volvox_random'],
      adapter: { type: 'MCScanBlocksAdapter' },
    },
    { pluginManager },
  )
  // the anchor's own gene track: one assembly, a Gff3 adapter — the two things
  // `laneGeneAdapters` matches on
  const geneTrack = trackSchema.create(
    {
      type: 'FeatureTrack',
      trackId: 'volvox_genes',
      assemblyNames: ['volvox'],
      adapter: { type: 'Gff3TabixAdapter' },
    },
    { pluginManager },
  )

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)
  const Session = types.compose(
    'MultiWaySyntenyTestSession',
    displayTestSessionModel({
      viewModel: LinearGenomeModel,
      // the installers reach a real RPC once the microtask queue runs; these
      // read the display synchronously, so this only has to exist
      rpcManager: { call: async () => [] },
      assemblyManager: {
        get: () => testAssembly(),
        // the dependent lane fetches canonicalize their regions through this
        // before the RPC; without it a test that commits features watches them
        // fail on a TypeError a lane's own error handling then swallows
        waitForAssembly: () => Promise.resolve(testAssembly()),
        getCanonicalAssemblyName: () => undefined,
        // an all-vs-all file's other samples are lanes the session cannot
        // navigate or fetch against
        has: (name: string) => HELD_ASSEMBLIES.has(name),
        // a re-anchor is `navToLocString` on the hosting view, which asks
        // this to tell a refName from a locstring; always-true reads every
        // locstring as ambiguous
        isValidRefName: (refName: string) => refName === 'ctgA',
      },
      getTrackById: (id: string) =>
        id === 'multiway_track' ? syntenyTrack : undefined,
    }),
    types.model({}).volatile(() => ({ tracks: [syntenyTrack, geneTrack] })),
  )

  const session = Session.create({ configuration: {} }, { pluginManager })
  const view = session.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [
        {
          type: 'SyntenyTrack',
          configuration: 'multiway_track',
          displays: [{ type: 'MultiWaySyntenyDisplay' }],
        },
      ],
    }),
  )
  view.setWidth(800)
  view.setDisplayedRegions([
    { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
  ])
  return {
    display: view.tracks[0]!.displays[0]! as MultiWaySyntenyDisplayModel,
    session,
  }
}
