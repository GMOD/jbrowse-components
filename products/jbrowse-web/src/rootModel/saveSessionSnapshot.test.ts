import PluginManager from '@jbrowse/core/PluginManager'
import { destroy, isAlive } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'
import { getSessionDB } from '../sessionDB.ts'
import { upsertSessionRows } from '../sessionDbOps.ts'
import sessionModelFactory from '../sessionModel/index.ts'
import { saveSessionSnapshot } from './persistence.ts'
import rootModelFactory from './rootModel.ts'

import type { SessionDBHandle, SessionRowIdent } from '../sessionDbOps.ts'

jest.mock('../makeWorkerInstance', () => () => {})
jest.mock('../sessionDB.ts', () => ({
  getSessionDB: jest.fn(),
}))
jest.mock('../sessionDbOps.ts', () => ({
  ...jest.requireActual('../sessionDbOps.ts'),
  upsertSessionRows: jest.fn(),
}))

type Root = ReturnType<ReturnType<typeof rootModelFactory>['create']>

const roots: Root[] = []
const db = {} as SessionDBHandle

function makeRoot() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const root = rootModelFactory({ pluginManager, sessionModelFactory }).create({
    jbrowse: {
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
  root.setSession({ name: 'booted' })
  roots.push(root)
  return root
}

function save(root: Root) {
  return saveSessionSnapshot(root.session!, 'config.json')
}

function row(ident: SessionRowIdent) {
  return { ...ident, favorite: false, createdAt: new Date() }
}

function written() {
  return jest
    .mocked(upsertSessionRows)
    .mock.calls.map(([, , { name, edited }]) => ({ name, edited }))
}

beforeEach(() => {
  jest.mocked(getSessionDB).mockResolvedValue(db)
  jest
    .mocked(upsertSessionRows)
    .mockImplementation(async (_db, _snap, ident) => row(ident))
})

afterEach(() => {
  for (const root of roots) {
    if (isAlive(root)) {
      destroy(root)
    }
  }
  roots.length = 0
  jest.mocked(upsertSessionRows).mockReset()
  sessionStorage.clear()
})

test('the boot write is unedited, a change edited, and an unchanged snapshot skipped', async () => {
  const root = makeRoot()
  await save(root)
  await save(root)
  root.renameCurrentSession('renamed')
  await save(root)
  expect(written()).toEqual([
    { name: 'booted', edited: false },
    { name: 'renamed', edited: true },
  ])
})

// the flush before a session switch has to throw for the switch to stop, and
// it can only throw if it writes
test('a snapshot whose write failed is written again, not skipped as saved', async () => {
  const root = makeRoot()
  await save(root)
  root.renameCurrentSession('renamed')
  jest
    .mocked(upsertSessionRows)
    .mockRejectedValueOnce(new Error('QuotaExceededError'))
  await expect(save(root)).rejects.toThrow('QuotaExceededError')
  await save(root)
  expect(written()).toEqual([
    { name: 'booted', edited: false },
    { name: 'renamed', edited: true },
    { name: 'renamed', edited: true },
  ])
})

test('rewriting a failed boot write keeps it unedited', async () => {
  const root = makeRoot()
  jest
    .mocked(upsertSessionRows)
    .mockRejectedValueOnce(new Error('QuotaExceededError'))
  await expect(save(root)).rejects.toThrow('QuotaExceededError')
  await save(root)
  expect(written()).toEqual([
    { name: 'booted', edited: false },
    { name: 'booted', edited: false },
  ])
})

test('an earlier write landing does not count a later failed one as saved', async () => {
  const root = makeRoot()
  let land = () => {}
  jest.mocked(upsertSessionRows).mockImplementationOnce(
    (_db, _snap, ident) =>
      new Promise(resolve => {
        land = () => {
          resolve(row(ident))
        }
      }),
  )
  const booting = save(root)
  root.renameCurrentSession('renamed')
  jest
    .mocked(upsertSessionRows)
    .mockRejectedValueOnce(new Error('QuotaExceededError'))
  await expect(save(root)).rejects.toThrow('QuotaExceededError')
  land()
  await booting
  await save(root)
  expect(written().at(-1)).toEqual({ name: 'renamed', edited: true })
  expect(written()).toHaveLength(3)
})
