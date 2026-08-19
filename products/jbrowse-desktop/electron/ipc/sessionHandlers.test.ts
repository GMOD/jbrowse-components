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

const mockClearStorageData = jest.fn(async () => {})

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  shell: { showItemInFolder: jest.fn() },
  session: {
    fromPartition: () => ({ clearStorageData: mockClearStorageData }),
  },
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

// Waits until `pred` holds, bounded in WALL CLOCK and not in event-loop turns.
//
// This used to spin 100 `setImmediate`s on the theory that the work is already
// started so the loop only has to drain. Draining the loop does not drain
// libuv's threadpool, which is where `writeFile`/`rename` actually run: four
// threads for the whole process, shared with every other fs op jest has in
// flight. And 100 turns of an otherwise-idle loop is ~1ms — so the bound was
// not "let the started work finish", it was "give it one millisecond", which
// held on an idle laptop and lost on a loaded CI runner. It failed there as
// `condition never held`, then afterEach deleted the directory under the write
// that was still queued, whose rejection nobody was awaiting — taking the whole
// jest worker down with it and burying the cause under an ENOENT.
const WAIT_BUDGET_MS = 5000

async function waitFor(pred: () => boolean) {
  const deadline = Date.now() + WAIT_BUDGET_MS
  while (!pred() && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 1))
  }
  if (!pred()) {
    throw new Error(`condition never held within ${WAIT_BUDGET_MS}ms`)
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

// Where a session saves is decided here, once, because getting it wrong is
// silent and destructive: the 1s autosave writes the whole session snapshot to
// `sessionPath`, and for a config that snapshot holds the machine-absolute
// localPaths readSession just resolved.
describe('a config file is read but never saved back over', () => {
  function writeCliConfig(name: string) {
    const configPath = path.join(dir, name)
    fs.writeFileSync(
      configPath,
      // what `jbrowse add-assembly volvox.fa --load copy` writes: relative uris,
      // meaningful only next to the config
      JSON.stringify({
        assemblies: [
          { sequence: { adapter: { fastaLocation: { uri: 'volvox.fa' } } } },
        ],
      }),
    )
    return configPath
  }

  test('a CLI-built config.json gets an autosave of its own', async () => {
    const configPath = writeCliConfig('config.json')

    const { snap, sessionPath } = await invoke('loadSession', configPath)

    // the renderer needs absolute paths, so the snapshot it gets is rewritten
    const { assemblies } = snap as unknown as {
      assemblies: { sequence: { adapter: { fastaLocation: unknown } } }[]
    }
    expect(assemblies[0]!.sequence.adapter.fastaLocation).toEqual({
      locationType: 'LocalPathLocation',
      localPath: path.join(dir, 'volvox.fa'),
    })
    // ...which is exactly why the session must not save there
    expect(sessionPath).not.toBe(configPath)
    expect(sessionPath.startsWith(paths.autosaveDir)).toBe(true)
    // and the config on disk is untouched by having been opened
    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toEqual({
      assemblies: [
        { sequence: { adapter: { fastaLocation: { uri: 'volvox.fa' } } } },
      ],
    })
  })

  test('a .jbrowse session saves in place', async () => {
    const sessionPath = writeSession('saved.jbrowse')

    expect((await invoke('loadSession', sessionPath)).sessionPath).toBe(
      sessionPath,
    )
  })

  test('an autosave saves in place, whatever its extension', async () => {
    fs.mkdirSync(paths.autosaveDir, { recursive: true })
    const autosavePath = path.join(paths.autosaveDir, '1-0.json')
    fs.writeFileSync(autosavePath, JSON.stringify({ assemblies: [] }))

    expect((await invoke('loadSession', autosavePath)).sessionPath).toBe(
      autosavePath,
    )
  })
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

test('newAutosavePath allocates a name without creating anything', async () => {
  const first = await invoke('newAutosavePath')
  const second = await invoke('newAutosavePath')

  expect(first.startsWith(paths.autosaveDir)).toBe(true)
  // two launches must never share a file, even inside one millisecond: nothing
  // creates it here, so a collision would be two sessions saving over each
  // other rather than a visible EEXIST
  expect(second).not.toBe(first)
  // and a launch that fails before its first autosave leaves no orphan file and
  // no recent-sessions row pointing at one
  expect(fs.existsSync(first)).toBe(false)
  expect(await invoke('listSessions')).toEqual([])
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

test('reset clears the list, autosaves, thumbnails, fai indexes, global plugins and the BLAT cookie jar', async () => {
  fs.mkdirSync(paths.autosaveDir, { recursive: true })
  fs.mkdirSync(paths.faiDir, { recursive: true })
  const autosave = path.join(paths.autosaveDir, '1.json')
  const thumbnail = path.join(paths.thumbnailDir, 'x.data')
  // indexFasta writes one of these per FASTA opened, under a timestamped name,
  // and nothing else ever removes them
  const fai = path.join(paths.faiDir, 'volvox.fa-123.fai')
  fs.writeFileSync(autosave, '{}')
  fs.writeFileSync(thumbnail, 'data:')
  fs.writeFileSync(fai, 'ctgA\t50001\t7\t60\t61\n')
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
  expect(fs.existsSync(fai)).toBe(false)
  // persist: partition, so a solved Cloudflare challenge's cf_clearance would
  // otherwise outlive the reset
  expect(mockClearStorageData).toHaveBeenCalled()
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
  // Marks `save` handled without consuming it: an assertion that throws below
  // leaves it pending, afterEach then deletes the directory it is writing into,
  // and an unhandled rejection kills the jest worker rather than reporting the
  // assertion. `await save` at the end still surfaces a genuine failure.
  save.catch(() => {})

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

// The autosave rewrites the whole session once a second for as long as one is
// open, and a real session file runs to ~1.6 MB. What the tests below pin is the
// part of that cost the handler can decline to pay without the user noticing.

test('re-saving identical bytes does not rewrite the session file', async () => {
  const sessionPath = path.join(dir, 'repeat.jbrowse')
  const snap: SessionSnap = {
    assemblies: [],
    defaultSession: { name: 'repeat' },
  }

  await invoke('saveSession', sessionPath, snap)
  const first = fs.statSync(sessionPath).mtimeMs
  // the double write this exists for: quitting flushes, then the close that the
  // quit triggers is held for a second flush of the very same snapshot
  await invoke('saveSession', sessionPath, snap)

  expect(fs.statSync(sessionPath).mtimeMs).toBe(first)
})

test('a changed session is still written', async () => {
  const sessionPath = path.join(dir, 'changed.jbrowse')
  await invoke('saveSession', sessionPath, {
    assemblies: [],
    defaultSession: { name: 'changed' },
  })
  await invoke('saveSession', sessionPath, {
    assemblies: [],
    defaultSession: { name: 'changed' },
    tracks: ['added'],
  })

  const snap = JSON.parse(fs.readFileSync(sessionPath, 'utf8')) as {
    tracks?: string[]
  }
  expect(snap.tracks).toEqual(['added'])
})

// A repeat save of one path moves nothing in its row but `updated`, which only
// sorts the start screen's cards — so the list does not have to be rewritten for
// it. The row still has to appear on the first save, and still has to follow a
// rename, which is what the two halves here check.
test('a repeat autosave leaves recent_sessions.json alone, but a rename lands', async () => {
  const sessionPath = path.join(dir, 'listed.jbrowse')

  await invoke('saveSession', sessionPath, {
    assemblies: [],
    defaultSession: { name: 'listed' },
  })
  const listed = fs.statSync(paths.recentSessionsPath).mtimeMs
  expect(await invoke('listSessions')).toHaveLength(1)

  await invoke('saveSession', sessionPath, {
    assemblies: [],
    defaultSession: { name: 'listed' },
    tracks: ['edited'],
  })
  expect(fs.statSync(paths.recentSessionsPath).mtimeMs).toBe(listed)

  await invoke('saveSession', sessionPath, {
    assemblies: [],
    defaultSession: { name: 'renamed' },
  })
  const rows = (await invoke('listSessions')) as { name?: string }[]
  expect(rows[0]!.name).toBe('renamed')
})

// An autosave is machine-written and reread only by JSON.parse, so it carries no
// indent; a file the user picked a name for is one they may open.
test('an autosave is compact and a saved-as session is indented', async () => {
  fs.mkdirSync(paths.autosaveDir, { recursive: true })
  const snap: SessionSnap = { assemblies: [], defaultSession: { name: 'fmt' } }

  const autosave = path.join(paths.autosaveDir, '1.json')
  await invoke('saveSession', autosave, snap)
  expect(fs.readFileSync(autosave, 'utf8')).not.toContain('\n')

  const savedAs = path.join(dir, 'chosen.jbrowse')
  await invoke('saveSession', savedAs, snap)
  expect(fs.readFileSync(savedAs, 'utf8')).toContain('\n')
})
