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
  rpcDataMap: { get: (index: number) => MafRegionData | undefined }
  view: {
    assemblyNames: string[]
    tracks: {
      configuration: { trackId: string }
      displays: { type: string }[]
    }[]
  }
}

/**
 * Open a two-row synteny view of the reference against one aligned sample
 * over the selection, the ribbons cut from the MAF columns themselves.
 *
 * No adapter and no preprocessing: `buildMafRowSynteny` turns the fetched
 * blocks into synteny features with a CIGAR, and those go into a `SyntenyTrack`
 * over a `FromConfigAdapter` written inline on the launch, so the band lives on
 * the view's own track node and closes with it. Only the reference-anchored
 * side is stored; the band's fetch queries the top row's axis, and the
 * reference is what opens on top. The reference row carries what the launching
 * view has open (the MAF included), the sample row the session's annotation for
 * that genome.
 *
 * The sample's assembly is loaded first where the sample names a config to
 * load it from, the same way its "Open ... at the matching region" item does.
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
  const region = model.rpcDataMap.get(regionIndex)
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
          adapter: { type: 'FromConfigAdapter', features: synteny.features },
        },
      ],
    ],
  })
}
