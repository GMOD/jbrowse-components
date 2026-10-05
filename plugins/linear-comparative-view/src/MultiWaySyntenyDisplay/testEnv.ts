import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
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
import { observable } from 'mobx'

import { NO_OPS } from './alignmentOps.ts'
import { configSchemaFactory } from './configSchema.ts'
import { stateModelFactory } from './model.ts'

import type { HeldLane, LaneFetchSpec } from './laneFetch.ts'
import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type { AssemblyDescription } from '@jbrowse/core/PluginManager'
import type { ConfigurationSchemaDefinition } from '@jbrowse/core/configuration'
import type {
  Alias,
  BaseRefNameAliasAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { AnimationMode } from '@jbrowse/core/util'
import type { TestAssembly } from '@jbrowse/display-test-utils'

export function heldSpecs(
  held: ReadonlyMap<string, HeldLane>,
): LaneFetchSpec[] {
  return [...held].map(([lane, { key }]) => ({
    lane,
    key,
    assemblyName: lane.split(/[|\0]/)[0]!,
  }))
}

// read it synchronously: no fetch starts until afterAttach's dynamic import lands
export function createDisplay() {
  return createDisplayWithSession().display
}

const HELD_ASSEMBLIES = new Set(['volvox', 'volvox_random', 'volvox_ins'])

export interface GeneTrackSpec {
  trackId: string
  assemblyNames: string[]
}

export type RpcCall = (
  functionName: string,
  args: Record<string, unknown>,
) => Promise<unknown>

export function createDisplayWithSession({
  syntenyAdapter = { type: 'MCScanBlocksAdapter' },
  trackAssemblyNames = ['volvox', 'volvox_random'],
  geneTracks = [{ trackId: 'volvox_genes', assemblyNames: ['volvox'] }],
  connectionGeneTracks = [],
  rpc = async () => [],
  assemblyAliases = {},
  assemblyOf = () => testAssembly(),
  animationMode = 'enabled',
  describeAssemblies,
  copies = 1,
}: {
  copies?: number
  syntenyAdapter?: Record<string, unknown>
  trackAssemblyNames?: string[]
  geneTracks?: GeneTrackSpec[]
  connectionGeneTracks?: GeneTrackSpec[]
  rpc?: RpcCall
  assemblyAliases?: Record<string, string>
  assemblyOf?: (assemblyName: string) => TestAssembly
  animationMode?: AnimationMode
  describeAssemblies?: (
    assemblyNames: string[],
  ) =>
    | Record<string, AssemblyDescription>
    | Promise<Record<string, AssemblyDescription>>
} = {}) {
  const pluginManager = new PluginManager()
  if (describeAssemblies) {
    pluginManager.addToExtensionPoint(
      'Core-describeAssemblies',
      async (described, { assemblyNames }) => ({
        ...described,
        ...(await describeAssemblies(assemblyNames)),
      }),
    )
  }
  const configSchema = configSchemaFactory()

  // config-only: an unregistered adapter type reads back as an empty config
  const adapterSlots: Record<
    string,
    { slots: ConfigurationSchemaDefinition; capabilities?: string[] }
  > = {
    MCScanBlocksAdapter: {
      slots: { attributeColumns: { type: 'stringArray', defaultValue: [] } },
    },
    Gff3TabixAdapter: { slots: {} },
    PairwiseIndexedPAFAdapter: {
      slots: {
        coarseBpPerPxThreshold: { type: 'number', defaultValue: 10000 },
      },
    },
    GbzBaseSyntenyAdapter: {
      slots: {},
      capabilities: ['headerLanes', 'lanePairsOnAnchor'],
    },
    BatchingGraphAdapter: {
      slots: {},
      capabilities: ['headerLanes', 'lanePairsOnAnchor', 'lanePairBatches'],
    },
    // stands in for GCContentAdapter's readsReference capability
    TestSequenceScoreAdapter: {
      slots: {},
      capabilities: ['readsReference'],
    },
  }
  for (const [name, { slots, capabilities }] of Object.entries(adapterSlots)) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name,
          configSchema: ConfigurationSchema(name, slots, {
            explicitlyTyped: true,
          }),
          adapterCapabilities: capabilities,
          getAdapterClass: () => {
            throw new Error(`${name} is config-only in tests`)
          },
        }),
    )
  }

  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'TestRefNameAliasAdapter',
        configSchema: ConfigurationSchema(
          'TestRefNameAliasAdapter',
          { rows: { type: 'frozen', defaultValue: [] } },
          { explicitlyTyped: true },
        ),
        getAdapterClass: async () =>
          class extends BaseAdapter implements BaseRefNameAliasAdapter {
            async getRefNameAliases() {
              return this.getConf('rows') as Alias[]
            }
          },
      }),
  )

  // inside the callback: createBaseTrackConfig reads the adapter union as it runs
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
        ReactComponent: () => null,
      }),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const temporaryAssemblies = observable.array<{
    name: string
    displayName?: unknown
  }>([], {
    deep: false,
  })

  const trackSchema = pluginManager.pluggableConfigSchemaType('track')
  const syntenyTrack = trackSchema.create(
    {
      type: 'SyntenyTrack',
      trackId: 'multiway_track',
      assemblyNames: trackAssemblyNames,
      adapter: syntenyAdapter,
    },
    { pluginManager },
  )
  const geneTrackConf = ({ trackId, assemblyNames }: GeneTrackSpec) =>
    trackSchema.create(
      {
        type: 'FeatureTrack',
        trackId,
        assemblyNames,
        adapter: { type: 'Gff3TabixAdapter' },
      },
      { pluginManager },
    )
  const sessionTracks = [syntenyTrack, ...geneTracks.map(geneTrackConf)]
  const connectionInstances = connectionGeneTracks.length
    ? [{ tracks: connectionGeneTracks.map(geneTrackConf) }]
    : []

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)
  const Session = types.compose(
    'MultiWaySyntenyTestSession',
    displayTestSessionModel({
      viewModel: LinearGenomeModel,
      rpcManager: {
        call: (
          _sessionId: string,
          functionName: string,
          args: Record<string, unknown>,
        ) =>
          rpc(functionName, args).then(answer =>
            functionName === 'MultiWayGetFeatures' && Array.isArray(answer)
              ? { features: answer, ops: NO_OPS }
              : answer,
          ),
      },
      assemblyManager: {
        get: assemblyOf,
        // without this a lane fetch fails on a TypeError its own error handling swallows
        waitForAssembly: () => Promise.resolve(testAssembly()),
        requireAssembly: () => Promise.resolve(testAssembly()),
        getCanonicalAssemblyName: (name: string) => assemblyAliases[name],
        getDisplayName: (name: string) => {
          const temporary = temporaryAssemblies.find(a => a.name === name)
          return temporary
            ? String(temporary.displayName ?? name)
            : assemblyOf(name).displayName || name
        },
        // any other name is a multi-genome file's sample the session does not hold
        has: (name: string) =>
          HELD_ASSEMBLIES.has(name) ||
          temporaryAssemblies.some(a => a.name === name),
        // always-true would read every re-anchor locstring as ambiguous
        isValidRefName: (refName: string) => refName === 'ctgA',
      },
      getTrackById: (id: string) =>
        id === 'multiway_track' ? syntenyTrack : undefined,
    }),
    types
      .model({})
      .volatile(() => ({
        tracks: sessionTracks,
        connectionInstances,
        animationMode,
        views: [] as { id: string }[],
        addedViews: [] as { type: string; init: Record<string, unknown> }[],
        temporaryAssemblies,
      }))
      .actions(self => ({
        addView(type: string, init: Record<string, unknown>) {
          self.addedViews.push({ type, init })
        },
        addTemporaryAssembly(conf: Record<string, unknown>) {
          self.temporaryAssemblies.push({ ...conf, name: String(conf.name) })
        },
        removeTemporaryAssembly(name: string) {
          const conf = self.temporaryAssemblies.find(a => a.name === name)
          if (conf) {
            self.temporaryAssemblies.remove(conf)
          }
        },
      })),
  )

  const session = Session.create({ configuration: {} }, { pluginManager })
  const view = session.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: Array.from({ length: copies }, () => ({
        type: 'SyntenyTrack',
        configuration: 'multiway_track',
        displays: [{ type: 'MultiWaySyntenyDisplay' }],
      })),
    }),
  )
  view.setWidth(800)
  view.setDisplayedRegions([
    { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
  ])
  const displays = view.tracks.map(
    track => track.displays[0]! as MultiWaySyntenyDisplayModel,
  )
  return { display: displays[0]!, displays, session }
}
