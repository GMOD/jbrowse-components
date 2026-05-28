import fs from 'fs'
import path from 'path'

import parseJson from 'json-parse-even-better-errors'

import { getDeletedMarkerPath, getQuickstartPath } from '../paths.ts'
import { ipcHandle } from './channels.ts'

import type { AppPaths } from '../paths.ts'

const { readFile, copyFile, readdir, rename, unlink, writeFile } = fs.promises
const ENCODING = 'utf8'

async function readQuickstart(quickstartPath: string): Promise<unknown> {
  try {
    return parseJson(await readFile(quickstartPath, ENCODING))
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
    const quickstartPath = getQuickstartPath(paths, name)
    const deletedMarkerPath = getDeletedMarkerPath(paths, name)

    await unlink(quickstartPath)
    await writeFile(deletedMarkerPath, '', ENCODING)
  })

  ipcHandle('renameQuickstart', async (_, oldName, newName) => {
    await rename(
      getQuickstartPath(paths, oldName),
      getQuickstartPath(paths, newName),
    )
  })
}
