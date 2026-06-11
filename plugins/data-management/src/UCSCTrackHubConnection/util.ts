import { GenomesFile, TrackDbFile } from '@gmod/ucsc-hub'
import { isUriLocation } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import type { FileLocation } from '@jbrowse/core/util'

export async function fetchGenomesFile(genomesLoc: FileLocation) {
  const genomesFileText = await openLocation(genomesLoc).readFile('utf8')
  return new GenomesFile(genomesFileText)
}

export async function fetchTrackDbFile(trackDbLoc: FileLocation) {
  const text = await openLocation(trackDbLoc).readFile('utf8')
  return new TrackDbFile(text)
}

// resolve a track's data path against the trackDb location, producing a
// location of the same kind (uri or local path). `fallback` supplies a default
// path (e.g. an index sitting next to its data file) when `path` is empty.
export function makeLoc(path: string, base: FileLocation, fallback?: string) {
  const p = path || fallback || ''
  return isUriLocation(base)
    ? {
        uri: new URL(p, new URL(base.uri, base.baseUri)).href,
        locationType: 'UriLocation' as const,
      }
    : {
        localPath: p,
        locationType: 'LocalPathLocation' as const,
      }
}

// build a location for a hub file (genomes.txt, trackDb.txt) given the parent
// base uri. A uri base yields a UriLocation resolved against it, otherwise the
// path is treated as a local desktop path.
export function makeLocFromUri(path: string, baseUri?: string) {
  return baseUri
    ? {
        uri: resolve(path, baseUri),
        locationType: 'UriLocation' as const,
      }
    : {
        localPath: path,
        locationType: 'LocalPathLocation' as const,
      }
}

export function resolve(uri: string, baseUri?: string) {
  return new URL(uri, baseUri).href
}

// build the connection's success notification: which assemblies had tracks
// loaded (with counts) and which were skipped because no matching assembly was
// present and none could be added
export function formatHubLoadSummary(
  trackCounts: Record<string, number>,
  skippedAssemblies: string[],
) {
  const loaded = Object.entries(trackCounts)
  const loadedStr = loaded.length
    ? `Loaded data from these assemblies: ${loaded
        .map(([name, count]) => `${name} (${count} tracks)`)
        .join(', ')}`
    : ''
  const skippedStr = skippedAssemblies.length
    ? `Skipped data from these assemblies: ${skippedAssemblies.join(', ')}`
    : ''
  return [loadedStr, skippedStr].filter(f => !!f).join('. ')
}
