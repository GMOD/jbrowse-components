import fs from 'fs'

import { getDeletedMarkerPath, getQuickstartPath } from './paths.ts'

import type { AppPaths } from './paths.ts'

const ENCODING = 'utf8'
const LEGACY_QUICKSTARTS = ['hg19', 'hg38', 'mm10']

function stringify(obj: unknown) {
  return JSON.stringify(obj, null, 2)
}

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
    directories.map(dir =>
      fs.promises.mkdir(dir, { recursive: true }).catch((error: unknown) => {
        console.error(`Failed to create directory ${dir}:`, error)
        throw error
      }),
    ),
  )
}

/**
 * Initializes the recent sessions file if it doesn't exist
 */
export async function initializeRecentSessionsFile(paths: AppPaths) {
  try {
    await fs.promises.access(paths.recentSessionsPath)
  } catch {
    // File doesn't exist, create it
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
  const cleanupPromises = LEGACY_QUICKSTARTS.map(async name => {
    const quickstartPath = getQuickstartPath(paths, name)
    const deletedMarkerPath = getDeletedMarkerPath(paths, name)

    try {
      // Check if both files exist
      const [quickstartExists, markerExists] = await Promise.all([
        fs.promises
          .access(quickstartPath)
          .then(() => true)
          .catch(() => false),
        fs.promises
          .access(deletedMarkerPath)
          .then(() => true)
          .catch(() => false),
      ])

      // Only delete if quickstart exists and hasn't been marked as deleted before
      if (quickstartExists && !markerExists) {
        await fs.promises.unlink(quickstartPath)
        // Create gravestone file to prevent recreation
        await fs.promises.writeFile(deletedMarkerPath, '', ENCODING)
      }
    } catch (e) {
      console.error(`Failed to delete legacy quickstart ${name}:`, e)
    }
  })

  await Promise.all(cleanupPromises)
}

/**
 * Initializes the file system: creates directories and sets up initial files
 */
export async function initializeFileSystem(paths: AppPaths) {
  await ensureDirectoriesExist(paths)
  await initializeRecentSessionsFile(paths)
  await cleanupLegacyQuickstarts(paths)
}
