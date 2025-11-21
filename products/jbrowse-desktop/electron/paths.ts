import path from 'path'

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
  return path.join(
    paths.thumbnailDir,
    `${encodeURIComponent(sessionPath)}.data`,
  )
}

export function getAutosavePath(
  paths: AppPaths,
  sessionName: string,
  ext = 'json',
) {
  return path.join(
    paths.autosaveDir,
    `${encodeURIComponent(sessionName)}.${ext}`,
  )
}

export function getFaiPath(paths: AppPaths, name: string) {
  return path.join(paths.faiDir, `${encodeURIComponent(name)}.fai`)
}
