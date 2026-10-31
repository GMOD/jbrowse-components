import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './stateModel.ts'

import type { MafWireRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafFrameRecord } from '../types.ts'
import type { LinearMafDisplayModel } from './stateModel.ts'
import type { Region } from '@jbrowse/core/util'

/**
 * The shared display harness wired for `LinearMafDisplay`. Almost every getter
 * worth testing here — the fetch autoruns, the too-large gate, the row geometry
 * — reads the containing view, so a bare `stateModel.create()` cannot reach
 * them.
 */
export function createMafTestEnvironment({
  summaryAdapter = null,
  framesAdapter = null,
  assemblyEnd = 10_000_000,
  viewRegionEnd = assemblyEnd,
  displayConfig,
  assemblyAliases,
}: {
  // Adapter-level `summaryAdapter` snapshot; the zoom-out summary path is off
  // when it is null.
  summaryAdapter?: unknown
  // Adapter-level `framesAdapter` (UCSC mafFrames) snapshot. Only its
  // presence is read by the gates — the display asks whether a reading frame
  // *can* be defined, and the RPC that reads it is stubbed here — so a bare
  // `{}` is enough to turn the frame-gated options on.
  framesAdapter?: unknown
  assemblyEnd?: number
  // How much of the assembly `createDisplay` displays by default.
  viewRegionEnd?: number
  // Display config slots, for the ones with no setter (`rows`, `rowColor`).
  displayConfig?: Record<string, unknown>
  assemblyAliases?: Record<string, string>
} = {}) {
  const env = createDisplayTestEnvironment<LinearMafDisplayModel>({
    plugins: [new LinearGenomeViewPlugin()],
    trackType: 'MafTrack',
    adapter: {
      name: 'MafTabixAdapter',
      slots: {
        summaryAdapter: { type: 'maybeFrozen' },
        framesAdapter: { type: 'maybeFrozen' },
      },
      // No `samples` slot on the adapter → the sample-discovery path.
      config: { type: 'MafTabixAdapter', summaryAdapter, framesAdapter },
    },
    displayName: 'LinearMafDisplay',
    configSchema: () => configSchemaF(),
    stateModel: (_pm, schema) => stateModelFactory(schema),
    viewModel: linearGenomeViewStateModelFactory,
    assemblyEnd,
    viewRegionEnd,
    displayConfig,
    assemblyAliases,
  })

  return {
    ...env,
    createDisplay: ({
      regions,
      displaySnapshot,
      skipWidth,
    }: {
      regions?: Region[]
      // extra display snapshot keys, for the states a session can arrive in
      // rather than click into (a share link, a screenshot spec)
      displaySnapshot?: Record<string, unknown>
      skipWidth?: boolean
    } = {}) =>
      env.createDisplay({
        displayedRegions: regions,
        displaySnapshot,
        skipWidth,
      }),
  }
}

/**
 * Stage a landed detail region the way the fetch commit lands one: the wire
 * rows and any frames under the fetched span — the whole displayed region
 * unless a narrower one is given — in the foundation's store, and the
 * reference row the wire names beside the sample set.
 */
export function stageDetailRegion(
  display: LinearMafDisplayModel,
  displayedRegionIndex: number,
  data: MafWireRegionData,
  { frames, region }: { frames?: MafFrameRecord[]; region?: Region } = {},
) {
  display.setLoadedRegion(
    displayedRegionIndex,
    region ?? display.view.displayedRegions[displayedRegionIndex]!,
    { data, frames },
  )
  if (data.refSampleId !== undefined) {
    display.setRefSampleId(data.refSampleId)
  }
}

/**
 * Zoom just past base level, where identity draws rather than yielding to the
 * bases, while a base still spans more than half a pixel (`encodeBinBp` 1).
 */
export function zoomPastBaseLevel(view: LinearMafDisplayModel['view']) {
  view.zoomTo(1.5)
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
}
