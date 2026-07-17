import fs from 'node:fs'
import path from 'node:path'

import { app, session } from 'electron'

import { logError } from './util.ts'

interface DownloadState {
  lastDir?: string
}

function stateFile() {
  return path.join(app.getPath('userData'), 'download-state.json')
}

function lastDir() {
  try {
    const state = JSON.parse(
      fs.readFileSync(stateFile(), 'utf8'),
    ) as DownloadState
    if (state.lastDir && fs.statSync(state.lastDir).isDirectory()) {
      return state.lastDir
    }
  } catch {
    // no saved state, invalid JSON, or the directory has since been removed
  }
  return app.getPath('downloads')
}

function setLastDir(dir: string) {
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ lastDir: dir }))
  } catch (e) {
    logError(e)
  }
}

// Chrome silently renames a colliding download to "jbrowse (1).svg"; Electron's
// save dialog instead re-proposes the same name and makes the user confirm an
// overwrite. Match Chrome by proposing the first free name.
function uniquify(dir: string, filename: string) {
  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  let candidate = path.join(dir, filename)
  for (let i = 1; fs.existsSync(candidate); i++) {
    candidate = path.join(dir, `${base} (${i})${ext}`)
  }
  return candidate
}

/**
 * The renderer downloads (SVG/PNG exports, track data, bookmarks) via an anchor
 * click on a blob URL, which Electron surfaces here. Without this the dialog
 * reopens at ~/Downloads with the same name on every export.
 */
export function registerDownloadHandler() {
  session.defaultSession.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({
      defaultPath: uniquify(lastDir(), item.getFilename()),
    })
    item.once('done', (_e, state) => {
      const savePath = item.getSavePath()
      if (state === 'completed' && savePath) {
        setLastDir(path.dirname(savePath))
      }
    })
  })
}
