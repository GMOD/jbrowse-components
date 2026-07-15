import { createHash } from 'node:crypto'
import path from 'node:path'

import { app } from 'electron'

/**
 * Path management utilities
 */

export interface AppPaths {
  userData: string
  recentSessionsPath: string
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
    quickstartDir: path.join(userData, 'quickstart'),
    thumbnailDir: path.join(userData, 'thumbnails'),
    faiDir: path.join(userData, 'fai'),
    autosaveDir: path.join(userData, 'autosaved'),
    jbrowseDocDir,
    defaultSavePath: path.join(jbrowseDocDir, 'untitled.jbrowse'),
  }
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

export function getFaiPath(paths: AppPaths, name: string) {
  return path.join(paths.faiDir, `${encodeURIComponent(name)}.fai`)
}

export function stringify(obj: unknown) {
  return JSON.stringify(obj, null, 2)
}

export const ENCODING = 'utf8'
