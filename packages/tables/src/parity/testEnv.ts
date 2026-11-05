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
  /** A row morph in flight, which its deadline timer ends. */
  animating?: boolean
}

export interface ParityViewSpec<T extends ExportableDisplay> {
  /** Plugins the real track, display, adapter and RPC types come from. */
  plugins: Plugin[]
  /** The track config, without `trackId`, `assemblyNames` or `displays`. */
  track: { type: string; adapter: Record<string, unknown> }
  displayType: string
  /** The display's config slots, as the export's `display` argument. */
  displayConfig: Record<string, unknown>
  /**
   * The windows the view shows end to end, and what the export reads: one
   * locus is a window into its whole contig, several are the view's
   * displayed regions themselves, as the view shows several loci.
   */
  regions: TablesRegion[]
  /** Each contig's length by name: the contigs the assembly lists. */
  contigLengths: Record<string, number>
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

/** volvox's contigs, as `volvox.fa.fai` gives their lengths. */
export const VOLVOX_CONTIGS = { ctgA: 50_001, ctgB: 6079 }

const locStrings = (regions: readonly TablesRegion[]) =>
  regions.map(r => `${r.refName}:${r.start}-${r.end}`).join(',')

/**
 * The regions the view displays for `regions`: one locus's whole contig, or
 * the loci themselves.
 */
function displayedRegionsFor(
  regions: readonly TablesRegion[],
  contigLengths: Record<string, number>,
) {
  const [locus] = regions
  const length = locus ? contigLengths[locus.refName] : undefined
  return (
    locus && regions.length === 1
      ? [{ refName: locus.refName, start: 0, end: length ?? locus.end }]
      : regions.map(({ refName, start, end }) => ({ refName, start, end }))
  ).map(r => ({ ...r, assemblyName: 'volvox' }))
}

/**
 * A real display of a real track type in a real `LinearGenomeView` framed as
 * the app frames `regions`: one locus as a window into its whole contig,
 * scrolled at `bpPerPx` so its settled block is the locus and the display
 * fetches its own margin around it; several loci as the displayed regions
 * themselves, end to end across the view. Either way the settled blocks are
 * the windows a static export reads. Unlike
 * `createDisplayTestEnvironment`, nothing is stubbed: the track type's
 * display defaults apply and the fetch runs through the real RPC. Settled
 * once the display reads as ready to export (`svgReady`) and no row morph
 * is in flight, as a later region's fetch re-packs the rows.
 */
export async function standUpDisplay<T extends ExportableDisplay>(
  spec: ParityViewSpec<T>,
) {
  const { regions, contigLengths, bpPerPx, displayType } = spec
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
        regions: Object.entries(contigLengths).map(([refName, end]) => ({
          refName,
          start: 0,
          end,
          assemblyName: 'volvox',
        })),
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
  const [first] = regions
  view.setWidth(
    Math.round(regions.reduce((sum, r) => sum + r.end - r.start, 0) / bpPerPx),
  )
  view.setDisplayedRegions(displayedRegionsFor(regions, contigLengths))
  view.setNewView(
    bpPerPx,
    first && regions.length === 1 ? first.start / bpPerPx : 0,
  )
  const window = locStrings(view.settledDynamicBlocks)
  const wanted = locStrings(regions)
  if (window !== wanted) {
    throw new Error(`the view shows ${window}, not the export's ${wanted}`)
  }

  const display = view.tracks[0]?.displays[0]
  if (!spec.isDisplay(display)) {
    throw new Error(`the track holds no ${displayType}`)
  }
  await until(
    () => display.svgReady && !display.animating,
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
