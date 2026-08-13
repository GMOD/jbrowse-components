import { when } from 'mobx'

import SessionLoader from '../SessionLoader.ts'
import { disposeLoader } from './disposeLoader.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// What this can and cannot say.
//
// It cannot say a worker thread died: jsdom has no web workers, and the browser
// suite cannot see jbrowse's either — page.workers(), browser.targets() and a
// window.Worker wrapper all report none (see agent-docs/TODO.md). What it does
// say is the thing that was actually wrong, which was not that termination was
// broken but that NOTHING CALLED IT. RpcManager.destroy's own docstring names
// this caller and no code did, so a plugin install left a pool of up to five
// workers running for the life of the tab.
//
// A spy on that call is therefore the whole of the regression: the wiring, not
// the effect.
test('tearing down the rootModel terminates its rpc worker pool', async () => {
  const loader = SessionLoader.create({
    initialTimestamp: 1,
    configSnapshot: {},
    sessionSource: { type: 'snapshot', snapshot: { id: 'a', name: 'a' } },
  })
  loader.activate(() => {})
  await when(() => !!loader.pluginManager)

  const { rootModel } = loader.pluginManager!
  const { rpcManager } = rootModel as unknown as {
    rpcManager: { destroy: () => void }
  }
  const destroySpy = jest.spyOn(rpcManager, 'destroy')

  disposeLoader(loader)

  expect(destroySpy).toHaveBeenCalledTimes(1)
})
