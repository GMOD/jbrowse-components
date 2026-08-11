import fs from 'node:fs'
import path from 'node:path'
import { Writable } from 'node:stream'

import { generateFastaIndex } from '@gmod/faidx'
import { app, dialog } from 'electron'

import { getFileStream } from '../fileStream.ts'
import { SESSION_EXTENSION, getFaiPath, hasSessionExtension } from '../paths.ts'
import { ipcHandle } from './channels.ts'

import type { AppPaths } from '../paths.ts'

// Save-as offers only the session extension, and appends it below when the user
// leaves it off. That is not cosmetic: the extension is how `loadSession` later
// tells a file JBrowse saved from a config it merely read, and so whether the
// session may be written back into it. See isSessionFile.
const FILE_FILTERS = [
  { name: 'JBrowse Session', extensions: [SESSION_EXTENSION.slice(1)] },
  { name: 'All Files', extensions: ['*'] },
]

// the open dialog accepts a saved .jbrowse session OR a hand-written/CLI-built
// config.json, so lead with both extensions (save-as keeps FILE_FILTERS)
const OPEN_FILTERS = [
  { name: 'config.json or .jbrowse file', extensions: ['json', 'jbrowse'] },
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
    const write = Writable.toWeb(fs.createWriteStream(faiPath))

    try {
      await generateFastaIndex(write, stream)
    } catch (e) {
      // a rejected index (e.g. ragged line widths) has already written part of
      // the .fai; leaving it would litter faiDir with files that look valid
      await fs.promises.rm(faiPath, { force: true })
      throw e
    }
    return faiPath
  })

  ipcHandle('promptOpenFile', async () => {
    const choice = await dialog.showOpenDialog({
      defaultPath: paths.jbrowseDocDir,
      filters: OPEN_FILTERS,
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

    // asked case-insensitively, so a user who typed "MySession.JBROWSE" gets
    // that file rather than "MySession.JBROWSE.jbrowse"
    if (choice.filePath && !hasSessionExtension(choice.filePath)) {
      choice.filePath = `${choice.filePath}${SESSION_EXTENSION}`
    }
    return choice.filePath
  })
}
