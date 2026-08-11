/**
 * @jest-environment node
 *
 * Node, not the default jsdom: this is main-process code doing real filesystem
 * work, and a Node fs error crossing jsdom's realm is not `instanceof` its Error.
 */

import fs from 'node:fs'
import path from 'node:path'

import { LEGACY_QUICKSTARTS } from '../fileSystemInit.ts'
import { getDeletedMarkerPath, getQuickstartPath } from '../paths.ts'
import { registerQuickstartHandlers } from './quickstartHandlers.ts'
import { captureHandlers, makeTestPaths } from './testUtil.ts'

import type { AppPaths } from '../paths.ts'

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  app: { getPath: jest.fn() },
}))

let dir: string
let paths: AppPaths
let invoke: ReturnType<typeof captureHandlers>

beforeEach(() => {
  ;({ dir, paths } = makeTestPaths())
  fs.mkdirSync(paths.quickstartDir, { recursive: true })
  invoke = captureHandlers(() => {
    registerQuickstartHandlers(paths)
  })
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function writeSessionFile(name: string, body: unknown = { assemblies: [] }) {
  const sessionPath = path.join(dir, name)
  fs.writeFileSync(sessionPath, JSON.stringify(body))
  return sessionPath
}

// quickstart files are named encodeURIComponent(name).json, so anything a user
// can type has to survive the round trip — a name with a space or a slash is the
// case that breaks a naive basename
test.each(['plain', 'my genome', 'GRCh38 (patched)', 'a/b', 'ünïcode'])(
  'a quickstart named %p round-trips through the filename',
  async name => {
    await invoke(
      'addToQuickstartList',
      writeSessionFile('s.jbrowse', { assemblies: [], marker: name }),
      name,
    )

    expect(await invoke('listQuickstarts')).toEqual([name])
    expect(await invoke('getQuickstart', name)).toEqual({
      assemblies: [],
      marker: name,
    })
  },
)

// Session names are not unique — two sessions can carry one, and a nameless one
// arrives here as "Untitled session". Adding the second used to overwrite the
// first's quickstart with no way back.
test('a second quickstart of the same name is suffixed, not written over', async () => {
  await invoke(
    'addToQuickstartList',
    writeSessionFile('first.jbrowse', { assemblies: [], marker: 'first' }),
    'My genome',
  )
  await invoke(
    'addToQuickstartList',
    writeSessionFile('second.jbrowse', { assemblies: [], marker: 'second' }),
    'My genome',
  )

  expect((await invoke('listQuickstarts')).toSorted()).toEqual([
    'My genome',
    'My genome (2)',
  ])
  expect(await invoke('getQuickstart', 'My genome')).toEqual({
    assemblies: [],
    marker: 'first',
  })
  expect(await invoke('getQuickstart', 'My genome (2)')).toEqual({
    assemblies: [],
    marker: 'second',
  })
})

test('listQuickstarts ignores the deleted-marker files beside the json', async () => {
  await invoke('addToQuickstartList', writeSessionFile('s.jbrowse'), 'kept')
  fs.writeFileSync(getDeletedMarkerPath(paths, 'hg19'), '')

  expect(await invoke('listQuickstarts')).toEqual(['kept'])
})

test('renameQuickstart moves the file so the new name lists and the old does not', async () => {
  await invoke('addToQuickstartList', writeSessionFile('s.jbrowse'), 'before')

  await invoke('renameQuickstart', 'before', 'after')

  expect(await invoke('listQuickstarts')).toEqual(['after'])
})

// The file is named encodeURIComponent(name).json and listed back by stripping
// that extension, so a blank name produces `.json` — which Node reads as a
// dotfile with no extension, and listQuickstarts therefore never returns. The
// rename looked like it worked and the quickstart was gone for good.
test.each(['', '   '])(
  'renameQuickstart refuses the blank name %p instead of losing the file',
  async blank => {
    await invoke(
      'addToQuickstartList',
      writeSessionFile('s.jbrowse'),
      'keep me',
    )

    await expect(invoke('renameQuickstart', 'keep me', blank)).rejects.toThrow(
      /cannot be blank/,
    )
    expect(await invoke('listQuickstarts')).toEqual(['keep me'])
  },
)

test('addToQuickstartList refuses a blank name', async () => {
  await expect(
    invoke('addToQuickstartList', writeSessionFile('s.jbrowse'), ''),
  ).rejects.toThrow(/cannot be blank/)
  expect(await invoke('listQuickstarts')).toEqual([])
})

// rename(2) replaces its destination silently, so this used to delete the
// quickstart being renamed onto — the same overwrite addToQuickstartList uses
// COPYFILE_EXCL to avoid.
test('renameQuickstart refuses to overwrite another quickstart', async () => {
  await invoke(
    'addToQuickstartList',
    writeSessionFile('a.jbrowse', { assemblies: [], marker: 'a' }),
    'first',
  )
  await invoke(
    'addToQuickstartList',
    writeSessionFile('b.jbrowse', { assemblies: [], marker: 'b' }),
    'second',
  )

  await expect(invoke('renameQuickstart', 'first', 'second')).rejects.toThrow(
    /already exists/,
  )
  expect((await invoke('listQuickstarts')).toSorted()).toEqual([
    'first',
    'second',
  ])
  expect(await invoke('getQuickstart', 'second')).toEqual({
    assemblies: [],
    marker: 'b',
  })
})

// renaming to the name it already has is a no-op, not a conflict with itself
test('renameQuickstart accepts the name it already has', async () => {
  await invoke('addToQuickstartList', writeSessionFile('s.jbrowse'), 'same')

  await invoke('renameQuickstart', 'same', 'same')

  expect(await invoke('listQuickstarts')).toEqual(['same'])
})

describe('deleteQuickstart', () => {
  test('leaves a gravestone for one that shipped with the app', async () => {
    const [legacy] = LEGACY_QUICKSTARTS
    await invoke('addToQuickstartList', writeSessionFile('s.jbrowse'), legacy!)

    await invoke('deleteQuickstart', legacy!)

    expect(await invoke('listQuickstarts')).toEqual([])
    // without the marker, cleanupLegacyQuickstarts would delete a user-recreated
    // hg19 all over again on the next startup
    expect(fs.existsSync(getDeletedMarkerPath(paths, legacy!))).toBe(true)
  })

  test('leaves no gravestone for a name the app never shipped', async () => {
    await invoke('addToQuickstartList', writeSessionFile('s.jbrowse'), 'mine')

    await invoke('deleteQuickstart', 'mine')

    expect(await invoke('listQuickstarts')).toEqual([])
    // a marker for any other name is just an orphan file nothing reads
    expect(fs.existsSync(getDeletedMarkerPath(paths, 'mine'))).toBe(false)
  })
})

test('getQuickstart names the file it could not read', async () => {
  fs.writeFileSync(getQuickstartPath(paths, 'corrupt'), 'not json{')

  await expect(invoke('getQuickstart', 'corrupt')).rejects.toThrow(
    /Failed to read quickstart file/,
  )
})
