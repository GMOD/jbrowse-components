import fs from 'node:fs'
import path from 'node:path'

import { shell } from 'electron'

import {
  ENCODING,
  getLegacyThumbnailPath,
  getThumbnailPath,
  stringify,
} from '../paths.ts'
import { logError } from '../util.ts'
import { ipcHandle } from './channels.ts'
import { writeGlobalPlugins } from './globalPluginHandlers.ts'
import { relativeUrisToLocalPaths } from './relativeUrisToLocalPaths.ts'

import type { AppPaths } from '../paths.ts'
import type { RecentSession, SessionSnap } from './channelTypes.ts'

const { unlink, readFile, writeFile, rename } = fs.promises
const THUMBNAIL_WIDTH = 500

// `instanceof Error` is deliberately not part of this. A Node error that crosses
// a vm realm — jest's module sandbox today, any future worker boundary — fails
// instanceof while still carrying its code, so the code is the only part worth
// testing, and testing it is what makes these paths reachable from a test at all.
function isNotFound(e: unknown) {
  return (e as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}

// Session files and recent_sessions.json are rewritten whole, the autosave doing
// so once a second for as long as a session is open. writeFile truncates the
// destination first, so a crash, a full disk, or the app being killed mid-write
// leaves a truncated file where the user's session used to be — and the odds of
// landing in that window are proportional to how often it is written.
//
// Write a sibling temp file and rename it into place instead: rename is atomic,
// so a reader sees the whole old file or the whole new one, never half of
// either. The temp is in the destination's own directory, so the rename never
// has to cross a filesystem, and its name carries the pid and a counter so two
// writers (two saves of the same session racing) can't share one.
let tmpFileCounter = 0

async function writeFileAtomic(filePath: string, data: string) {
  const tmpPath = `${filePath}.${process.pid}.${tmpFileCounter++}.tmp`
  try {
    await writeFile(tmpPath, data, ENCODING)
    await rename(tmpPath, filePath)
  } catch (e) {
    // the write failed or never landed; don't leave the fragment next to the
    // user's session file
    await unlink(tmpPath).catch(() => {})
    throw e
  }
}

// A session that was never saved with a window up has no thumbnail, and a file
// deleted outside the app is already gone: neither absence is worth a console
// error, but anything else (a permissions problem) still is.
function unlinkIfPresent(filePath: string) {
  return unlink(filePath).catch((e: unknown) => {
    if (!isNotFound(e)) {
      logError(e)
    }
  })
}

// capturePage stalls on a full readback of the window's framebuffer, so it must
// not ride the 1s autosave: while a user pans, the session snapshot changes
// every tick and this would fire once a second forever. The thumbnail only
// fronts a start-screen card, so a few seconds of staleness costs nothing.
const THUMBNAIL_INTERVAL_MS = 30_000
let lastThumbnail = { path: '', at: 0 }

// undefined when the thumbnail for this save is being skipped
async function captureThumbnail(
  win: Electron.BrowserWindow | null,
  sessionPath: string,
) {
  const now = Date.now()
  // Throttle per session, not globally: a session saved for the first time
  // needs its card populated now, and only a session being saved over and over
  // (the autosave) is worth rate limiting.
  const isFirstSaveOfSession = sessionPath !== lastThumbnail.path
  if (
    !win ||
    (!isFirstSaveOfSession && now - lastThumbnail.at < THUMBNAIL_INTERVAL_MS)
  ) {
    return undefined
  }
  // claimed before the await so concurrent saves can't both get through
  lastThumbnail = { path: sessionPath, at: now }
  // Thumbnail capture is cosmetic; a capturePage rejection must never abort the
  // session write (the 1s autosave would otherwise error every tick)
  return win
    .capturePage()
    .then(page => page.resize({ width: THUMBNAIL_WIDTH }).toDataURL())
    .catch(logError)
}

async function readRecentSessions(
  recentSessionsPath: string,
): Promise<RecentSession[]> {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(recentSessionsPath, ENCODING),
    )
    // A corrupt file that parses to a non-array (e.g. {}) must still yield the
    // empty-list contract; downstream .filter/.findIndex assume an array
    return Array.isArray(parsed) ? (parsed as RecentSession[]) : []
  } catch (e) {
    console.error(
      `Failed to load recent sessions file ${recentSessionsPath}: ${e}`,
    )
    return []
  }
}

// The file exactly as it sits on disk. Anything that reads a session in order to
// write it back (renameSession) has to start here: relativeUrisToLocalPaths
// below rewrites the tree in place, so parsing through it and saving the result
// would burn machine-absolute paths into a config the user only asked to rename.
async function parseSessionFile(sessionPath: string): Promise<SessionSnap> {
  try {
    return JSON.parse(await readFile(sessionPath, ENCODING))
  } catch (e) {
    throw new Error(
      isNotFound(e)
        ? `Session file no longer exists: ${sessionPath}. It may have been moved or deleted.`
        : `Failed to read session ${sessionPath}: ${e}`,
      { cause: e },
    )
  }
}

// The file as the renderer needs it: a hand-written config's relative uris only
// mean anything next to the config, so they are resolved before it crosses the
// IPC boundary.
async function readSession(sessionPath: string): Promise<SessionSnap> {
  const snap = await parseSessionFile(sessionPath)
  relativeUrisToLocalPaths(snap, path.dirname(sessionPath))
  return snap
}

function upsertRecentSession(sessions: RecentSession[], entry: RecentSession) {
  const idx = sessions.findIndex(s => s.path === entry.path)
  if (idx === -1) {
    sessions.unshift(entry)
  } else {
    sessions[idx] = entry
  }
  return sessions
}

// recent_sessions.json is rewritten whole on every change with no file locking.
// The 1s autosave autorun can interleave with a delete/rename at an await point
// and clobber it (or a reader can observe a half-written file). Funnel every
// access through one promise chain so each read-modify-write stays atomic.
let recentSessionsQueue: Promise<unknown> = Promise.resolve()

function serializeRecentSessions<T>(fn: () => Promise<T>): Promise<T> {
  // recentSessionsQueue is always catch-guarded below, so it never rejects and
  // fn always runs — a failing entry must not block the ones behind it. fn's
  // own rejection propagates to this caller only.
  const run = recentSessionsQueue.then(fn)
  recentSessionsQueue = run.catch(() => {})
  return run
}

function updateRecentSessions(
  recentSessionsPath: string,
  update: (rows: RecentSession[]) => RecentSession[],
) {
  return serializeRecentSessions(async () => {
    const next = update(await readRecentSessions(recentSessionsPath))
    await writeFileAtomic(recentSessionsPath, stringify(next))
  })
}

export function registerSessionHandlers(
  paths: AppPaths,
  getMainWindow: () => Electron.BrowserWindow | null,
) {
  ipcHandle('listSessions', async () => {
    const sessions = await serializeRecentSessions(() =>
      readRecentSessions(paths.recentSessionsPath),
    )
    // Autosaves live under autosaveDir, which only the main process knows.
    // Stamp the flag so the renderer can filter/prune them without that path.
    return sessions.map(s => ({
      ...s,
      isAutosave: s.path.startsWith(paths.autosaveDir),
    }))
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
    const now = Date.now()
    const autosavePath = path.join(paths.autosaveDir, `${now}.json`)
    const entry: RecentSession = {
      path: autosavePath,
      updated: now,
      name: snap.defaultSession?.name,
    }

    await Promise.all([
      updateRecentSessions(paths.recentSessionsPath, rows =>
        upsertRecentSession(rows, entry),
      ),
      writeFileAtomic(autosavePath, stringify(snap)),
    ])

    return autosavePath
  })

  ipcHandle('saveSession', async (_, sessionPath, snap) => {
    const entry: RecentSession = {
      path: sessionPath,
      updated: Date.now(),
      name: snap.defaultSession?.name,
    }
    // Started, not awaited, before the writes below: capturePage stalls on a
    // full framebuffer readback, and this handler is also the quit flush
    // (rootModel.flushSession) — the one save whose whole job is to land the
    // last second of edits before the app goes away. Awaiting a cosmetic
    // thumbnail ahead of the session bytes put that at the back of the queue.
    const thumbnail = captureThumbnail(getMainWindow(), sessionPath)

    await Promise.all([
      updateRecentSessions(paths.recentSessionsPath, rows =>
        upsertRecentSession(rows, entry),
      ),
      writeFileAtomic(sessionPath, stringify(snap)),
      // Thumbnail is cosmetic like the capturePage that produced it: a failed
      // write (e.g. an over-long path on Windows) must not reject the session
      // save. Still awaited as part of this handler, so a quit that waits for
      // the save also gets the thumbnail when one was captured.
      thumbnail.then(png =>
        png
          ? writeFile(getThumbnailPath(paths, sessionPath), png).catch(logError)
          : undefined,
      ),
    ])
  })

  ipcHandle('deleteSessions', async (_, sessionPaths) => {
    await Promise.all([
      updateRecentSessions(paths.recentSessionsPath, rows =>
        rows.filter(s => !sessionPaths.includes(s.path)),
      ),
      ...sessionPaths.flatMap(sessionPath => [
        unlinkIfPresent(getThumbnailPath(paths, sessionPath)),
        // an install upgraded from a pre-sha256 build can still hold the
        // legacy-named thumbnail (loadThumbnail migrates one only when the card
        // is viewed), so deleting just the current name orphaned it forever
        unlinkIfPresent(getLegacyThumbnailPath(paths, sessionPath)),
        unlinkIfPresent(sessionPath),
      ]),
    ])
  })

  ipcHandle('removeRecentSession', async (_, sessionPath) => {
    await updateRecentSessions(paths.recentSessionsPath, rows =>
      rows.filter(s => s.path !== sessionPath),
    )
  })

  ipcHandle('renameSession', async (_, sessionPath, newName) => {
    // serialize the whole read-modify-write: the session file is only rewritten
    // when its entry is present in recent_sessions, so the existence check and
    // both writes must happen without another handler mutating the list between
    await serializeRecentSessions(async () => {
      const [rows, session] = await Promise.all([
        readRecentSessions(paths.recentSessionsPath),
        // parseSessionFile, not readSession: this rewrites the file, and a
        // rename must change the name and nothing else
        parseSessionFile(sessionPath),
      ])
      const idx = rows.findIndex(row => row.path === sessionPath)

      if (idx === -1) {
        throw new Error(`Session at ${sessionPath} not found`)
      }

      if (!session.defaultSession) {
        throw new Error('Session has no defaultSession')
      }

      rows[idx]!.name = newName
      session.defaultSession.name = newName

      await Promise.all([
        writeFileAtomic(paths.recentSessionsPath, stringify(rows)),
        writeFileAtomic(sessionPath, stringify(session)),
      ])
    })
  })

  ipcHandle('showItemInFolder', (_, sessionPath) => {
    shell.showItemInFolder(sessionPath)
  })

  ipcHandle('loadThumbnail', async (_, name) => {
    const thumbnailPath = getThumbnailPath(paths, name)
    try {
      return await readFile(thumbnailPath, ENCODING)
    } catch {
      // Migrate a thumbnail written by a pre-sha256 build (encodeURIComponent
      // name) to the current name on first view, so upgrades don't blank cards.
      const legacyPath = getLegacyThumbnailPath(paths, name)
      const data = await readFile(legacyPath, ENCODING).catch(() => undefined)
      if (data !== undefined) {
        await rename(legacyPath, thumbnailPath).catch(logError)
      }
      return data
    }
  })

  ipcHandle('reset', async () => {
    const [autosaveFiles, thumbnailFiles] = await Promise.all([
      fs.promises.readdir(paths.autosaveDir).catch(() => []),
      fs.promises.readdir(paths.thumbnailDir).catch(() => []),
    ])
    const filesToDelete = [
      ...autosaveFiles.map(f => path.join(paths.autosaveDir, f)),
      ...thumbnailFiles.map(f => path.join(paths.thumbnailDir, f)),
    ]
    await Promise.all([
      updateRecentSessions(paths.recentSessionsPath, () => []),
      // a global plugin loads into every session, so one that crashes on load
      // makes the app unusable and a reset that left it installed would come
      // back to the same crash having cost the user their sessions
      writeGlobalPlugins(paths),
      ...filesToDelete.map(f => unlink(f).catch(logError)),
    ])
  })
}
