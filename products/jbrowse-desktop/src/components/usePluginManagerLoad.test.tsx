import { renderHook, waitFor } from '@testing-library/react'

import { destroyPluginManager } from './StartScreen/util.tsx'
import { usePluginManagerLoad } from './usePluginManagerLoad.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// mocking the module keeps the electron-coupled real util.tsx (and the heavy
// StartScreen tree) from loading, isolating the cancellation logic under test
jest.mock('./StartScreen/util.tsx', () => ({
  loadPluginManager: jest.fn(),
  destroyPluginManager: jest.fn(),
}))

const mockDestroy = jest.mocked(destroyPluginManager)
const load = jest.fn<Promise<PluginManager>, [string]>()
const onLoad = jest.fn()
const onError = jest.fn()
const fakePluginManager = { id: 'pm' } as unknown as PluginManager

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

test('does not load without a source', () => {
  renderHook(() => {
    usePluginManagerLoad(undefined, load, onLoad, onError)
  })
  expect(load).not.toHaveBeenCalled()
})

test('reports the loaded plugin manager and does not destroy it', async () => {
  load.mockResolvedValue(fakePluginManager)
  renderHook(() => {
    usePluginManagerLoad('config-a', load, onLoad, onError)
  })
  await waitFor(() => {
    expect(onLoad).toHaveBeenCalledWith(fakePluginManager)
  })
  expect(load).toHaveBeenCalledWith('config-a')
  expect(mockDestroy).not.toHaveBeenCalled()
  expect(onError).not.toHaveBeenCalled()
})

test('reports load errors', async () => {
  const error = new Error('boom')
  load.mockRejectedValue(error)
  renderHook(() => {
    usePluginManagerLoad('config-a', load, onLoad, onError)
  })
  await waitFor(() => {
    expect(onError).toHaveBeenCalledWith(error)
  })
  expect(onLoad).not.toHaveBeenCalled()
})

// the regression this guards: a load cancelled mid-flight must destroy the
// resolved PluginManager (terminating its RPC workers) rather than orphan it
test('destroys the plugin manager when the load is cancelled before it resolves', async () => {
  let resolveLoad = (_pm: PluginManager) => {}
  load.mockReturnValue(
    new Promise<PluginManager>(res => {
      resolveLoad = res
    }),
  )
  const { unmount } = renderHook(() => {
    usePluginManagerLoad('config-a', load, onLoad, onError)
  })

  unmount()
  resolveLoad(fakePluginManager)

  await waitFor(() => {
    expect(mockDestroy).toHaveBeenCalledWith(fakePluginManager)
  })
  expect(onLoad).not.toHaveBeenCalled()
})

// the ?config= and ?specLink= routes share this hook, so a source that changes
// mid-load must cancel the outgoing one rather than let both land
test('destroys the stale plugin manager when the source changes mid-load', async () => {
  let resolveFirst = (_pm: PluginManager) => {}
  const second = { id: 'pm2' } as unknown as PluginManager
  load
    .mockReturnValueOnce(
      new Promise<PluginManager>(res => {
        resolveFirst = res
      }),
    )
    .mockResolvedValueOnce(second)

  const { rerender } = renderHook(
    ({ source }: { source: string }) => {
      usePluginManagerLoad(source, load, onLoad, onError)
    },
    { initialProps: { source: 'config-a' } },
  )
  rerender({ source: 'https://jbrowse.org/?session=spec-x' })
  resolveFirst(fakePluginManager)

  await waitFor(() => {
    expect(mockDestroy).toHaveBeenCalledWith(fakePluginManager)
  })
  expect(onLoad).toHaveBeenCalledTimes(1)
  expect(onLoad).toHaveBeenCalledWith(second)
})
