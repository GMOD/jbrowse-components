import { readConfObject } from '@jbrowse/core/configuration'
import {
  assembleLocString,
  isSessionWithAddSessionTrack,
} from '@jbrowse/core/util'
import { allSessionTracks, isSameAssemblyName } from '@jbrowse/core/util/tracks'

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

// The launched view's rows open with: the reference row carries what the
// launching view has open (the MAF included, since it is the alignment the
// ribbons were cut from), and the sample row the session's annotation for that
// genome — the same choice the graph's launch out of a node and the synteny
// track's "Open <assembly>" make.
function annotationTracks(host: MafSyntenyHost, assemblyName: string) {
  return allSessionTracks(host).flatMap(track =>
    readConfObject(track, 'type') === 'FeatureTrack' &&
    (readConfObject(track, 'assemblyNames') as string[]).some(name =>
      isSameAssemblyName(name, assemblyName, host.assemblyManager),
    )
      ? [readConfObject(track, 'trackId') as string]
      : [],
  )
}

/**
 * Open a two-row synteny view of the reference against one aligned sample
 * over the selection, the ribbons cut from the MAF columns themselves.
 *
 * No adapter and no preprocessing: `buildMafRowSynteny` turns the fetched
 * blocks into synteny features with a CIGAR, and those go into a session
 * `SyntenyTrack` over a `FromConfigAdapter` — the shape "linear read vs ref"
 * launches a read with. A session track rather than a catalog entry
 * (`addSessionTrackConf`): it is a view the user stood up, not data the site
 * offers. Only the reference-anchored side is stored; the band's fetch queries
 * the top row's axis, and the reference is what opens on top.
 *
 * The sample's assembly is loaded first where the sample names a config to
 * load it from, the same way its "Open ... in new view" item does.
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
  if (!isSessionWithAddSessionTrack(host)) {
    throw new Error('This session cannot add a track for the synteny view')
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
  const trackId = `${model.id}-${assemblyName}-maf-synteny-${Date.now()}`
  host.addSessionTrackConf({
    type: 'SyntenyTrack',
    trackId,
    name: `${refAssembly} vs ${sampleLabel} (MAF, ${refLoc})`,
    assemblyNames: [refAssembly, assemblyName],
    adapter: { type: 'FromConfigAdapter', features: synteny.features },
  })
  const refTracks: TrackInit[] = model.view.tracks.map(track => {
    const type = track.displays[0]?.type
    return type
      ? { trackId: track.configuration.trackId, type }
      : { trackId: track.configuration.trackId }
  })
  host.addView('LinearSyntenyView', {
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
        tracks: annotationTracks(host, assemblyName),
      },
    ],
    tracks: [[trackId]],
  })
}
