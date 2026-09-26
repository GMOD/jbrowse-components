import { indexCandidateNames } from '@jbrowse/add-track-core'

import { getFileName } from './getFileName.ts'

import type { FileLocation } from './types/data.ts'

// defined in `@jbrowse/add-track-core`, which is framework-free so `jbrowse-cli`
// reads the same list; re-exported because this subpath serves them to plugins
export { indexCandidateNames, indexSpellings } from '@jbrowse/add-track-core'

/**
 * `location` with its filename replaced, i.e. the sibling of a data file.
 *
 * Only a URI and a local path have a sibling at all. A Blob or a FileHandle is
 * whatever the user picked out of a file dialog and there is no directory
 * around it to look in, so those get `undefined` — the honest answer, and the
 * reason index detection cannot work from a browser file picker.
 */
export function siblingLocation(
  location: FileLocation,
  fileName: string,
): FileLocation | undefined {
  const replaceLast = (path: string) =>
    // the separator is kept: a Windows local path uses backslashes and a URI
    // never does, so rebuilding with '/' would corrupt one of them
    path.replace(/[^/\\]*$/, () => fileName)
  if (location.locationType === 'UriLocation') {
    return { ...location, uri: replaceLast(location.uri) }
  }
  if (location.locationType === 'LocalPathLocation') {
    return { ...location, localPath: replaceLast(location.localPath) }
  }
  return undefined
}

/**
 * The index sitting beside `location`, or undefined when none of the
 * conventional spellings is there.
 *
 * `exists` is injected rather than reached for, because what "exists" costs is
 * the caller's business and differs by host: a local path is a stat, a URL is a
 * request, and a Blob cannot be asked at all.
 */
export async function detectIndexLocation(
  location: FileLocation,
  exists: (location: FileLocation) => Promise<boolean>,
) {
  for (const name of indexCandidateNames(getFileName(location))) {
    const candidate = siblingLocation(location, name)
    if (candidate && (await exists(candidate))) {
      return candidate
    }
  }
  return undefined
}
