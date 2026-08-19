import fs from 'node:fs'
import path from 'node:path'

import { shell } from 'electron'

import { blatSession } from '../blatSession.ts'
import {
  ENCODING,
  getLegacyThumbnailPath,
  getThumbnailPath,
  isAutosave,
  isSessionFile,
  newAutosavePath,
  stringify,
  stringifySession,
} from '../paths.ts'
import { logError } from '../util.ts'
import { writeFileAtomic } from '../writeFileAtomic.ts'
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

// How stale a recent-sessions row's `updated` may get while its session is being
// autosaved. Nothing but that timestamp changes on a repeat save of one path, and
// it only feeds "last used" sorting on the start screen, so rewriting the whole
// list once a second for it was the second-largest write in the app.
const RECENT_SESSION_TOUCH_MS = 30_000

// What the last saveSession put on disk, so a save that would rewrite a file
// with what is already in it can skip the write, and one that would only move a
// recent row's timestamp can skip that too.
//
// One slot rather than a map keyed by path, because `data` is the whole
// serialized session — 1.6 MB for a real one — and a map would retain that per
// session path for the life of the process. A slot is also all the throttling
// needs: only one session is open at a time, so every save it can help with is a
// save of the same path as the one before it. Same shape as `lastThumbnail`.
let lastSave:
  | { path: string; data: string; row: RecentSession | undefined }
  | undefined

// Whether this save has to reach recent_sessions.json. The first save of a path
// always does — that is the row that puts the session on the start screen — as
// does one whose name changed, since the row carries it.
function needsRecentSessionTouch(entry: RecentSession) {
  const previous = lastSave?.path === entry.path ? lastSave.row : undefined
  return (
    !previous ||
    previous.name !== entry.name ||
    entry.updated - previous.updated >= RECENT_SESSION_TOUCH_MS
  )
}

// The slot describes what saveSession last put on disk, so anything that changes
// those files another way has to drop it — otherwise the next save reads its own
// stale answer and skips a write that was needed.
function forgetSessionWrites(sessionPaths: string[]) {
  if (lastSave && sessionPaths.includes(lastSave.path)) {
    lastSave = undefined
  }
}

function forgetAllSessionWrites() {
  lastSave = undefined
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
      isAutosave: isAutosave(paths, s.path),
    }))
  })

  ipcHandle('loadSession', async (_, filePath) => {
    const snap = await readSession(filePath)
    if (!snap.assemblies) {
      throw new Error(
        `File at ${filePath} does not appear to be a JBrowse session. It does not contain any assemblies.`,
      )
    }
    return {
      snap,
      // Where this session's edits go, which for a config file is NOT the file
      // it came from. readSession has just rewritten that config's relative uris
      // into absolute localPaths for this machine, and the 1s autosave would
      // write the result straight back — replacing the user's portable
      // config.json with a session snapshot that no other machine, and no
      // jbrowse-web, can read. It is the same burn-in renameSession avoids, and
      // it happened a second after opening, unprompted. So a config is read and
      // left alone; the session it starts gets an autosave of its own.
      sessionPath: isSessionFile(paths, filePath)
        ? filePath
        : newAutosavePath(paths),
    }
  })

  // No write: the session's own autosave creates the file (and its
  // recent-sessions row) a second later, from the session's resolved name
  // rather than the placeholder a caller would have to invent here.
  ipcHandle('newAutosavePath', () => newAutosavePath(paths))

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
    const serialized = stringifySession(paths, sessionPath, snap)
    const samePath = lastSave?.path === sessionPath
    const unchanged = samePath && lastSave?.data === serialized
    const touchRecents = needsRecentSessionTouch(entry)
    // Recorded before the awaits, so two saves racing (the quit flush behind the
    // autosave) can't both decide they are the one that has to write. A rejected
    // write clears it below rather than leaving the file described by bytes that
    // never landed.
    lastSave = {
      path: sessionPath,
      data: serialized,
      row: touchRecents ? entry : samePath ? lastSave?.row : undefined,
    }

    await Promise.all([
      touchRecents
        ? updateRecentSessions(paths.recentSessionsPath, rows =>
            upsertRecentSession(rows, entry),
          )
        : undefined,
      unchanged
        ? undefined
        : writeFileAtomic(sessionPath, serialized).catch((e: unknown) => {
            // the file is not what the slot now claims, so the next save has to
            // write rather than read this back as already-on-disk
            forgetSessionWrites([sessionPath])
            throw e
          }),
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
    forgetSessionWrites(sessionPaths)
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

      // this writes both files behind saveSession's back, so what it cached
      // about them no longer describes what is on disk
      forgetSessionWrites([sessionPath])

      await Promise.all([
        writeFileAtomic(paths.recentSessionsPath, stringify(rows)),
        writeFileAtomic(
          sessionPath,
          stringifySession(paths, sessionPath, session),
        ),
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
    // Every directory of app-generated files, each of them one nothing else ever
    // prunes. faiDir: indexFasta writes one .fai per FASTA opened, its name
    // carrying a timestamp, so re-opening the same file writes another.
    // nameIndicesDir: every text-indexing run writes a whole trix-<timestamp>
    // directory, re-indexing the same track included, and those run to hundreds
    // of megabytes for a large GFF — the biggest thing a reset used to leave
    // behind, and the one nothing in the app could remove. All of it is derived
    // from the user's own files and rebuilt on demand.
    const generatedDirs = [
      paths.autosaveDir,
      paths.thumbnailDir,
      paths.faiDir,
      paths.nameIndicesDir,
    ]
    const toDelete = (
      await Promise.all(
        generatedDirs.map(async dir =>
          (await fs.promises.readdir(dir).catch(() => [])).map(f =>
            path.join(dir, f),
          ),
        ),
      )
    ).flat()
    // saveSession's caches describe files that are about to stop existing
    forgetAllSessionWrites()
    await Promise.all([
      updateRecentSessions(paths.recentSessionsPath, () => []),
      // a global plugin loads into every session, so one that crashes on load
      // makes the app unusable and a reset that left it installed would come
      // back to the same crash having cost the user their sessions
      writeGlobalPlugins(paths),
      // the BLAT partition is persistent, so a solved Cloudflare challenge's
      // cf_clearance outlives a reset unless this clears it
      blatSession().clearStorageData().catch(logError),
      // rm, not unlink: a trix output is a directory, and unlink refuses one —
      // so the entries this handler most needs to remove are the ones a plain
      // unlink would have logged an EISDIR for and left in place
      ...toDelete.map(f =>
        fs.promises.rm(f, { recursive: true, force: true }).catch(logError),
      ),
    ])
  })
}
