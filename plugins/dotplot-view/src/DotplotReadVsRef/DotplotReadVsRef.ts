import {
  buildReadVsRefFeatures,
  buildReadVsRefTemporaryAssembly,
} from '@jbrowse/alignments-core'
import { getConf } from '@jbrowse/core/configuration'
import {
  gatherOverlaps,
  getSession,
  sum,
  truncateMiddle,
} from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments'

export function onClick(feature: Feature, self: LinearAlignmentsDisplayModel) {
  const session = getSession(self)
  try {
    const { features, totalLength, readName, seq } =
      buildReadVsRefFeatures(feature)
    const { parentTrack } = self
    const [trackAssembly] = getConf(parentTrack, 'assemblyNames') as string[]
    const stamp = Date.now()
    const readAssembly = `${readName}_assembly_${stamp}`
    const assemblyNames = [trackAssembly!, readAssembly]
    const trackId = `track-${stamp}`
    const shortName = truncateMiddle(readName)
    const trackName = `${shortName}_vs_${trackAssembly}`

    // The synthetic read assembly must be registered for the DotplotView to
    // initialize (assembliesInitialized gates on every assemblyName resolving);
    // it is torn down by DotplotView.beforeDestroy via removeTemporaryAssembly.
    session.addTemporaryAssembly?.(
      buildReadVsRefTemporaryAssembly({
        readName,
        readAssembly,
        totalLength,
        seq,
        trackId: `${readName}_${stamp}`,
        uniqueId: `${readName}_${stamp}`,
      }),
    )

    // Size hview's bpPerPx from the regions it actually draws, so overlap
    // merging in gatherOverlaps is reflected exactly.
    const hviewRegions = gatherOverlaps(
      features.map(f => ({
        start: f.start,
        end: f.end,
        refName: f.refName,
        assemblyName: trackAssembly,
      })),
    )

    session.addView('DotplotView', {
      type: 'DotplotView',
      hview: {
        offsetPx: 0,
        bpPerPx: sum(hviewRegions.map(r => r.end - r.start)) / 800,
        displayedRegions: hviewRegions,
      },
      vview: {
        offsetPx: 0,
        bpPerPx: totalLength / 400,
        minimumBlockWidth: 0,
        displayedRegions: [
          {
            assemblyName: readAssembly,
            start: 0,
            end: totalLength,
            refName: readName,
          },
        ],
      },

      viewTrackConfigs: [
        {
          type: 'SyntenyTrack',
          assemblyNames,
          adapter: {
            type: 'FromConfigAdapter',
            features,
          },
          trackId,
          name: trackName,
        },
      ],
      assemblyNames,
      tracks: [
        {
          configuration: trackId,
          type: 'SyntenyTrack',
          displays: [
            {
              type: 'DotplotDisplay',
              configuration: `${trackId}-DotplotDisplay`,
            },
          ],
        },
      ],

      displayName: `${shortName} vs ${trackAssembly}`,
    })
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
  }
}
