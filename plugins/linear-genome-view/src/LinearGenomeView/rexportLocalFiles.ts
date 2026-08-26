/**
 * A track whose data is a local file the *browser* opened — jbrowse-web's
 * "Choose File" — and why no R script can be written for one.
 *
 * The exported script reads every track straight from its source path, and
 * these two location types have no path to give it: a `BlobLocation` is a
 * blobId into a map that lives as long as the tab, and a `FileHandleLocation`
 * is a handleId into IndexedDB that only the File System Access API can
 * redeem. Neither means anything to a process outside the browser.
 *
 * `firstUri` resolves both to `''`, so before this the exporters emitted
 * `path <- ""` and the failure surfaced inside R, as an unreadable empty path,
 * with nothing anywhere connecting it to the file having been unreachable from
 * the start. So the track is declined before it can produce a panel, and named
 * in the script's skipped list with the fix — jbrowse-desktop opens the same
 * file as a `localPath`, which R reads directly.
 */

/** What to do instead, shared by the script's comment and the export dialog. */
export const BROWSER_LOCAL_FILE_ADVICE =
  'Open the same file in JBrowse Desktop, which reads local files by their filesystem path, and export the R script from there.'

/** The whole note for a declined track, as it appears in the script header. */
export const BROWSER_LOCAL_FILE_REASON = `opened from a local file in this browser, which has no path an R script could open. ${BROWSER_LOCAL_FILE_ADVICE}`

const BROWSER_LOCAL_LOCATION_TYPES = new Set([
  'BlobLocation',
  'FileHandleLocation',
])

// The discriminating field is enough on its own, and is checked first because a
// legacy snapshot may carry it without the `locationType` tag (see the
// FileLocation preProcessor, which infers the tag from exactly these fields).
function isBrowserLocalLocation(o: Record<string, unknown>) {
  return (
    typeof o.blobId === 'string' ||
    typeof o.handleId === 'string' ||
    (typeof o.locationType === 'string' &&
      BROWSER_LOCAL_LOCATION_TYPES.has(o.locationType))
  )
}

// A config tree is shallow — adapter, its subadapters, their locations — so
// this is only a guard against an unexpectedly self-referential one.
const MAX_DEPTH = 8

/**
 * Whether anything this adapter config reads is a browser-local file, at any
 * depth: a MultiWiggleAdapter's subadapters, a CramAdapter's sequenceAdapter,
 * or an index location sitting next to a perfectly ordinary data uri (which
 * still can't be exported — R would find the data and not the index).
 *
 * Takes the value `getConf(track, 'adapter')` returns, which is a plain
 * snapshot of objects and arrays (see readConfObject), so an ordinary walk is
 * safe here.
 */
export function readsBrowserLocalFile(value: unknown, depth = 0): boolean {
  if (depth > MAX_DEPTH || typeof value !== 'object' || value === null) {
    return false
  }
  if (Array.isArray(value)) {
    return value.some(entry => readsBrowserLocalFile(entry, depth + 1))
  }
  const obj = value as Record<string, unknown>
  return (
    isBrowserLocalLocation(obj) ||
    Object.values(obj).some(entry => readsBrowserLocalFile(entry, depth + 1))
  )
}
