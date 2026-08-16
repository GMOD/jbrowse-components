import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './stateModel.ts'

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
  const env = createDisplayTestEnvironment<LinearMafDisplayModel>({
    plugins: [new LinearGenomeViewPlugin()],
    trackType: 'MafTrack',
    adapter: {
      name: 'MafTabixAdapter',
      slots: {
        summaryAdapter: { type: 'frozen', defaultValue: null },
        annotationAdapter: { type: 'frozen', defaultValue: null },
      },
      // No `samples` slot on the adapter → the sample-discovery path.
      config: { type: 'MafTabixAdapter', summaryAdapter, annotationAdapter },
    },
    displayName: 'LinearMafDisplay',
    configSchema: () => configSchemaF(),
    stateModel: (_pm, schema) => stateModelFactory(schema),
    viewModel: linearGenomeViewStateModelFactory,
    assemblyEnd,
    viewRegionEnd,
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
