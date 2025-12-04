import fs from 'fs'

import { ipcMain } from 'electron'
import parseJson from 'json-parse-even-better-errors'

import { getThumbnailPath } from '../paths.ts'

import type { AppPaths } from '../paths.ts'

const { unlink, readFile, writeFile } = fs.promises
const ENCODING = 'utf8'
const THUMBNAIL_WIDTH = 500

export interface RecentSession {
  path: string
  updated: number
  name?: string
}

export interface SessionSnap {
  defaultSession?: {
    name: string
  }
  [key: string]: unknown
}

function stringify(obj: unknown) {
  return JSON.stringify(obj, null, 2)
}

async function readRecentSessions(
  recentSessionsPath: string,
): Promise<RecentSession[]> {
  try {
    return parseJson(await readFile(recentSessionsPath, ENCODING))
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
    return parseJson(await readFile(sessionPath, ENCODING))
  } catch (e) {
    throw new Error(`Failed to read session ${sessionPath}: ${e}`)
  }
}

function upsertRecentSession(
  sessions: RecentSession[],
  entry: RecentSession,
): RecentSession[] {
  const idx = sessions.findIndex(s => s.path === entry.path)
  if (idx === -1) {
    sessions.unshift(entry)
  } else {
    sessions[idx] = entry
  }
  return sessions
}

export function registerSessionHandlers(
  paths: AppPaths,
  getMainWindow: () => Electron.BrowserWindow | null,
) {
  ipcMain.handle(
    'listSessions',
    async (_event: unknown, showAutosaves: boolean) => {
      const sessions = await readRecentSessions(paths.recentSessionsPath)

      return showAutosaves
        ? sessions
        : sessions.filter(f => !f.path.startsWith(paths.autosaveDir))
    },
  )

  ipcMain.handle('loadExternalConfig', async (_event: unknown, sessionPath) => {
    return readFile(sessionPath, ENCODING)
  })

  ipcMain.handle(
    'loadSession',
    async (_event: unknown, sessionPath: string) => {
      const sessionSnapshot = await readSession(sessionPath)
      if (!sessionSnapshot.assemblies) {
        throw new Error(
          `File at ${sessionPath} does not appear to be a JBrowse session. It does not contain any assemblies.`,
        )
      }
      return sessionSnapshot
    },
  )

  ipcMain.handle(
    'createInitialAutosaveFile',
    async (_event: unknown, snap: SessionSnap) => {
      const rows = await readRecentSessions(paths.recentSessionsPath)
      const autosavePath = `${paths.autosaveDir}/${encodeURIComponent(`${Date.now()}`)}.json`
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
    },
  )

  ipcMain.handle(
    'saveSession',
    async (_event: unknown, sessionPath: string, snap: SessionSnap) => {
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
    },
  )

  ipcMain.handle(
    'deleteSessions',
    async (_event: unknown, sessionPaths: string[]) => {
      const sessions = await readRecentSessions(paths.recentSessionsPath)
      const indices = sessions
        .map((r, i) => (sessionPaths.includes(r.path) ? i : undefined))
        .filter((f): f is number => f !== undefined)

      for (let i = indices.length - 1; i >= 0; i--) {
        sessions.splice(indices[i]!, 1)
      }

      await Promise.all([
        writeFile(paths.recentSessionsPath, stringify(sessions)),
        ...sessionPaths.map(sessionPath =>
          unlink(getThumbnailPath(paths, sessionPath)).catch((e: unknown) => {
            console.error(e)
          }),
        ),
        ...sessionPaths.map(sessionPath =>
          unlink(sessionPath).catch((e: unknown) => {
            console.error(e)
          }),
        ),
      ])
    },
  )

  ipcMain.handle(
    'renameSession',
    async (_event: unknown, sessionPath: string, newName: string) => {
      const sessions = await readRecentSessions(paths.recentSessionsPath)
      const session = parseJson(await readFile(sessionPath, ENCODING))
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
    },
  )

  ipcMain.handle('loadThumbnail', async (_event: unknown, name: string) => {
    const thumbnailPath = getThumbnailPath(paths, name)
    try {
      await fs.promises.access(thumbnailPath)
      return await readFile(thumbnailPath, ENCODING)
    } catch {
      return undefined
    }
  })
}
