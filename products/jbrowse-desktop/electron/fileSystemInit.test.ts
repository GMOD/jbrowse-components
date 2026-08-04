/**
 * @jest-environment node
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { LEGACY_QUICKSTARTS, initializeFileSystem } from './fileSystemInit.ts'
import { getDeletedMarkerPath, getQuickstartPath } from './paths.ts'

import type { AppPaths } from './paths.ts'

// paths.ts imports electron for app.getPath, which initializePaths (not used
// here) is the only caller of — the paths under test are built by hand
jest.mock('electron', () => ({ app: { getPath: jest.fn() } }))

let dir: string
let paths: AppPaths

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'jb-fsinit-'))
  paths = {
    userData: dir,
    recentSessionsPath: path.join(dir, 'recent_sessions.json'),
    globalPluginsPath: path.join(dir, 'globalPlugins.json'),
    quickstartDir: path.join(dir, 'quickstart'),
    thumbnailDir: path.join(dir, 'thumbnails'),
    faiDir: path.join(dir, 'fai'),
    autosaveDir: path.join(dir, 'autosaved'),
    jbrowseDocDir: path.join(dir, 'JBrowse'),
    defaultSavePath: path.join(dir, 'JBrowse', 'untitled.jbrowse'),
  }
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

test('creates every directory and seeds both list files', async () => {
  await initializeFileSystem(paths)

  for (const d of [
    paths.quickstartDir,
    paths.faiDir,
    paths.thumbnailDir,
    paths.autosaveDir,
    paths.jbrowseDocDir,
  ]) {
    expect(fs.statSync(d).isDirectory()).toBe(true)
  }
  // both are read elsewhere without an existence check
  expect(JSON.parse(fs.readFileSync(paths.recentSessionsPath, 'utf8'))).toEqual(
    [],
  )
  expect(JSON.parse(fs.readFileSync(paths.globalPluginsPath, 'utf8'))).toEqual(
    [],
  )
})

test('leaves existing list files alone', async () => {
  fs.writeFileSync(paths.recentSessionsPath, '[{"path":"a","updated":1}]')
  fs.writeFileSync(paths.globalPluginsPath, '[{"name":"P"}]')

  await initializeFileSystem(paths)

  expect(JSON.parse(fs.readFileSync(paths.recentSessionsPath, 'utf8'))).toEqual(
    [{ path: 'a', updated: 1 }],
  )
  expect(JSON.parse(fs.readFileSync(paths.globalPluginsPath, 'utf8'))).toEqual([
    { name: 'P' },
  ])
})

test('deletes a legacy quickstart once, then never again', async () => {
  const [name] = LEGACY_QUICKSTARTS
  const quickstart = getQuickstartPath(paths, name!)
  fs.mkdirSync(paths.quickstartDir, { recursive: true })
  fs.writeFileSync(quickstart, '{}')

  await initializeFileSystem(paths)
  expect(fs.existsSync(quickstart)).toBe(false)
  expect(fs.existsSync(getDeletedMarkerPath(paths, name!))).toBe(true)

  // the gravestone is the whole point: a user who recreates it keeps it
  fs.writeFileSync(quickstart, '{"mine":true}')
  await initializeFileSystem(paths)
  expect(fs.existsSync(quickstart)).toBe(true)
})

test('leaves a quickstart that never shipped with the app', async () => {
  const mine = getQuickstartPath(paths, 'my genome')
  fs.mkdirSync(paths.quickstartDir, { recursive: true })
  fs.writeFileSync(mine, '{}')

  await initializeFileSystem(paths)

  expect(fs.existsSync(mine)).toBe(true)
})
