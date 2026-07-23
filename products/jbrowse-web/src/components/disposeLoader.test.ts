import { isAlive } from '@jbrowse/mobx-state-tree'
import { when } from 'mobx'

import SessionLoader from '../SessionLoader.ts'
import { disposeLoader } from './disposeLoader.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// preset config + session, matching what reloadSessionLoader produces, so
// activate() resolves without any network
async function makeActivatedLoader() {
  const loader = SessionLoader.create({
    initialTimestamp: 1,
    configSnapshot: {},
    sessionSource: { type: 'snapshot', snapshot: { id: 'a', name: 'a' } },
  })
  loader.activate(() => {})
  await when(() => loader.ready)
  return loader
}

test('a plain detach keeps the loader alive for re-activation', async () => {
  const loader = await makeActivatedLoader()
  disposeLoader(loader)
  expect(isAlive(loader)).toBe(true)
  // re-activatable: deactivate cleared the autorun but not initializeStarted
  expect(loader.initializeStarted).toBe(true)
  expect(loader.buildAutorunDisposer).toBeUndefined()
})

test('a superseded loader is destroyed on detach', async () => {
  const loader = await makeActivatedLoader()
  loader.setSuperseded()
  disposeLoader(loader)
  expect(isAlive(loader)).toBe(false)
})
