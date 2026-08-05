/**
 * @jest-environment node
 *
 * Node, not the default jsdom: this is main-process code, and under jsdom an fs
 * error is not `instanceof` the realm's Error — readSession's ENOENT branch would
 * silently take the wrong path in the test while being correct in the app.
 */

import fs from 'node:fs'
import path from 'node:path'

import { getLegacyThumbnailPath, getThumbnailPath } from '../paths.ts'
import { registerSessionHandlers } from './sessionHandlers.ts'
import { captureHandlers, makeTestPaths } from './testUtil.ts'

import type { AppPaths } from '../paths.ts'
import type { SessionSnap } from './channelTypes.ts'

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  shell: { showItemInFolder: jest.fn() },
}))

let dir: string
let paths: AppPaths
let invoke: ReturnType<typeof captureHandlers>
let consoleError: jest.SpyInstance

beforeEach(() => {
  ;({ dir, paths } = makeTestPaths())
  fs.mkdirSync(paths.thumbnailDir, { recursive: true })
  fs.writeFileSync(paths.recentSessionsPath, '[]')
  // null window: captureThumbnail skips, which is what a headless test wants
  invoke = captureHandlers(() => {
    registerSessionHandlers(paths, () => null)
  })
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
  fs.rmSync(dir, { recursive: true, force: true })
})

// Yields to the microtask/IO queue until `pred` holds. Causal, not timed: the
// work it waits on is already started, so this only lets the loop drain.
async function waitFor(pred: () => boolean) {
  for (let i = 0; i < 100 && !pred(); i++) {
    await new Promise(resolve => setImmediate(resolve))
  }
  if (!pred()) {
    throw new Error('condition never held')
  }
}

function writeSession(name: string) {
  const sessionPath = path.join(dir, name)
  fs.writeFileSync(
    sessionPath,
    JSON.stringify({ assemblies: [], defaultSession: { name } }),
  )
  fs.writeFileSync(
    paths.recentSessionsPath,
    JSON.stringify([{ path: sessionPath, updated: 1, name }]),
  )
  return sessionPath
}

test('deleteSessions removes the session, its entry, and both thumbnail names', async () => {
  const sessionPath = writeSession('a.jbrowse')
  // a pre-sha256 install can still hold the legacy-named thumbnail: loadThumbnail
  // only migrates one when its card is viewed, so deleting the current name alone
  // orphaned the legacy file forever
  const current = getThumbnailPath(paths, sessionPath)
  const legacy = getLegacyThumbnailPath(paths, sessionPath)
  fs.writeFileSync(current, 'data:image/png;base64,AAA')
  fs.writeFileSync(legacy, 'data:image/png;base64,BBB')

  await invoke('deleteSessions', [sessionPath])

  expect(fs.existsSync(sessionPath)).toBe(false)
  expect(fs.existsSync(current)).toBe(false)
  expect(fs.existsSync(legacy)).toBe(false)
  expect(JSON.parse(fs.readFileSync(paths.recentSessionsPath, 'utf8'))).toEqual(
    [],
  )
})

test('deleteSessions is silent for a session that never had a thumbnail', async () => {
  const sessionPath = writeSession('b.jbrowse')

  await invoke('deleteSessions', [sessionPath])

  expect(fs.existsSync(sessionPath)).toBe(false)
  // a missing thumbnail is normal (the session was never saved with a window
  // up), so it must not log — every delete used to print an ENOENT
  expect(consoleError).not.toHaveBeenCalled()
})

test('listSessions flags the entries that live in the autosave dir', async () => {
  const autosave = path.join(paths.autosaveDir, '1.json')
  fs.writeFileSync(
    paths.recentSessionsPath,
    JSON.stringify([
      { path: autosave, updated: 2 },
      { path: path.join(dir, 'saved.jbrowse'), updated: 1 },
    ]),
  )

  expect(await invoke('listSessions')).toEqual([
    { path: autosave, updated: 2, isAutosave: true },
    { path: path.join(dir, 'saved.jbrowse'), updated: 1, isAutosave: false },
  ])
})

test('loadSession rejects a file with no assemblies', async () => {
  const sessionPath = path.join(dir, 'notasession.json')
  fs.writeFileSync(sessionPath, JSON.stringify({ hello: 'world' }))

  await expect(invoke('loadSession', sessionPath)).rejects.toThrow(
    /does not contain any assemblies/,
  )
})

test('loadSession names the file when it is gone', async () => {
  await expect(
    invoke('loadSession', path.join(dir, 'missing.jbrowse')),
  ).rejects.toThrow(/no longer exists/)
})

// recent_sessions.json is rewritten whole with no file locking, so every
// read-modify-write goes through one promise chain. These are the interleavings
// that chain exists to prevent — without it each handler reads the same starting
// list and the last write wins, silently dropping the others.
describe('concurrent access to recent_sessions.json', () => {
  test('two saves racing each other both survive', async () => {
    const a = path.join(dir, 'a.jbrowse')
    const b = path.join(dir, 'b.jbrowse')

    await Promise.all([
      invoke('saveSession', a, {
        assemblies: [],
        defaultSession: { name: 'A' },
      }),
      invoke('saveSession', b, {
        assemblies: [],
        defaultSession: { name: 'B' },
      }),
    ])

    const rows = JSON.parse(
      fs.readFileSync(paths.recentSessionsPath, 'utf8'),
    ) as { path: string; name?: string }[]
    expect(rows.map(r => r.name).toSorted()).toEqual(['A', 'B'])
    // and each session file landed too
    expect(fs.existsSync(a)).toBe(true)
    expect(fs.existsSync(b)).toBe(true)
  })

  test('a save racing a delete of a different session does not resurrect it', async () => {
    const kept = writeSession('kept.jbrowse')
    const doomed = path.join(dir, 'doomed.jbrowse')
    fs.writeFileSync(doomed, '{}')
    fs.writeFileSync(
      paths.recentSessionsPath,
      JSON.stringify([
        { path: kept, updated: 1, name: 'kept' },
        { path: doomed, updated: 1, name: 'doomed' },
      ]),
    )

    await Promise.all([
      invoke('saveSession', kept, {
        assemblies: [],
        defaultSession: { name: 'kept' },
      }),
      invoke('deleteSessions', [doomed]),
    ])

    const rows = JSON.parse(
      fs.readFileSync(paths.recentSessionsPath, 'utf8'),
    ) as { path: string }[]
    expect(rows.map(r => r.path)).toEqual([kept])
    expect(fs.existsSync(doomed)).toBe(false)
  })

  test('a failing update does not block the ones queued behind it', async () => {
    // renameSession rejects for a session that is not in the list; the save
    // behind it still has to run
    const later = path.join(dir, 'later.jbrowse')

    const results = await Promise.allSettled([
      invoke('renameSession', path.join(dir, 'absent.jbrowse'), 'nope'),
      invoke('saveSession', later, {
        assemblies: [],
        defaultSession: { name: 'later' },
      }),
    ])

    expect(results[0].status).toBe('rejected')
    expect(results[1].status).toBe('fulfilled')
    const rows = JSON.parse(
      fs.readFileSync(paths.recentSessionsPath, 'utf8'),
    ) as { name?: string }[]
    expect(rows.map(r => r.name)).toEqual(['later'])
  })
})

test('renameSession renames both the list entry and the session file', async () => {
  const sessionPath = writeSession('c.jbrowse')

  await invoke('renameSession', sessionPath, 'A better name')

  const rows = JSON.parse(
    fs.readFileSync(paths.recentSessionsPath, 'utf8'),
  ) as {
    name?: string
  }[]
  expect(rows[0]!.name).toBe('A better name')
  const snap = JSON.parse(fs.readFileSync(sessionPath, 'utf8')) as {
    defaultSession: { name: string }
  }
  expect(snap.defaultSession.name).toBe('A better name')
})

// The session file and recent_sessions.json go out through a temp file and a
// rename, so a crash mid-write can't leave a truncated file where a session used
// to be. What a test can check is the visible half of that: the write lands, and
// nothing is left lying next to it.
test('saving leaves the session and the list intact, with no temp files behind', async () => {
  const sessionPath = path.join(dir, 'atomic.jbrowse')

  await invoke('saveSession', sessionPath, {
    assemblies: [],
    defaultSession: { name: 'atomic' },
  })

  expect(
    (JSON.parse(fs.readFileSync(sessionPath, 'utf8')) as SessionSnap)
      .defaultSession?.name,
  ).toBe('atomic')
  expect(fs.readdirSync(dir).filter(f => f.endsWith('.tmp'))).toEqual([])
  expect(
    fs
      .readdirSync(path.dirname(paths.recentSessionsPath))
      .filter(f => f.endsWith('.tmp')),
  ).toEqual([])
})

test('renameSession leaves a config relative uris alone', async () => {
  // loadSession resolves a hand-written config's relative uris into absolute
  // localPaths for the renderer, in place. Renaming used to go through that same
  // read and then save the result, so renaming a config.json row on the start
  // screen — without ever opening it — burned this machine's paths into the
  // user's config and made it unusable anywhere else.
  const sessionPath = path.join(dir, 'config.json')
  fs.writeFileSync(
    sessionPath,
    JSON.stringify({
      assemblies: [{ sequence: { adapter: { uri: 'ref.fa.gz' } } }],
      defaultSession: { name: 'before' },
    }),
  )
  fs.writeFileSync(
    paths.recentSessionsPath,
    JSON.stringify([{ path: sessionPath, updated: 1, name: 'before' }]),
  )

  await invoke('renameSession', sessionPath, 'after')

  const snap = JSON.parse(fs.readFileSync(sessionPath, 'utf8')) as {
    assemblies: { sequence: { adapter: Record<string, unknown> } }[]
    defaultSession: { name: string }
  }
  expect(snap.defaultSession.name).toBe('after')
  expect(snap.assemblies[0]!.sequence.adapter).toEqual({ uri: 'ref.fa.gz' })
})

test('createInitialAutosaveFile writes the snapshot and lists it', async () => {
  fs.mkdirSync(paths.autosaveDir, { recursive: true })

  const autosavePath = await invoke('createInitialAutosaveFile', {
    assemblies: [],
    defaultSession: { name: 'Fresh' },
  })

  expect(autosavePath.startsWith(paths.autosaveDir)).toBe(true)
  expect(
    (JSON.parse(fs.readFileSync(autosavePath, 'utf8')) as SessionSnap)
      .defaultSession?.name,
  ).toBe('Fresh')
  expect(await invoke('listSessions')).toEqual([
    {
      path: autosavePath,
      updated: expect.any(Number),
      name: 'Fresh',
      isAutosave: true,
    },
  ])
})

test('loadThumbnail migrates a legacy-named thumbnail on first read', async () => {
  const sessionPath = path.join(dir, 'd.jbrowse')
  const legacy = getLegacyThumbnailPath(paths, sessionPath)
  fs.writeFileSync(legacy, 'data:image/png;base64,LEGACY')

  expect(await invoke('loadThumbnail', sessionPath)).toBe(
    'data:image/png;base64,LEGACY',
  )
  // moved, not copied, so the next read hits the current name directly
  expect(fs.existsSync(legacy)).toBe(false)
  expect(fs.readFileSync(getThumbnailPath(paths, sessionPath), 'utf8')).toBe(
    'data:image/png;base64,LEGACY',
  )
})

test('loadThumbnail returns undefined when there is no thumbnail at all', async () => {
  expect(
    await invoke('loadThumbnail', path.join(dir, 'never-saved.jbrowse')),
  ).toBeUndefined()
})

test('reset clears the list, autosaves and thumbnails, and the global plugins', async () => {
  fs.mkdirSync(paths.autosaveDir, { recursive: true })
  const autosave = path.join(paths.autosaveDir, '1.json')
  const thumbnail = path.join(paths.thumbnailDir, 'x.data')
  fs.writeFileSync(autosave, '{}')
  fs.writeFileSync(thumbnail, 'data:')
  fs.writeFileSync(paths.recentSessionsPath, '[{"path":"a","updated":1}]')
  // a global plugin loads into every session, so one that crashes on load makes
  // the app unusable; a reset that left it installed would come back to it
  fs.writeFileSync(paths.globalPluginsPath, '[{"name":"Crasher"}]')

  await invoke('reset')

  expect(JSON.parse(fs.readFileSync(paths.recentSessionsPath, 'utf8'))).toEqual(
    [],
  )
  expect(JSON.parse(fs.readFileSync(paths.globalPluginsPath, 'utf8'))).toEqual(
    [],
  )
  expect(fs.existsSync(autosave)).toBe(false)
  expect(fs.existsSync(thumbnail)).toBe(false)
})

// saveSession is also the quit flush (rootModel.flushSession), the one save
// whose job is to land the last second of edits before the app goes away.
// capturePage stalls on a full framebuffer readback, so the session bytes must
// not queue behind it — they used to, because the capture was awaited first.
test('the session is written without waiting for the thumbnail capture', async () => {
  let releaseCapture: (page: unknown) => void = () => {}
  const capturePage = jest.fn(
    () =>
      new Promise(resolve => {
        releaseCapture = resolve
      }),
  )
  const win = { capturePage } as unknown as Electron.BrowserWindow
  const withWindow = captureHandlers(() => {
    registerSessionHandlers(paths, () => win)
  })

  const sessionPath = path.join(dir, 'quitting.jbrowse')
  const save = withWindow('saveSession', sessionPath, {
    assemblies: [],
    defaultSession: { name: 'quitting' },
  })

  // the capture is in flight and has not resolved; the session file is already
  // on disk rather than queued behind it
  await waitFor(() => fs.existsSync(sessionPath))
  expect(capturePage).toHaveBeenCalled()

  releaseCapture({
    resize: () => ({ toDataURL: () => 'data:image/png;base64,x' }),
  })
  await save
  // and the thumbnail still lands, because the handler awaits it too
  expect(fs.existsSync(getThumbnailPath(paths, sessionPath))).toBe(true)
})
