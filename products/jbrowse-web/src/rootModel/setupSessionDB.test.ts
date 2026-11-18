import PluginManager from '@jbrowse/core/PluginManager'
import { destroy, isAlive } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import corePlugins from '../corePlugins.ts'
import { getSessionDB } from '../sessionDB.ts'
import { upsertSessionRows } from '../sessionDbOps.ts'
import sessionModelFactory from '../sessionModel/index.ts'
import { setupSessionDB } from './persistence.ts'
import rootModelFactory from './rootModel.ts'

import type { SessionDBHandle } from '../sessionDbOps.ts'

jest.mock('../makeWorkerInstance', () => () => {})
jest.mock('../sessionDB.ts', () => ({
  getSessionDB: jest.fn(),
}))
jest.mock('../sessionDbOps.ts', () => ({
  ...jest.requireActual('../sessionDbOps.ts'),
  upsertSessionRows: jest.fn(),
}))

type Root = ReturnType<ReturnType<typeof rootModelFactory>['create']>

let root: Root | undefined

function makeRoot() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const created = rootModelFactory({
    pluginManager,
    sessionModelFactory,
  }).create({
    jbrowse: {
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
  created.setSession({ name: 'booted' })
  root = created
  return created
}

function mockSessionDB(getAll = jest.fn().mockResolvedValue([])) {
  const db: Partial<SessionDBHandle> = { getAll }
  jest.mocked(getSessionDB).mockResolvedValue(db as SessionDBHandle)
  return db
}

afterEach(() => {
  if (root && isAlive(root)) {
    destroy(root)
  }
  jest.restoreAllMocks()
})

test('a failed prune still starts autosave, and says nothing', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const db = mockSessionDB(
    jest
      .fn()
      .mockRejectedValueOnce(new Error('prune read failed'))
      .mockResolvedValue([]),
  )
  jest
    .mocked(upsertSessionRows)
    .mockImplementation(async (_db, _snap, ident) => ({
      ...ident,
      favorite: false,
      createdAt: new Date(),
    }))
  const r = makeRoot()

  await setupSessionDB(r)
  await waitFor(() => {
    expect(upsertSessionRows).toHaveBeenCalled()
  })
  r.renameCurrentSession('edited')

  await waitFor(() => {
    expect(upsertSessionRows).toHaveBeenCalledWith(
      db,
      expect.anything(),
      expect.objectContaining({ name: 'edited', edited: true }),
    )
  })
  expect(r.savedSessionMetadata).toEqual([
    expect.objectContaining({ name: 'edited' }),
  ])
  expect(r.session?.snackbarMessages).toEqual([])
})

test('an autosave that keeps failing reports once, and once more when it works again', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockSessionDB()
  let failing = true
  jest.mocked(upsertSessionRows).mockClear()
  jest
    .mocked(upsertSessionRows)
    .mockImplementation(async (_db, _snap, ident) => {
      if (failing) {
        throw new Error('QuotaExceededError')
      }
      return { ...ident, favorite: false, createdAt: new Date() }
    })
  const r = makeRoot()
  const session = r.session!
  const messages = () => session.snackbarMessages.map(m => m.message)
  const settle = async (calls: number) => {
    await waitFor(() => {
      expect(upsertSessionRows).toHaveBeenCalledTimes(calls)
    })
    await new Promise(resolve => {
      setTimeout(resolve, 0)
    })
  }

  await setupSessionDB(r)
  await settle(1)
  r.renameCurrentSession('panned')
  await settle(2)
  expect(messages()).toEqual(['Error: QuotaExceededError'])

  failing = false
  r.renameCurrentSession('zoomed')
  await settle(3)
  r.renameCurrentSession('panned again')
  await settle(4)
  expect(messages()).toEqual([
    'Error: QuotaExceededError',
    'Auto-saving restored',
  ])
})
