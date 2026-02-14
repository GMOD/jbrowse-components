import fs from 'fs'
import path from 'path'

import { generateFastaIndex } from '@gmod/faidx'
import { app, dialog, ipcMain } from 'electron'

import { getFileStream } from '../generateFastaIndex.ts'
import { getFaiPath } from '../paths.ts'

import type { AppPaths } from '../paths.ts'

const FILE_FILTERS = [
  { name: 'JBrowse Session', extensions: ['jbrowse'] },
  { name: 'All Files', extensions: ['*'] },
]

export function registerFileHandlers(paths: AppPaths) {
  ipcMain.handle('quit', () => {
    app.quit()
  })

  ipcMain.handle('userData', () => {
    return paths.userData
  })

  ipcMain.handle(
    'indexFasta',
    async (
      _event: unknown,
      location: { uri: string } | { localPath: string },
    ) => {
      const filename =
        'localPath' in location ? location.localPath : location.uri
      const faiPath = getFaiPath(
        paths,
        `${path.basename(filename)}${Date.now()}.fai`,
      )
      const stream = await getFileStream(location)
      const write = fs.createWriteStream(faiPath)

      await generateFastaIndex(write, stream)
      return faiPath
    },
  )

  ipcMain.handle('promptOpenFile', async (_event: unknown) => {
    const choice = await dialog.showOpenDialog({
      defaultPath: paths.jbrowseDocDir,
      filters: FILE_FILTERS,
    })

    return choice.filePaths[0]
  })

  ipcMain.handle('promptSessionSaveAs', async (_event: unknown) => {
    const choice = await dialog.showSaveDialog({
      defaultPath: paths.defaultSavePath,
      filters: FILE_FILTERS,
    })

    if (choice.filePath && !choice.filePath.endsWith('.jbrowse')) {
      choice.filePath = `${choice.filePath}.jbrowse`
    }
    return choice.filePath
  })
}
