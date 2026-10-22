import { withAdapterId } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { assembleLocString } from '@jbrowse/core/util'
import { annotationTrackIds } from '@jbrowse/core/util/tracks'

import { buildMafRowSynteny } from './mafRowSynteny.ts'
import { ensureAssembly } from './openSampleInNewView.ts'

import type { MafRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { SampleNavigationTarget } from './openSampleInNewView.ts'
import type {
  AbstractViewContainer,
  AssemblyHost,
  TrackCatalog,
} from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/core/util/tracks'

export type MafSyntenyHost = AbstractViewContainer & AssemblyHost & TrackCatalog

/** The slice of the display the launch reads: the fetched blocks and the view. */
export interface MafSyntenyLaunchModel {
  id: string
  detailOnScreen: { get: (index: number) => MafRegionData | undefined }
  view: {
    assemblyNames: string[]
    tracks: {
      configuration: { trackId: string }
      displays: { type: string }[]
    }[]
  }
}

/**
 * Open a two-row synteny view of the reference against one aligned sample over
 * the selection, the ribbons cut from the MAF columns themselves.
 * `buildMafRowSynteny` turns the fetched blocks into features for a
 * `SyntenyTrack` over an inline `FromConfigAdapter`, so the band closes with
 * the view's own track node. The reference row carries the launching view's
 * tracks, the sample row the session's annotation for that genome.
 *
 * The sample's assembly loads first where the sample names a config, as its
 * "Open ... at the matching region" item does.
 */
export async function launchMafRowSynteny({
  host,
  model,
  target,
  regionIndex,
  refName,
  startBp,
  endBp,
}: {
  host: MafSyntenyHost
  model: MafSyntenyLaunchModel
  target: SampleNavigationTarget & { rowIndex: number }
  regionIndex: number
  refName: string
  startBp: number
  endBp: number
}) {
  const refAssembly = model.view.assemblyNames[0]
  const region = model.detailOnScreen.get(regionIndex)
  if (refAssembly === undefined || !region) {
    throw new Error('No alignment loaded under the selection')
  }
  const { assemblyName, sampleLabel } = target
  const synteny = buildMafRowSynteny({
    region,
    startBp,
    endBp,
    rowIndex: target.rowIndex,
    refName,
    mateAssembly: assemblyName,
    idPrefix: `${model.id}-${assemblyName}`,
  })
  if (!synteny) {
    throw new Error(`${sampleLabel} has no aligned base in the selection`)
  }
  await ensureAssembly(host, target)
  const refLoc = assembleLocString({ refName, start: startBp, end: endBp })
  const refTracks: TrackInit[] = model.view.tracks.map(track => {
    const type = track.displays[0]?.type
    return type
      ? { trackId: track.configuration.trackId, type }
      : { trackId: track.configuration.trackId }
  })
  await host.launchView('LinearSyntenyView', {
    views: [
      { assembly: refAssembly, loc: refLoc, tracks: refTracks },
      {
        assembly: assemblyName,
        loc: assembleLocString({
          refName: synteny.refName,
          start: synteny.start,
          end: synteny.end,
          reversed: synteny.reversed,
        }),
        tracks: annotationTrackIds(host, assemblyName),
      },
    ],
    tracks: [
      [
        {
          type: 'SyntenyTrack',
          trackId: `${model.id}-${assemblyName}-maf-synteny`,
          name: `${refAssembly} vs ${sampleLabel} (MAF, ${refLoc})`,
          assemblyNames: [refAssembly, assemblyName],
          adapter: withAdapterId({
            type: 'FromConfigAdapter',
            features: synteny.features,
          }),
        },
      ],
    ],
  })
}
