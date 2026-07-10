import { objectHash } from '@jbrowse/core/util'
import { generateUnknownTrackConf } from '@jbrowse/core/util/tracks'

import { htmlLink, makeLoc } from './util.ts'

import type { HubLocation } from './util.ts'
import type { RaStanza, TrackDbFile } from '@gmod/ucsc-hub'

// stanzas that only group other tracks; never emitted as tracks themselves
const parentTrackKeys = new Set([
  'superTrack',
  'compositeTrack',
  'container',
  'view',
])

// a track's container name, dropping the trailing `on`/`off` visibility flag
function parentName(stanza: RaStanza | undefined) {
  return stanza?.data.parent?.split(' ')[0]
}

// the container stanzas above a track, root-first, for building its folder path.
// `seen` guards against a malformed hub whose parent links form a cycle
function ancestorStanzas(trackDb: TrackDbFile, trackName: string) {
  const ancestors: RaStanza[] = []
  const seen = new Set([trackName])
  let name = parentName(trackDb.data[trackName])
  while (name && !seen.has(name)) {
    seen.add(name)
    const stanza = trackDb.data[name]
    if (stanza) {
      ancestors.push(stanza)
    }
    name = parentName(stanza)
  }
  return ancestors.reverse()
}

export function generateTracks({
  trackDb,
  trackDbLoc,
  assemblyName,
  baseUrl,
}: {
  trackDb: TrackDbFile
  trackDbLoc: HubLocation
  assemblyName: string
  baseUrl: string
}) {
  return Object.entries(trackDb.data)
    .filter(
      ([, track]) => !Object.keys(track.data).some(k => parentTrackKeys.has(k)),
    )
    .map(([trackName, track]) => ({
      metadata: {
        ...track.data,
        ...(track.data.html
          ? { html: htmlLink(track.data.html, baseUrl) }
          : {}),
      },
      // folder path: the leaf's UCSC track `group` (broadest), then each
      // ancestor container's shortLabel root-first. Most hubs express structure
      // through superTrack/compositeTrack nesting and set no `group` on leaves,
      // so the parent shortLabels are the real folder names; fall back to a
      // parent's `group` when it has no shortLabel.
      category: [
        track.data.group,
        ...ancestorStanzas(trackDb, trackName).map(
          p => p.data.shortLabel || p.data.group,
        ),
      ].filter((f): f is string => !!f),
      // trackDb.settings() resolves `type` inherited from any ancestor
      // (compositeTrack -> view -> track), not just the direct parent
      ...makeTrackConfig({
        track,
        trackDbLoc,
        resolvedType: trackDb.settings(trackName).type || '',
      }),
    }))
    .map(r => ({
      ...r,
      trackId: `ucsc-trackhub-${objectHash(r)}`,
      assemblyNames: [assemblyName],
    }))
}

// UCSC base track type -> JBrowse track type + adapter. bigWig is matched before
// the generic big* (bigBed) fallback, since it too starts with "big".
function trackTypeAndAdapter({
  baseType,
  bigDataUrl,
  location,
  indexLocation,
}: {
  baseType: string
  bigDataUrl: string
  location: HubLocation
  indexLocation: (fallback: string) => HubLocation
}) {
  if (baseType === 'bam') {
    return {
      type: 'AlignmentsTrack',
      adapter: {
        type: 'BamAdapter',
        bamLocation: location,
        index: { location: indexLocation(`${bigDataUrl}.bai`) },
      },
    }
  } else if (baseType === 'cram') {
    return {
      type: 'AlignmentsTrack',
      adapter: {
        type: 'CramAdapter',
        cramLocation: location,
        craiLocation: indexLocation(`${bigDataUrl}.crai`),
      },
    }
  } else if (baseType === 'bigWig') {
    return {
      type: 'QuantitativeTrack',
      adapter: { type: 'BigWigAdapter', bigWigLocation: location },
    }
  } else if (baseType === 'vcfTabix') {
    return {
      type: 'VariantTrack',
      adapter: {
        type: 'VcfTabixAdapter',
        vcfGzLocation: location,
        index: { location: indexLocation(`${bigDataUrl}.tbi`) },
      },
    }
  } else if (baseType === 'hic') {
    return {
      type: 'HicTrack',
      adapter: { type: 'HicAdapter', hicLocation: location },
    }
  } else if (baseType.startsWith('big')) {
    return {
      type: 'FeatureTrack',
      adapter: { type: 'BigBedAdapter', bigBedLocation: location },
    }
  } else {
    // unsupported: peptideMapping, gvf, ld2, narrowPeak, wig, wigMaf, halSnake,
    // bed, bed5FloatScore, bedGraph, bedRnaElements, broadPeak, coloredExon
    return undefined
  }
}

function makeTrackConfig({
  track,
  trackDbLoc,
  resolvedType,
}: {
  track: RaStanza
  trackDbLoc: HubLocation
  resolvedType: string
}) {
  const { data } = track
  const bigDataUrl = data.bigDataUrl || ''
  const bigDataIdx = data.bigDataIndex || ''
  const name =
    (data.shortLabel || '') + (bigDataUrl.includes('xeno') ? ' (xeno)' : '')

  let baseType = resolvedType.split(' ')[0] || ''
  if (baseType === 'bam' && bigDataUrl.toLowerCase().endsWith('cram')) {
    baseType = 'cram'
  }

  const config = trackTypeAndAdapter({
    baseType,
    bigDataUrl,
    location: makeLoc(bigDataUrl, trackDbLoc),
    indexLocation: fallback => makeLoc(bigDataIdx, trackDbLoc, fallback),
  })
  return config
    ? { name, description: data.longLabel, ...config }
    : generateUnknownTrackConf(name, baseType)
}
