import { GenomesFile, TrackDbFile } from '@gmod/ucsc-hub'
import { openLocation } from '@jbrowse/core/util/io'

import type { FileLocation, UriLocation } from '@jbrowse/core/util'

export async function fetchGenomesFile(genomesLoc: FileLocation) {
  const genomesFileText = await openLocation(genomesLoc).readFile('utf8')
  return new GenomesFile(genomesFileText)
}

export async function fetchTrackDbFile(trackDbLoc: FileLocation) {
  const text = await openLocation(trackDbLoc).readFile('utf8')
  return new TrackDbFile(text)
}

// resolve a track's data path against its trackDb location. `fallback` supplies
// a default path (e.g. an index sitting next to its data file) when `path` is
// empty.
export function makeLoc(path: string, base: UriLocation, fallback?: string) {
  return makeLocFromUri(path || fallback || '', resolve(base.uri, base.baseUri))
}

// build a UriLocation for a hub-relative path resolved against a base uri
export function makeLocFromUri(path: string, baseUri: string) {
  return {
    uri: resolve(path, baseUri),
    locationType: 'UriLocation' as const,
  }
}

export function resolve(uri: string, baseUri?: string) {
  return new URL(uri, baseUri).href
}

// wrap a hub-relative html/htmlPath into an anchor pointing at the resolved url,
// stored in track/assembly metadata for display
export function htmlLink(path: string, baseUri?: string) {
  return `<a href="${resolve(path, baseUri)}">${path}</a>`
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
