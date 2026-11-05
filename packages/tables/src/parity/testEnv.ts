import PluginManager from '@jbrowse/core/PluginManager'
import {
  displayTestSessionModel,
  testAssembly,
  testAssemblyManager,
} from '@jbrowse/display-test-utils'
import { destroy } from '@jbrowse/mobx-state-tree'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import type Plugin from '@jbrowse/core/Plugin'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'

const TRACK_ID = 'parity_track'
const DISPLAY_ID = 'parity_track-display'

/**
 * Every RPC a display calls, run in this process by its registered method
 * type over the real adapters, as a worker would: the display fetches what
 * it asks for, with its own args, from the same files the export reads. A
 * method nothing registers is recorded and never answers.
 */
function inProcessRpc(pluginManager: PluginManager) {
  const unregistered = new Set<string>()
  return {
    unregistered,
    async call(sessionId: string, method: string, args: object) {
      if (pluginManager.rpcMethods.has(method)) {
        const type = pluginManager.getRpcMethodType(method)
        return type.deserializeReturn(
          await type.execute({ ...args, sessionId }),
          args,
        )
      } else {
        unregistered.add(method)
        return new Promise(() => {})
      }
    },
  }
}

export async function until(
  done: () => boolean,
  what: () => string,
  timeoutMs = 20_000,
) {
  const deadline = Date.now() + timeoutMs
  while (!done()) {
    if (Date.now() > deadline) {
      throw new Error(`parity display never settled: ${what()}`)
    }
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

interface ExportableDisplay {
  svgReady: boolean
  error: unknown
}

export interface ParityViewSpec<T extends ExportableDisplay> {
  /** Plugins the real track, display, adapter and RPC types come from. */
  plugins: Plugin[]
  /** The track config, without `trackId`, `assemblyNames` or `displays`. */
  track: { type: string; adapter: Record<string, unknown> }
  displayType: string
  /** The display's config slots, as the export's `display` argument. */
  displayConfig: Record<string, unknown>
  /** The window the view shows inside its contig, and what the export reads. */
  region: TablesRegion
  /** The contig's length: the view displays the whole contig. */
  contigLength: number
  bpPerPx: number
  /** Whether the track's display is the model the adapter reads. */
  isDisplay: (display: unknown) => display is T
}

/** Whether `display` is a display of type `type`, by the name it carries. */
export function hasDisplayType(display: unknown, type: string) {
  return (
    typeof display === 'object' &&
    display !== null &&
    'type' in display &&
    display.type === type
  )
}

/**
 * A real display of a real track type in a real `LinearGenomeView` framed as
 * the app frames a locus: the whole contig displayed, scrolled at `bpPerPx`
 * so its settled block is `region`, the window a static export reads, and the
 * display fetching its own margin around it. Unlike
 * `createDisplayTestEnvironment`, nothing is stubbed: the track type's
 * display defaults apply and the fetch runs through the real RPC. Settled
 * once the display reads as ready to export (`svgReady`).
 */
export async function standUpDisplay<T extends ExportableDisplay>(
  spec: ParityViewSpec<T>,
) {
  const { region, bpPerPx, displayType } = spec
  const pluginManager = new PluginManager([
    new LinearGenomeViewPlugin(),
    ...spec.plugins,
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  await pluginManager.getDisplayType(displayType).loadStateModel()

  const trackSnapshot = {
    ...spec.track,
    trackId: TRACK_ID,
    assemblyNames: ['volvox'],
    displays: [
      { type: displayType, displayId: DISPLAY_ID, ...spec.displayConfig },
    ],
  }
  const trackConfig = pluginManager
    .pluggableConfigSchemaType('track')
    .create(trackSnapshot, { pluginManager })
  const ViewModel = linearGenomeViewStateModelFactory(pluginManager)
  const rpcManager = inProcessRpc(pluginManager)
  const Session = displayTestSessionModel({
    viewModel: ViewModel,
    rpcManager,
    assemblyManager: testAssemblyManager(
      testAssembly({
        regions: [
          {
            refName: region.refName,
            start: 0,
            end: spec.contigLength,
            assemblyName: 'volvox',
          },
        ],
      }),
    ),
    getTrackById: (id: string) => (id === TRACK_ID ? trackConfig : undefined),
    baseTrackConfig: (id: string) =>
      id === TRACK_ID ? { ...trackSnapshot, trackId: id } : undefined,
  })
  const session = Session.create({ configuration: {} }, { pluginManager })
  const view = session.setView(
    ViewModel.create({
      type: 'LinearGenomeView',
      tracks: [
        {
          type: spec.track.type,
          configuration: TRACK_ID,
          displays: [{ type: displayType, configuration: DISPLAY_ID }],
        },
      ],
    }),
  )
  view.setWidth(Math.round((region.end - region.start) / bpPerPx))
  view.setDisplayedRegions([
    {
      refName: region.refName,
      start: 0,
      end: spec.contigLength,
      assemblyName: 'volvox',
    },
  ])
  view.setNewView(bpPerPx, region.start / bpPerPx)
  const window = view.settledDynamicBlocks
    .map(b => `${b.refName}:${b.start}-${b.end}`)
    .join(',')
  const wanted = `${region.refName}:${region.start}-${region.end}`
  if (window !== wanted) {
    throw new Error(`the view shows ${window}, not the export's ${wanted}`)
  }

  const display = view.tracks[0]?.displays[0]
  if (!spec.isDisplay(display)) {
    throw new Error(`the track holds no ${displayType}`)
  }
  await until(
    () => display.svgReady,
    () =>
      `${displayType}; RPC methods nothing registers: ${[...rpcManager.unregistered].join(', ') || 'none'}`,
  )
  if (display.error) {
    throw new Error(`the ${displayType} failed: ${String(display.error)}`)
  }
  return {
    display,
    view,
    dispose: () => {
      destroy(session)
    },
  }
}
