import fs from 'node:fs'

import {
  ENCODING,
  getDeletedMarkerPath,
  getQuickstartPath,
  stringify,
} from './paths.ts'

import type { AppPaths } from './paths.ts'

export const LEGACY_QUICKSTARTS = ['hg19', 'hg38', 'mm10']

// Every directory the app writes into. Created before anything else so no
// handler has to guard for a missing parent.
async function ensureDirectoriesExist(paths: AppPaths) {
  const directories = [
    paths.quickstartDir,
    paths.faiDir,
    paths.thumbnailDir,
    paths.autosaveDir,
    paths.nameIndicesDir,
    paths.jbrowseDocDir,
  ]
  await Promise.all(
    directories.map(dir => fs.promises.mkdir(dir, { recursive: true })),
  )
}

// Seeds a JSON list file that the rest of the app then reads without an
// existence check — getGlobalPlugins deliberately surfaces a read failure rather
// than treating it as empty, so the file has to be here before any window opens.
async function initializeJsonListFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    await fs.promises.writeFile(filePath, stringify([]), ENCODING)
  }
}

// Deletes the quickstarts that used to ship with the app, once, on first
// startup after the upgrade that dropped them.
async function cleanupLegacyQuickstarts(paths: AppPaths) {
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
  // Directories first: cleanupLegacyQuickstarts writes gravestones into
  // quickstartDir, so it must not race the mkdir that creates it
  await ensureDirectoriesExist(paths)
  await Promise.all([
    initializeJsonListFile(paths.recentSessionsPath),
    initializeJsonListFile(paths.globalPluginsPath),
    cleanupLegacyQuickstarts(paths),
  ])
}
