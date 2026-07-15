import { GenomesFile, TrackDbFile } from '@gmod/ucsc-hub'
import { isUriLocation } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import type {
  FileLocation,
  LocalPathLocation,
  UriLocation,
} from '@jbrowse/core/util'

// the location kinds a hub file can be loaded from and resolve children against
export type HubLocation = UriLocation | LocalPathLocation

export async function fetchGenomesFile(genomesLoc: FileLocation) {
  const genomesFileText = await openLocation(genomesLoc).readFile('utf8')
  return new GenomesFile(genomesFileText)
}

export async function fetchTrackDbFile(trackDbLoc: FileLocation) {
  const text = await openLocation(trackDbLoc).readFile('utf8')
  return new TrackDbFile(text)
}

// local path <-> file:// url so that relative paths and `..` segments resolve
// through the same new URL() machinery used for remote hubs
function localPathToFileUrl(localPath: string) {
  const p = localPath.replaceAll('\\', '/')
  return `file://${p.startsWith('/') ? '' : '/'}${p}`
}

function fileUrlToLocalPath(fileUrl: string) {
  const p = decodeURIComponent(new URL(fileUrl).pathname)
  // windows drive paths come back as /C:/... , strip the leading slash
  return /^\/[a-zA-Z]:/.test(p) ? p.slice(1) : p
}

// absolute base url for a hub file, against which its relative children resolve;
// http(s) urls pass through, local paths become file:// urls
export function hubBaseUrl(base: HubLocation) {
  return isUriLocation(base)
    ? resolve(base.uri, base.baseUri)
    : localPathToFileUrl(base.localPath)
}

// resolve a track's data path against its trackDb location. `fallback` supplies
// a default path (e.g. an index sitting next to its data file) when `path` is
// empty.
export function makeLoc(path: string, base: HubLocation, fallback?: string) {
  return makeLocFromUri(path || fallback || '', hubBaseUrl(base))
}

// build a location for a hub-relative path resolved against a base url; emits a
// LocalPathLocation when the base is a file:// (local desktop) url
export function makeLocFromUri(path: string, baseUrl: string): HubLocation {
  const uri = resolve(path, baseUrl)
  return uri.startsWith('file://')
    ? {
        localPath: fileUrlToLocalPath(uri),
        locationType: 'LocalPathLocation' as const,
      }
    : {
        uri,
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
