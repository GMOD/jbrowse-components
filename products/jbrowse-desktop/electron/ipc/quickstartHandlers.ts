import fs from 'node:fs'
import path from 'node:path'

import { LEGACY_QUICKSTARTS } from '../fileSystemInit.ts'
import { ENCODING, getDeletedMarkerPath, getQuickstartPath } from '../paths.ts'
import { ipcHandle } from './channels.ts'

import type { AppPaths } from '../paths.ts'
import type { SessionSnap } from './channelTypes.ts'

const { readFile, copyFile, readdir, rename, unlink, writeFile } = fs.promises

async function readQuickstart(quickstartPath: string): Promise<SessionSnap> {
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
    // A quickstart is named after the session it came from, and session names
    // are not unique — two sessions can share one, and a nameless one reaches
    // here as "Untitled session". A plain copy let the second silently replace
    // the first, with nothing to undo it from. COPYFILE_EXCL turns that into an
    // EEXIST instead, and it is the open(O_EXCL) the copy already does, so two
    // adds racing each other can't both claim one name either. Retry under a
    // suffixed name the way a file manager would: a duplicate entry the user can
    // delete beats a quickstart they can't get back.
    for (let i = 1; ; i++) {
      const name = i === 1 ? sessionName : `${sessionName} (${i})`
      try {
        await copyFile(
          sessionPath,
          getQuickstartPath(paths, name),
          fs.constants.COPYFILE_EXCL,
        )
        return
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw e
        }
      }
    }
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
