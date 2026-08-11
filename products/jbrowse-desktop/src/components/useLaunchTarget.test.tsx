import { renderHook, waitFor } from '@testing-library/react'

import { onIpc } from '../ipc.ts'
import { destroyPluginManager } from './StartScreen/util.tsx'
import { useLaunchTarget } from './useLaunchTarget.ts'

import type { LaunchTarget } from '../../electron/ipc/channelTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

// as in usePluginManagerLoad.test: mocking the module keeps the
// electron-coupled real util.tsx (and the heavy StartScreen tree) out of the
// way, leaving the sequencing under test
jest.mock('./StartScreen/util.tsx', () => ({
  destroyPluginManager: jest.fn(),
}))

// the real useIpc runs on top of this, so the channel name is part of what the
// tests below check
jest.mock('../ipc.ts', () => ({ onIpc: jest.fn() }))

const mockDestroy = jest.mocked(destroyPluginManager)
const mockOnIpc = jest.mocked(onIpc)

const link: LaunchTarget = {
  type: 'link',
  url: 'https://jbrowse.org/?session=spec-{}',
}
const file: LaunchTarget = { type: 'file', path: '/home/me/my.jbrowse' }

const pluginManagerA = { id: 'pm-a' } as unknown as PluginManager
const pluginManagerB = { id: 'pm-b' } as unknown as PluginManager

function setup(overrides: Partial<Parameters<typeof useLaunchTarget>[0]> = {}) {
  const order: string[] = []
  // genuinely asynchronous, so that dropping the `await` in front of it is a
  // test failure rather than an ordering that happens to still hold: a flush
  // that resolves synchronously would record itself first either way
  const flush = jest.fn(async () => {
    await Promise.resolve()
    order.push('flush')
  })
  const load = jest.fn(async (_target: LaunchTarget) => {
    order.push('load')
    return pluginManagerA
  })
  const onLoad = jest.fn(() => {
    order.push('onLoad')
  })
  const onError = jest.fn()

  // captured from the mocked onIpc, so a test can deliver a push itself
  let deliver!: (target: LaunchTarget) => void
  mockOnIpc.mockImplementation((channel, listener) => {
    expect(channel).toBe('openLaunchTarget')
    deliver = listener
    return () => {}
  })

  const deps = { flush, load, onLoad, onError, ...overrides }
  renderHook(() => {
    useLaunchTarget(deps)
  })
  return {
    ...deps,
    flush,
    order,
    deliver: (t: LaunchTarget) => {
      deliver(t)
    },
  }
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

test('does nothing until a target arrives', () => {
  const { load, flush } = setup()
  expect(load).not.toHaveBeenCalled()
  expect(flush).not.toHaveBeenCalled()
})

// the regression this whole hook exists for: the autosave is debounced by a
// second, so replacing the session without flushing first loses whatever the
// user did in that second
test('flushes the open session before loading the replacement', async () => {
  const { deliver, load, order } = setup()

  deliver(link)

  await waitFor(() => {
    expect(load).toHaveBeenCalledWith(link)
  })
  expect(order).toEqual(['flush', 'load', 'onLoad'])
})

test('installs the loaded manager', async () => {
  const { deliver, onLoad } = setup()

  deliver(file)

  await waitFor(() => {
    expect(onLoad).toHaveBeenCalledWith(pluginManagerA)
  })
  expect(mockDestroy).not.toHaveBeenCalled()
})

// nothing has been torn down when the load fails, so the session that was open
// is still open — the caller notifies against it rather than being dropped on
// the start screen
test('reports a failed load without installing anything', async () => {
  const error = new Error('config 404')
  const { deliver, onLoad, onError } = setup({
    load: jest.fn().mockRejectedValue(error),
  })

  deliver(link)

  await waitFor(() => {
    expect(onError).toHaveBeenCalledWith(error, link)
  })
  expect(onLoad).not.toHaveBeenCalled()
  expect(mockDestroy).not.toHaveBeenCalled()
})

// two links back to back: without the generation guard they install in whatever
// order they resolve, leaving the *earlier* one live and the later one's RPC
// workers the only ones still running
test('a superseded launch is destroyed rather than installed', async () => {
  let resolveFirst = (_pm: PluginManager) => {}
  const load = jest
    .fn<Promise<PluginManager>, [LaunchTarget]>()
    .mockReturnValueOnce(
      new Promise<PluginManager>(res => {
        resolveFirst = res
      }),
    )
    .mockResolvedValueOnce(pluginManagerB)
  const { deliver, onLoad } = setup({ load })

  deliver(link)
  await waitFor(() => {
    expect(load).toHaveBeenCalledTimes(1)
  })
  deliver(file)
  await waitFor(() => {
    expect(onLoad).toHaveBeenCalledWith(pluginManagerB)
  })

  // the first one lands late; it must not overwrite the second
  resolveFirst(pluginManagerA)

  await waitFor(() => {
    expect(mockDestroy).toHaveBeenCalledWith(pluginManagerA)
  })
  expect(onLoad).toHaveBeenCalledTimes(1)
  expect(onLoad).toHaveBeenCalledWith(pluginManagerB)
})
