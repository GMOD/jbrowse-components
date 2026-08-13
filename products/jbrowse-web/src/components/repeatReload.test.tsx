import { act, renderHook } from '@testing-library/react'
import { when } from 'mobx'

import SessionLoader from '../SessionLoader.ts'
import { disposeLoader } from './disposeLoader.ts'
import { useLoaderLifecycle } from './useLoaderLifecycle.ts'

import type { SessionLoaderModel } from '../SessionLoader.ts'
import type { WebRootModel } from '../rootModel/rootModel.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// preset config + session so activate() resolves without any network
function makeLoader() {
  return SessionLoader.create({
    initialTimestamp: 1,
    configSnapshot: {},
    sessionSource: { type: 'snapshot', snapshot: { id: 'a', name: 'a' } },
  })
}

// reloadPluginManagerCallback is reachable the way a plugin reaches it: off the
// rootModel this loader built.
async function mountAndGetReloadCallback(
  loader: SessionLoaderModel,
  setLoader: (l: SessionLoaderModel) => void,
) {
  renderHook(() => {
    useLoaderLifecycle(loader, setLoader)
  })
  await act(async () => {
    await when(() => !!loader.pluginManager)
  })
  const rootModel = loader.pluginManager!.rootModel as WebRootModel
  return rootModel.reloadPluginManagerCallback
}

// A plugin can ask for a reload more than once off one rootModel. Apollo does:
// its per-internet-account loop calls reloadPluginManagerCallback without
// breaking, from an async autorun whose synchronous prefix can re-fire and
// leave several continuations in flight, and reaction.dispose() only runs after
// the first one gets through.
//
// The second call lands after the app has already detached the loader the first
// one superseded. Destroying that loader on detach made the late call rebuild a
// replacement out of a freed node — getSnapshot() and setSuperseded() on a dead
// SessionLoader — which MST reports only as a liveliness warning, so it does
// its work and swaps in a third loader built from a corpse.
test('a repeat reload is ignored rather than rebuilt off a freed loader', async () => {
  const loader = makeLoader()
  const built: SessionLoaderModel[] = []
  const reload = await mountAndGetReloadCallback(loader, l => {
    built.push(l)
  })

  const warnings: string[] = []
  const origWarn = console.warn
  console.warn = (...args: unknown[]) => {
    const msg = args.map(a => `${a}`).join(' ')
    if (msg.includes('no longer part of a state tree')) {
      warnings.push(msg)
    } else {
      origWarn(...(args as []))
    }
  }
  try {
    act(() => {
      reload({}, { id: 'b', name: 'b' })
    })
    expect(built).toHaveLength(1)
    expect(loader.superseded).toBe(true)

    // the app detaches the loader its replacement superseded
    act(() => {
      disposeLoader(loader)
    })

    // a second in-flight caller arrives afterwards
    act(() => {
      reload({}, { id: 'c', name: 'c' })
    })
  } finally {
    console.warn = origWarn
  }

  expect(built).toHaveLength(1)
  expect(warnings).toEqual([])
})
