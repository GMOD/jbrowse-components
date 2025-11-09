import fs from 'fs'
import path from 'path'

import { ipcMain } from 'electron'
import parseJson from 'json-parse-even-better-errors'

import { getDeletedMarkerPath, getQuickstartPath } from '../paths.ts'

import type { AppPaths } from '../paths.ts'

const { readFile, copyFile, readdir } = fs.promises
const ENCODING = 'utf8'

async function readQuickstart(quickstartPath: string): Promise<unknown> {
  try {
    return parseJson(await readFile(quickstartPath, ENCODING))
  } catch (e) {
    throw new Error(`Failed to read quickstart file ${quickstartPath}: ${e}`)
  }
}

export function registerQuickstartHandlers(paths: AppPaths) {
  ipcMain.handle('listQuickstarts', async (_event: unknown) => {
    return (await readdir(paths.quickstartDir))
      .filter(f => path.extname(f) === '.json')
      .map(f => decodeURIComponent(path.basename(f, '.json')))
  })

  ipcMain.handle(
    'addToQuickstartList',
    async (_event: unknown, sessionPath: string, sessionName: string) => {
      await copyFile(sessionPath, getQuickstartPath(paths, sessionName))
    },
  )

  ipcMain.handle('getQuickstart', async (_event: unknown, name: string) => {
    return readQuickstart(getQuickstartPath(paths, name))
  })

  ipcMain.handle('deleteQuickstart', async (_event: unknown, name: string) => {
    const quickstartPath = getQuickstartPath(paths, name)
    const deletedMarkerPath = getDeletedMarkerPath(paths, name)

    await fs.promises.unlink(quickstartPath)

    // Add a gravestone '.deleted' file when we delete a session, so that if it
    // comes from the https://jbrowse.org/genomes/sessions.json, we don't
    // recreate it
    await fs.promises.writeFile(deletedMarkerPath, '', ENCODING)
  })

  ipcMain.handle(
    'renameQuickstart',
    async (_event: unknown, oldName: string, newName: string) => {
      await fs.promises.rename(
        getQuickstartPath(paths, oldName),
        getQuickstartPath(paths, newName),
      )
    },
  )
}
