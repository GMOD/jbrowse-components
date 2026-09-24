import fs from 'node:fs'
import path from 'node:path'
import { Writable } from 'node:stream'

import { generateFastaIndex } from '@gmod/faidx'
import { app, dialog } from 'electron'

import { runAbortableJob } from '../abortableJob.ts'
import { analyticsOptedOut } from '../analyticsOptOut.ts'
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

  ipcHandle('analyticsOptedOut', () => {
    return analyticsOptedOut(paths.resources)
  })

  // in-flight indexFasta runs, by the jobId their caller passed. Scoped to this
  // registration rather than the module so a second app window gets its own.
  const indexJobs = new Map<string, AbortController>()

  ipcHandle('indexFasta', (_, location, jobId) =>
    runAbortableJob(indexJobs, jobId, async signal => {
      const filename =
        'localPath' in location ? location.localPath : location.uri
      // getFaiPath appends the .fai extension
      const faiPath = getFaiPath(
        paths,
        `${path.basename(filename)}-${Date.now()}`,
      )
      // opened before anything can fail, so the cleanup below never runs ahead
      // of a stream still creating the file
      const fai = await fs.promises.open(faiPath, 'w')
      try {
        const stream = await getFileStream(location, signal)
        // generateFastaIndex locks the stream it is handed, so cancelling that
        // one is refused: the signal has to abort a pipe in front of it
        await generateFastaIndex(
          Writable.toWeb(fai.createWriteStream()),
          stream.pipeThrough(new TransformStream(), { signal }),
        )
        // an abort landing after the last read still means the user left
        signal.throwIfAborted()
      } catch (e) {
        // a rejected or cancelled index has already written part of the .fai,
        // which would otherwise sit in faiDir looking valid
        await fai.close()
        await fs.promises.rm(faiPath, { force: true })
        throw signal.aborted
          ? new Error('FASTA indexing cancelled', { cause: e })
          : e
      }
      return faiPath
    }),
  )

  ipcHandle('cancelIndexFasta', (_, jobId) => {
    indexJobs.get(jobId)?.abort()
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

    const typed = choice.filePath
    // asked case-insensitively, so a user who typed "MySession.JBROWSE" gets
    // that file rather than "MySession.JBROWSE.jbrowse"
    if (!typed || hasSessionExtension(typed)) {
      return typed
    }
    const filePath = `${typed}${SESSION_EXTENSION}`
    // the dialog asked about overwriting the name as typed, so a file at the
    // name with the extension appended was never asked about
    if (fs.existsSync(filePath)) {
      const { response } = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Replace', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        message: `${path.basename(filePath)} already exists. Replace it?`,
      })
      if (response !== 0) {
        return undefined
      }
    }
    return filePath
  })
}
