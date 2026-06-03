import fs from 'fs'
import path from 'path'

import { getThumbnailPath, stringify } from '../paths.ts'
import { ipcHandle } from './channels.ts'

import type { AppPaths } from '../paths.ts'
import type { RecentSession, SessionSnap } from './channels.ts'

export type { RecentSession, SessionSnap }

const { unlink, readFile, writeFile } = fs.promises
const ENCODING = 'utf8'
const THUMBNAIL_WIDTH = 500

async function readRecentSessions(
  recentSessionsPath: string,
): Promise<RecentSession[]> {
  try {
    return JSON.parse(await readFile(recentSessionsPath, ENCODING))
  } catch (e) {
    console.error(
      `Failed to load recent sessions file ${recentSessionsPath}: ${e}`,
    )
    return []
  }
}

async function readSession(
  sessionPath: string,
): Promise<{ assemblies?: unknown[] }> {
  try {
    return JSON.parse(await readFile(sessionPath, ENCODING))
  } catch (e) {
    throw new Error(`Failed to read session ${sessionPath}: ${e}`, { cause: e })
  }
}

function upsertRecentSession(sessions: RecentSession[], entry: RecentSession) {
  const idx = sessions.findIndex(s => s.path === entry.path)
  if (idx === -1) {
    sessions.unshift(entry)
  } else {
    sessions[idx] = entry
  }
}

export function registerSessionHandlers(
  paths: AppPaths,
  getMainWindow: () => Electron.BrowserWindow | null,
) {
  ipcHandle('listSessions', async (_, showAutosaves) => {
    const sessions = await readRecentSessions(paths.recentSessionsPath)
    return showAutosaves
      ? sessions
      : sessions.filter(f => !f.path.startsWith(paths.autosaveDir))
  })

  ipcHandle('loadSession', async (_, sessionPath) => {
    const sessionSnapshot = await readSession(sessionPath)
    if (!sessionSnapshot.assemblies) {
      throw new Error(
        `File at ${sessionPath} does not appear to be a JBrowse session. It does not contain any assemblies.`,
      )
    }
    return sessionSnapshot
  })

  ipcHandle('createInitialAutosaveFile', async (_, snap) => {
    const rows = await readRecentSessions(paths.recentSessionsPath)
    const autosavePath = path.join(paths.autosaveDir, `${Date.now()}.json`)
    const entry: RecentSession = {
      path: autosavePath,
      updated: Date.now(),
      name: snap.defaultSession?.name,
    }

    upsertRecentSession(rows, entry)

    await Promise.all([
      writeFile(paths.recentSessionsPath, stringify(rows)),
      writeFile(autosavePath, stringify(snap)),
    ])

    return autosavePath
  })

  ipcHandle('saveSession', async (_, sessionPath, snap) => {
    const mainWindow = getMainWindow()
    const [page, rows] = await Promise.all([
      mainWindow?.capturePage(),
      readRecentSessions(paths.recentSessionsPath),
    ])

    const png = page?.resize({ width: THUMBNAIL_WIDTH }).toDataURL()
    const entry: RecentSession = {
      path: sessionPath,
      updated: Date.now(),
      name: snap.defaultSession?.name,
    }

    upsertRecentSession(rows, entry)

    await Promise.all([
      ...(png ? [writeFile(getThumbnailPath(paths, sessionPath), png)] : []),
      writeFile(paths.recentSessionsPath, stringify(rows)),
      writeFile(sessionPath, stringify(snap)),
    ])
  })

  ipcHandle('deleteSessions', async (_, sessionPaths) => {
    const sessions = await readRecentSessions(paths.recentSessionsPath)
    const remaining = sessions.filter(s => !sessionPaths.includes(s.path))

    await Promise.all([
      writeFile(paths.recentSessionsPath, stringify(remaining)),
      ...sessionPaths.flatMap(sessionPath => [
        unlink(getThumbnailPath(paths, sessionPath)).catch((e: unknown) => {
          console.error(e)
        }),
        unlink(sessionPath).catch((e: unknown) => {
          console.error(e)
        }),
      ]),
    ])
  })

  ipcHandle('renameSession', async (_, sessionPath, newName) => {
    const sessions = await readRecentSessions(paths.recentSessionsPath)
    const session = JSON.parse(await readFile(sessionPath, ENCODING))
    const idx = sessions.findIndex(row => row.path === sessionPath)

    if (idx === -1) {
      throw new Error(`Session at ${sessionPath} not found`)
    }

    if (!session.defaultSession) {
      throw new Error('Session has no defaultSession')
    }

    sessions[idx]!.name = newName
    session.defaultSession.name = newName

    await Promise.all([
      writeFile(paths.recentSessionsPath, stringify(sessions)),
      writeFile(sessionPath, stringify(session)),
    ])
  })

  ipcHandle('loadThumbnail', async (_, name) => {
    try {
      return await readFile(getThumbnailPath(paths, name), ENCODING)
    } catch {
      return undefined
    }
  })

  ipcHandle('reset', async () => {
    const [autosaveFiles, thumbnailFiles] = await Promise.all([
      fs.promises.readdir(paths.autosaveDir).catch(() => [] as string[]),
      fs.promises.readdir(paths.thumbnailDir).catch(() => [] as string[]),
    ])
    const filesToDelete = [
      ...autosaveFiles.map(f => path.join(paths.autosaveDir, f)),
      ...thumbnailFiles.map(f => path.join(paths.thumbnailDir, f)),
    ]
    await Promise.all([
      writeFile(paths.recentSessionsPath, stringify([])),
      ...filesToDelete.map(f =>
        unlink(f).catch((e: unknown) => {
          console.error(e)
        }),
      ),
    ])
  })
}
