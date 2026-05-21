import fs from 'fs'
import path from 'path'

import { ipcMain } from 'electron'
import parseJson from 'json-parse-even-better-errors'

import { getDeletedMarkerPath, getQuickstartPath } from '../paths.ts'

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
  ipcMain.handle('listQuickstarts', async _ => {
    return (await readdir(paths.quickstartDir))
      .filter(f => path.extname(f) === '.json')
      .map(f => decodeURIComponent(path.basename(f, '.json')))
  })

  ipcMain.handle(
    'addToQuickstartList',
    async (_, sessionPath: string, sessionName: string) => {
      await copyFile(sessionPath, getQuickstartPath(paths, sessionName))
    },
  )

  ipcMain.handle('getQuickstart', async (_, name: string) => {
    return readQuickstart(getQuickstartPath(paths, name))
  })

  ipcMain.handle('deleteQuickstart', async (_, name: string) => {
    const quickstartPath = getQuickstartPath(paths, name)
    const deletedMarkerPath = getDeletedMarkerPath(paths, name)

    await unlink(quickstartPath)

    // Add a gravestone '.deleted' file when we delete a session, so that if it
    // comes from the https://jbrowse.org/genomes/sessions.json, we don't
    // recreate it
    await writeFile(deletedMarkerPath, '', ENCODING)
  })

  ipcMain.handle(
    'renameQuickstart',
    async (_, oldName: string, newName: string) => {
      await rename(
        getQuickstartPath(paths, oldName),
        getQuickstartPath(paths, newName),
      )
    },
  )
}
