import { indexGff3 } from './types/gff3Adapter.ts'
import { indexVcf } from './types/vcfAdapter.ts'
import { adapterLocationKey } from './util.ts'

import type { LocalPathLocation, Track, UriLocation } from './util.ts'

// per-track progress sink. Consumers render this however they like: the CLI
// draws a cli-progress bar, the desktop worker forwards a status string over
// RPC. onStart fires once with the total byte count, onUpdate fires repeatedly
// with bytes processed so far, onDone fires when the track is finished.
export interface TrackIndexProgress {
  onStart?: (totalBytes: number) => void
  onUpdate?: (processedBytes: number) => void
  onDone?: () => void
}

function getIndexingLocation(track: Track) {
  const { adapter } = track
  const key = adapterLocationKey[adapter?.type ?? '']
  // adapter[key] is the canonical location object, e.g. gffGzLocation; fall
  // back to the adapter itself to support the shorthand where a bare `uri`
  // sits directly on the adapter
  const loc = key
    ? ((adapter?.[key] ?? adapter) as
        | UriLocation
        | LocalPathLocation
        | undefined)
    : undefined
  return loc?.locationType === 'LocalPathLocation' ? loc.localPath : loc?.uri
}

const noop = () => {}

// shared generator that streams index records for a set of tracks. Dispatches
// to the gff3/vcf indexers based on adapter type; per-track attribute and
// exclude overrides from textSearching take precedence over the defaults.
export async function* indexFiles({
  tracks,
  attributesToIndex,
  outDir,
  featureTypesToExclude,
  makeProgress,
  checkAbort,
}: {
  tracks: Track[]
  attributesToIndex: string[]
  outDir: string
  featureTypesToExclude: string[]
  makeProgress?: (trackId: string) => TrackIndexProgress
  checkAbort?: () => void
}) {
  for (const track of tracks) {
    checkAbort?.()
    const { adapter, textSearching, trackId } = track
    const { type } = adapter ?? {}
    const inLocation = getIndexingLocation(track)
    if (inLocation) {
      const progress = makeProgress?.(trackId)
      const common = {
        config: track,
        attributesToIndex:
          textSearching?.indexingAttributes ?? attributesToIndex,
        inLocation,
        outDir,
        onStart: progress?.onStart ?? noop,
        onUpdate: progress?.onUpdate ?? noop,
        checkAbort,
      }
      if (type === 'Gff3Adapter' || type === 'Gff3TabixAdapter') {
        yield* indexGff3({
          ...common,
          featureTypesToExclude:
            textSearching?.indexingFeatureTypesToExclude ??
            featureTypesToExclude,
        })
      } else if (type === 'VcfAdapter' || type === 'VcfTabixAdapter') {
        yield* indexVcf(common)
      }
      progress?.onDone?.()
    }
  }
}
