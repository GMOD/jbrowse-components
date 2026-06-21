import { renderHook, waitFor } from '@testing-library/react'

import { destroyPluginManager, loadPluginManager } from './StartScreen/util.tsx'
import { useConfigLoad } from './useConfigLoad.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// mocking the module keeps the electron-coupled real util.tsx (and the heavy
// StartScreen tree) from loading, isolating the cancellation logic under test
jest.mock('./StartScreen/util.tsx', () => ({
  loadPluginManager: jest.fn(),
  destroyPluginManager: jest.fn(),
}))

const mockLoad = jest.mocked(loadPluginManager)
const mockDestroy = jest.mocked(destroyPluginManager)
const onLoad = jest.fn()
const onError = jest.fn()
const fakePluginManager = { id: 'pm' } as unknown as PluginManager

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

test('does not load without a config', () => {
  renderHook(() => { useConfigLoad(undefined, onLoad, onError) })
  expect(mockLoad).not.toHaveBeenCalled()
})

test('reports the loaded plugin manager and does not destroy it', async () => {
  mockLoad.mockResolvedValue(fakePluginManager)
  renderHook(() => { useConfigLoad('config-a', onLoad, onError) })
  await waitFor(() => {
    expect(onLoad).toHaveBeenCalledWith(fakePluginManager)
  })
  expect(mockDestroy).not.toHaveBeenCalled()
  expect(onError).not.toHaveBeenCalled()
})

test('reports load errors', async () => {
  const error = new Error('boom')
  mockLoad.mockRejectedValue(error)
  renderHook(() => { useConfigLoad('config-a', onLoad, onError) })
  await waitFor(() => {
    expect(onError).toHaveBeenCalledWith(error)
  })
  expect(onLoad).not.toHaveBeenCalled()
})

// the regression this guards: a load cancelled mid-flight must destroy the
// resolved PluginManager (terminating its RPC workers) rather than orphan it
test('destroys the plugin manager when the load is cancelled before it resolves', async () => {
  let resolveLoad = (_pm: PluginManager) => {}
  mockLoad.mockReturnValue(
    new Promise<PluginManager>(res => {
      resolveLoad = res
    }),
  )
  const { unmount } = renderHook(() => {
    useConfigLoad('config-a', onLoad, onError)
  })

  unmount()
  resolveLoad(fakePluginManager)

  await waitFor(() => {
    expect(mockDestroy).toHaveBeenCalledWith(fakePluginManager)
  })
  expect(onLoad).not.toHaveBeenCalled()
})
