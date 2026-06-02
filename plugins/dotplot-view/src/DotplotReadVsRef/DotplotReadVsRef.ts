import { buildReadVsRefFeatures } from '@jbrowse/alignments-core'
import { getConf } from '@jbrowse/core/configuration'
import { gatherOverlaps, getSession, sum } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments'

export function onClick(feature: Feature, self: LinearAlignmentsDisplayModel) {
  const session = getSession(self)
  try {
    const { features, totalLength, readName } = buildReadVsRefFeatures(feature)
    const { parentTrack } = self
    const [trackAssembly] = getConf(parentTrack, 'assemblyNames') as string[]
    const readAssembly = `${readName}_assembly_${Date.now()}`
    const assemblyNames = [trackAssembly!, readAssembly]
    const trackId = `track-${Date.now()}`
    const trackName = `${readName}_vs_${trackAssembly}`

    session.addView('DotplotView', {
      type: 'DotplotView',
      hview: {
        offsetPx: 0,
        bpPerPx: sum(features.map(f => f.end - f.start)) / 800,
        displayedRegions: gatherOverlaps(
          features.map(f => ({
            start: f.start,
            end: f.end,
            refName: f.refName,
            assemblyName: trackAssembly,
          })),
        ),
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

      displayName: `${readName} vs ${trackAssembly}`,
    })
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
  }
}
