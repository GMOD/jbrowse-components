import PluginManager from '@jbrowse/core/PluginManager'
import { destroy, isAlive } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import corePlugins from '../corePlugins.ts'
import { getSessionDB } from '../sessionDB.ts'
import { claimSessionId } from '../sessionLock.ts'
import sessionModelFactory from '../sessionModel/index.ts'
import { saveSessionSnapshot } from './persistence.ts'
import rootModelFactory from './rootModel.ts'

import type { SessionDBHandle } from '../sessionDbOps.ts'

jest.mock('../makeWorkerInstance', () => () => {})
jest.mock('./persistence.ts', () => ({
  ...jest.requireActual('./persistence.ts'),
  saveSessionSnapshot: jest.fn(),
}))
jest.mock('../sessionDB.ts', () => ({
  getSessionDB: jest.fn(),
}))
jest.mock('../sessionLock.ts', () => ({
  ...jest.requireActual('../sessionLock.ts'),
  claimSessionId: jest.fn(async () => 'claimed'),
}))

type Root = ReturnType<ReturnType<typeof rootModelFactory>['create']>

const roots: Root[] = []

function makeRoot(sessionDB: Partial<SessionDBHandle> = {}) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const root = rootModelFactory({ pluginManager, sessionModelFactory }).create({
    jbrowse: {
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
  root.setSession({ name: 'open session' })
  jest.mocked(getSessionDB).mockResolvedValue(sessionDB as SessionDBHandle)
  roots.push(root)
  return root
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}

afterEach(() => {
  for (const root of roots) {
    if (isAlive(root)) {
      destroy(root)
    }
  }
  roots.length = 0
  jest.mocked(saveSessionSnapshot).mockReset()
  jest.mocked(claimSessionId).mockReset()
  jest.mocked(claimSessionId).mockImplementation(async () => 'claimed')
  jest.restoreAllMocks()
})

test('opening a copy saves the session it replaces first', async () => {
  const root = makeRoot()
  const savedNames: string[] = []
  jest.mocked(saveSessionSnapshot).mockImplementation(async session => {
    savedNames.push(session.name)
    return undefined
  })

  await root.openSessionCopy({ id: 'from-file', name: 'dropped' })

  expect(savedNames).toEqual(['open session'])
  expect(root.session?.name).toBe('dropped')
  expect(root.session?.id).not.toBe('from-file')
})

test('a failed save keeps the old session open and says why', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const root = makeRoot()
  jest
    .mocked(saveSessionSnapshot)
    .mockRejectedValue(new Error('QuotaExceededError'))

  await root.openSessionCopy({ name: 'dropped' })

  expect(root.session?.name).toBe('open session')
  expect(root.session?.snackbarMessages.map(m => m.message)).toEqual([
    'Error: QuotaExceededError',
  ])
})

test('a session switch still loading does not replace a copy opened after it', async () => {
  const claim = deferred<'claimed'>()
  jest
    .mocked(claimSessionId)
    .mockImplementation(async id =>
      id === 'saved' ? claim.promise : 'claimed',
    )
  const root = makeRoot({
    get: async () => ({ id: 'saved', name: 'clicked in the list' }),
  })

  const switching = root.activateSession('saved')
  await waitFor(() => {
    expect(claimSessionId).toHaveBeenCalledWith('saved')
  })
  await root.openSessionCopy({ name: 'dropped' })
  claim.resolve('claimed')
  await switching

  expect(root.session?.name).toBe('dropped')
})
