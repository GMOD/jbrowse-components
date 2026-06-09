import fs from 'fs'
import path from 'path'

import { generateFastaIndex } from '@gmod/faidx'
import { app, dialog } from 'electron'

import { getFileStream } from '../fileStream.ts'
import { getFaiPath } from '../paths.ts'
import { ipcHandle } from './channels.ts'

import type { AppPaths } from '../paths.ts'

const FILE_FILTERS = [
  { name: 'JBrowse Session', extensions: ['jbrowse'] },
  { name: 'All Files', extensions: ['*'] },
]

export function registerFileHandlers(paths: AppPaths) {
  ipcHandle('quit', () => {
    app.quit()
  })

  ipcHandle('userData', () => {
    return paths.userData
  })

  ipcHandle('indexFasta', async (_, location) => {
    const filename = 'localPath' in location ? location.localPath : location.uri
    // getFaiPath appends the .fai extension
    const faiPath = getFaiPath(
      paths,
      `${path.basename(filename)}-${Date.now()}`,
    )
    const stream = await getFileStream(location)
    const write = fs.createWriteStream(faiPath)

    await generateFastaIndex(write, stream)
    return faiPath
  })

  ipcHandle('promptOpenFile', async () => {
    const choice = await dialog.showOpenDialog({
      defaultPath: paths.jbrowseDocDir,
      filters: FILE_FILTERS,
    })
    return choice.filePaths[0]
  })

  ipcHandle('promptOpenLocalFile', async (_, defaultDir) => {
    const choice = await dialog.showOpenDialog({
      defaultPath: defaultDir ?? app.getPath('home'),
      filters: [{ name: 'All Files', extensions: ['*'] }],
      properties: ['openFile'],
    })
    return choice.filePaths[0]
  })

  ipcHandle('promptSessionSaveAs', async () => {
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
