import { createHash } from 'node:crypto'
import path from 'node:path'

import { app } from 'electron'

/**
 * Path management utilities
 */

export interface AppPaths {
  userData: string
  recentSessionsPath: string
  globalPluginsPath: string
  quickstartDir: string
  thumbnailDir: string
  faiDir: string
  autosaveDir: string
  jbrowseDocDir: string
  defaultSavePath: string
}

export function initializePaths(): AppPaths {
  const userData = app.getPath('userData')
  const jbrowseDocDir = path.join(app.getPath('documents'), 'JBrowse')

  return {
    userData,
    recentSessionsPath: path.join(userData, 'recent_sessions.json'),
    globalPluginsPath: path.join(userData, 'globalPlugins.json'),
    quickstartDir: path.join(userData, 'quickstart'),
    thumbnailDir: path.join(userData, 'thumbnails'),
    faiDir: path.join(userData, 'fai'),
    autosaveDir: path.join(userData, 'autosaved'),
    jbrowseDocDir,
    defaultSavePath: path.join(jbrowseDocDir, 'untitled.jbrowse'),
  }
}

// The extension "Save session as..." forces, and with it the one reliable mark
// of a file JBrowse wrote as a session rather than one the user brought.
export const SESSION_EXTENSION = '.jbrowse'

/**
 * Whether a path is one of the session files JBrowse manages for itself. Those
 * are exactly the two it produces: an autosave under `autosaveDir`, or a file
 * the user chose through "Save session as...", which appends
 * {@link SESSION_EXTENSION}. Everything else the open dialog accepts is a
 * *config* — hand-written, or built by `@jbrowse/cli` — which JBrowse reads but
 * must never write back over. See the `loadSession` handler.
 */
export function isSessionFile(paths: AppPaths, filePath: string) {
  return filePath.endsWith(SESSION_EXTENSION) || isAutosave(paths, filePath)
}

/**
 * Whether `filePath` names a file inside `autosaveDir`.
 *
 * Asked through path.relative rather than as a string prefix, because a string
 * prefix answers a different question in two ways. It has no separator
 * boundary, so a sibling directory that merely starts with the same characters
 * (`autosaved-backup/`) matches. And it is case-sensitive against a filesystem
 * that is not: on Windows nothing canonicalizes the case of a drive letter, so
 * `c:\...\autosaved\1.json` handed to argv by a cmd prompt is the same file as
 * the `C:\...` one `newAutosavePath` produced and does not match it.
 *
 * The second one is the expensive one. An autosave that reads as *not* an
 * autosave is also not a session file, so `loadSession` mints a fresh autosave
 * path for it — and the session silently forks to a new file instead of writing
 * back to the one the user opened.
 */
export function isAutosave(paths: AppPaths, filePath: string) {
  const win32 = process.platform === 'win32'
  // the same flavor for both calls: a win32 `rel` of `D:\other\1.json` (the two
  // are on different drives) is absolute only to path.win32
  const p = win32 ? path.win32 : path.posix
  const fold = (s: string) => (win32 ? s.toLowerCase() : s)
  const rel = p.relative(fold(paths.autosaveDir), fold(filePath))
  // inside it, and not the directory itself. `..${sep}` rather than `..`, so a
  // subdirectory whose name merely begins with dots still counts as inside
  return (
    rel !== '' &&
    rel !== '..' &&
    !rel.startsWith(`..${p.sep}`) &&
    !p.isAbsolute(rel)
  )
}

// Session files are named for the moment they were created. The counter only
// separates two allocated inside one millisecond — nothing reads it back, and
// the file is created by the first autosave rather than here, so a collision
// would be two sessions quietly saving over each other instead of an EEXIST.
let autosaveCounter = 0

export function newAutosavePath(paths: AppPaths) {
  return path.join(paths.autosaveDir, `${Date.now()}-${autosaveCounter++}.json`)
}

export function getQuickstartPath(
  paths: AppPaths,
  sessionName: string,
  ext = 'json',
) {
  return path.join(
    paths.quickstartDir,
    `${encodeURIComponent(sessionName)}.${ext}`,
  )
}

export function getDeletedMarkerPath(paths: AppPaths, sessionName: string) {
  return `${getQuickstartPath(paths, sessionName)}.deleted`
}

export function getThumbnailPath(paths: AppPaths, sessionPath: string) {
  // Hash rather than encodeURIComponent(sessionPath): a URI-encoded absolute
  // path (C%3A%5CUsers%5C...) blows past Windows' 260-char MAX_PATH for deeply
  // nested / OneDrive-redirected sessions, making the thumbnail write throw.
  // The cache is internal, so the name only needs to be stable and collision
  // free, not reversible.
  const hash = createHash('sha256').update(sessionPath).digest('hex')
  return path.join(paths.thumbnailDir, `${hash}.data`)
}

// Pre-sha256 builds named thumbnails encodeURIComponent(sessionPath); kept so
// loadThumbnail can migrate them lazily instead of blanking cards on upgrade.
export function getLegacyThumbnailPath(paths: AppPaths, sessionPath: string) {
  return path.join(
    paths.thumbnailDir,
    `${encodeURIComponent(sessionPath)}.data`,
  )
}

// Longest readable prefix kept in a .fai name. faiDir itself is already ~60
// characters on Windows (`C:\Users\<user>\AppData\Roaming\JBrowse 2\fai\`), and
// this leaves the whole name far inside both the 255-char per-component limit
// and MAX_PATH.
const FAI_LABEL_MAX = 60

/**
 * Where the .fai generated for `name` is written. Unlike a quickstart, nothing
 * ever reads this name back — `indexFasta` returns the path and the assembly
 * config carries it as a localPath — so it only has to be unique, bounded, and
 * recognizable to someone looking at the directory or at track settings.
 *
 * The bound is the point. This was `encodeURIComponent(name).fai`, which is not
 * a filename encoder: it expands a non-ASCII character to nine characters, so a
 * FASTA named in Japanese or Chinese hit ENAMETOOLONG at about 28 characters of
 * basename — and it leaves `*` unescaped, which Windows rejects outright. A
 * truncated label plus a hash of the full name gives up nothing that was being
 * used, and cannot collide two files onto one index.
 */
export function getFaiPath(paths: AppPaths, name: string) {
  const hash = createHash('sha256').update(name).digest('hex').slice(0, 16)
  // ASCII word characters only: everything Windows forbids, everything the
  // shell quotes, and every multi-byte character (the length blowup above) is
  // out by construction rather than by a list of exceptions to keep current.
  const label = name.replaceAll(/[^\w.-]+/g, '_').slice(0, FAI_LABEL_MAX)
  return path.join(paths.faiDir, `${label}-${hash}.fai`)
}

export function stringify(obj: unknown) {
  return JSON.stringify(obj, null, 2)
}

export const ENCODING = 'utf8'
