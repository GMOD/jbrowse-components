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
  testAssemblyManager,
} from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './stateModel.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'

/**
 * Headless harness for the real `LinearMafDisplay` state model inside a real
 * LinearGenomeView, with a stub session/assemblyManager and a `jest.fn()`
 * rpcManager — no worker and no DOM. Almost every getter worth testing here
 * (the fetch autoruns, the too-large gate, the row geometry) reads the
 * containing view, so a bare `stateModel.create()` cannot reach them.
 *
 * One harness rather than a copy per test file, the same way the variant and
 * canvas displays do it: four hand-copied versions had already drifted on which
 * session members they stubbed, and a display that reads a member only one copy
 * provides fails in a way that looks like a bug in the display.
 */
export function createMafTestEnvironment({
  summaryAdapter = null,
  annotationAdapter = null,
  assemblyEnd = 10_000_000,
  viewRegionEnd = assemblyEnd,
}: {
  // Adapter-level `summaryAdapter` snapshot; the zoom-out summary path is off
  // when it is null.
  summaryAdapter?: unknown
  // Adapter-level `annotationAdapter` (UCSC mafFrames) snapshot. Only its
  // presence is read by the gates — the display asks whether a reading frame
  // *can* be defined, and the RPC that reads it is stubbed here — so a bare
  // `{}` is enough to turn the frame-gated options on.
  annotationAdapter?: unknown
  assemblyEnd?: number
  // How much of the assembly `createDisplay` displays by default.
  viewRegionEnd?: number
} = {}) {
  // `console.warn` only — `console.error` is the display-contract channel
  // (TEST_INFRASTRUCTURE.md).
  console.warn = jest.fn()
  // MAF's configSchema reads baseLinearDisplayConfigSchema off the installed
  // LinearGenomeViewPlugin's exports, so the real plugin must be registered.
  const pluginManager = new PluginManager([new LinearGenomeViewPlugin()])
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MafTabixAdapter',
        configSchema: ConfigurationSchema(
          'MafTabixAdapter',
          {
            summaryAdapter: { type: 'frozen', defaultValue: null },
            annotationAdapter: { type: 'frozen', defaultValue: null },
          },
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.resolve(class extends BaseAdapter {}),
      }),
  )
  const configSchema = configSchemaF(pluginManager)
  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'MafTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'MafTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'MafTrack',
        trackConfigSchema,
      ),
    })
  })
  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearMafDisplay',
        configSchema,
        stateModel: stateModelFactory(configSchema),
        trackType: 'MafTrack',
        viewType: 'LinearGenomeView',
        // never rendered here; this harness exercises the model
        ReactComponent: () => null,
      }),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const mockRpcCall = jest.fn()
  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)
  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'MafTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      // No `samples` slot on the adapter → the sample-discovery path.
      adapter: { type: 'MafTabixAdapter', summaryAdapter, annotationAdapter },
    },
    { pluginManager },
  )
  const asm = testAssembly({
    regions: [
      { refName: 'ctgA', start: 0, end: assemblyEnd, assemblyName: 'volvox' },
    ],
  })
  const Session = displayTestSessionModel({
    viewModel: LinearGenomeModel,
    rpcManager: { call: mockRpcCall },
    assemblyManager: testAssemblyManager(asm),
    getTrackById: (id: string) =>
      id === 'test_track' ? trackConfig : undefined,
  })

  function createDisplay({
    regions = [
      { assemblyName: 'volvox', start: 0, end: viewRegionEnd, refName: 'ctgA' },
    ],
    // extra display snapshot keys, for the states a session can arrive in
    // rather than click into (a share link, a screenshot spec)
    displaySnapshot = {},
    skipWidth = false,
  }: {
    regions?: {
      assemblyName: string
      start: number
      end: number
      refName: string
    }[]
    displaySnapshot?: Record<string, unknown>
    skipWidth?: boolean
  } = {}) {
    const session = Session.create({ configuration: {} }, { pluginManager })
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'MafTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearMafDisplay', ...displaySnapshot }],
          },
        ],
      }),
    )
    // skipWidth leaves the view unmeasured (`initialized` false), which is the
    // state every gate getter has to survive without throwing on `view.width`.
    // setDisplayedRegions zooms, which reads the width, so it waits for one too.
    if (!skipWidth) {
      view.setWidth(800)
      view.setDisplayedRegions(regions)
    }
    const track = view.tracks[0]!
    // annotated so a getter that doesn't exist on the model is a typecheck
    // error rather than a silent any
    const display: LinearMafDisplayModel = track.displays[0]
    return { session, view, track, display, mockRpcCall }
  }

  return { createDisplay, mockRpcCall, pluginManager }
}
