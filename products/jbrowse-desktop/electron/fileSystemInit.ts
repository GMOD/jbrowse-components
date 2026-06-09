import fs from 'fs'

import { getDeletedMarkerPath, getQuickstartPath, stringify } from './paths.ts'

import type { AppPaths } from './paths.ts'

const ENCODING = 'utf8'
export const LEGACY_QUICKSTARTS = ['hg19', 'hg38', 'mm10']

/**
 * Ensures all required directories exist
 */
export async function ensureDirectoriesExist(paths: AppPaths) {
  const directories = [
    paths.quickstartDir,
    paths.faiDir,
    paths.thumbnailDir,
    paths.autosaveDir,
    paths.jbrowseDocDir,
  ]
  await Promise.all(
    directories.map(dir => fs.promises.mkdir(dir, { recursive: true })),
  )
}

/**
 * Initializes the recent sessions file if it doesn't exist
 */
export async function initializeRecentSessionsFile(paths: AppPaths) {
  if (!fs.existsSync(paths.recentSessionsPath)) {
    await fs.promises.writeFile(
      paths.recentSessionsPath,
      stringify([]),
      ENCODING,
    )
  }
}

/**
 * Deletes legacy quickstarts on first startup
 */
export async function cleanupLegacyQuickstarts(paths: AppPaths) {
  await Promise.all(
    LEGACY_QUICKSTARTS.map(async name => {
      const quickstartPath = getQuickstartPath(paths, name)
      const deletedMarkerPath = getDeletedMarkerPath(paths, name)
      try {
        // Delete once, then leave a gravestone so a user-recreated quickstart
        // is never auto-deleted again
        if (
          fs.existsSync(quickstartPath) &&
          !fs.existsSync(deletedMarkerPath)
        ) {
          await fs.promises.unlink(quickstartPath)
          await fs.promises.writeFile(deletedMarkerPath, '', ENCODING)
        }
      } catch (e) {
        console.error(`Failed to delete legacy quickstart ${name}:`, e)
      }
    }),
  )
}

/**
 * Initializes the file system: creates directories and sets up initial files
 */
export async function initializeFileSystem(paths: AppPaths) {
  await Promise.all([
    ensureDirectoriesExist(paths),
    initializeRecentSessionsFile(paths),
    cleanupLegacyQuickstarts(paths),
  ])
}
