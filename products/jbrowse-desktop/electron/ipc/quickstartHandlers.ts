import fs from 'fs'
import path from 'path'

import { LEGACY_QUICKSTARTS } from '../fileSystemInit.ts'
import { getDeletedMarkerPath, getQuickstartPath } from '../paths.ts'
import { ipcHandle } from './channels.ts'

import type { AppPaths } from '../paths.ts'

const { readFile, copyFile, readdir, rename, unlink, writeFile } = fs.promises
const ENCODING = 'utf8'

async function readQuickstart(quickstartPath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(quickstartPath, ENCODING))
  } catch (e) {
    throw new Error(`Failed to read quickstart file ${quickstartPath}: ${e}`, {
      cause: e,
    })
  }
}

export function registerQuickstartHandlers(paths: AppPaths) {
  ipcHandle('listQuickstarts', async () => {
    return (await readdir(paths.quickstartDir))
      .filter(f => path.extname(f) === '.json')
      .map(f => decodeURIComponent(path.basename(f, '.json')))
  })

  ipcHandle('addToQuickstartList', async (_, sessionPath, sessionName) => {
    await copyFile(sessionPath, getQuickstartPath(paths, sessionName))
  })

  ipcHandle('getQuickstart', async (_, name) => {
    return readQuickstart(getQuickstartPath(paths, name))
  })

  ipcHandle('deleteQuickstart', async (_, name) => {
    await unlink(getQuickstartPath(paths, name))
    // Only legacy quickstarts need a gravestone, to stop cleanupLegacyQuickstarts
    // from re-deleting a user-recreated hg19/hg38/mm10 on next startup. Writing
    // one for any other name just leaves an orphan file nothing reads.
    if (LEGACY_QUICKSTARTS.includes(name)) {
      await writeFile(getDeletedMarkerPath(paths, name), '', ENCODING)
    }
  })

  ipcHandle('renameQuickstart', async (_, oldName, newName) => {
    await rename(
      getQuickstartPath(paths, oldName),
      getQuickstartPath(paths, newName),
    )
  })
}
