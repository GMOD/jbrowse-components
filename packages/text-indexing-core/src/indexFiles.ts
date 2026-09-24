import { indexGff3 } from './types/gff3Adapter.ts'
import { indexGtf } from './types/gtfAdapter.ts'
import { indexVcf } from './types/vcfAdapter.ts'
import { indexableAdapters, trackIndexingPolicy } from './util.ts'

import type {
  IndexingPolicy,
  LocalPathLocation,
  Track,
  UriLocation,
} from './util.ts'

// per-track progress sink. Consumers render this however they like: the CLI
// draws a cli-progress bar, the desktop forwards it over RPC as a determinate
// status.
export interface TrackIndexProgress {
  onStart?: (totalBytes: number) => void
  onUpdate?: (processedBytes: number) => void
  onDone?: () => void
}

function getIndexingLocation(track: Track, locationKey: string) {
  const { adapter } = track
  // adapter[locationKey] is the canonical location object, e.g. gffGzLocation;
  // fall back to the adapter itself to support the shorthand where a bare `uri`
  // sits directly on the adapter
  const loc = (adapter?.[locationKey] ?? adapter) as
    | UriLocation
    | LocalPathLocation
    | undefined
  return loc?.locationType === 'LocalPathLocation' ? loc.localPath : loc?.uri
}

const noop = () => {}

// Streams index records for a set of tracks, each read under its own policy
export async function* indexFiles({
  tracks,
  policy,
  outDir,
  makeProgress,
  checkAbort,
}: {
  tracks: Track[]
  policy: IndexingPolicy
  outDir: string
  makeProgress?: (trackId: string) => TrackIndexProgress
  checkAbort?: () => void
}) {
  for (const track of tracks) {
    checkAbort?.()
    const { adapter, trackId } = track
    const indexable = indexableAdapters[adapter?.type ?? '']
    const inLocation = indexable
      ? getIndexingLocation(track, indexable.locationKey)
      : undefined
    if (indexable && inLocation) {
      const progress = makeProgress?.(trackId)
      const { attributes, exclude, include } = trackIndexingPolicy(
        track,
        policy,
      )
      const common = {
        config: track,
        attributesToIndex: attributes,
        inLocation,
        outDir,
        onStart: progress?.onStart ?? noop,
        onUpdate: progress?.onUpdate ?? noop,
        checkAbort,
      }
      if (indexable.format === 'gff3') {
        yield* indexGff3({
          ...common,
          featureTypesToExclude: exclude,
          featureTypesToInclude: include,
        })
      } else if (indexable.format === 'gtf') {
        yield* indexGtf(common)
      } else {
        yield* indexVcf(common)
      }
      progress?.onDone?.()
    }
  }
}
