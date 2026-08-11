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
  const { result } = renderHook(() => useLaunchTarget(deps))
  return {
    ...deps,
    flush,
    order,
    // whether a launch is in flight, as the Loader reads it
    launching: () => result.current,
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
// second, so replacing the session without flushing loses whatever the user did
// in that second.
//
// The flush goes between the load and the install, not before both. The session
// stays live and autosaving through the load, so the only window is the instant
// of replacement — and flushing before a load that takes seconds would leave
// everything done during it unsaved when the manager is destroyed.
test('flushes between loading the replacement and installing it', async () => {
  const { deliver, onLoad, order } = setup()

  deliver(link)

  await waitFor(() => {
    expect(onLoad).toHaveBeenCalled()
  })
  expect(order).toEqual(['load', 'flush', 'onLoad'])
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
  const { deliver, onLoad, onError, flush } = setup({
    load: jest.fn().mockRejectedValue(error),
  })

  deliver(link)

  await waitFor(() => {
    expect(onError).toHaveBeenCalledWith(error, link)
  })
  expect(onLoad).not.toHaveBeenCalled()
  expect(mockDestroy).not.toHaveBeenCalled()
  // nothing is being replaced, so there is nothing to flush for: the session is
  // still open and still autosaving on its own
  expect(flush).not.toHaveBeenCalled()
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

// The swap keeps the open session on screen while it loads, so without this the
// window shows nothing at all between accepting the link and the session
// changing under you. The navigating path it replaced put up a loading screen
// immediately.
describe('the in-flight flag the Loader shows a progress bar for', () => {
  test('is false until a launch arrives', () => {
    expect(setup().launching()).toBe(false)
  })

  test('is set for the whole load and cleared once installed', async () => {
    let resolveLoad = (_pm: PluginManager) => {}
    const { deliver, launching, onLoad } = setup({
      load: jest.fn(
        () =>
          new Promise<PluginManager>(res => {
            resolveLoad = res
          }),
      ),
    })

    deliver(link)
    await waitFor(() => {
      expect(launching()).toBe(true)
    })

    resolveLoad(pluginManagerA)
    await waitFor(() => {
      expect(onLoad).toHaveBeenCalled()
    })
    expect(launching()).toBe(false)
  })

  test('is cleared when a launch fails, so the bar does not run forever', async () => {
    const { deliver, launching, onError } = setup({
      load: jest.fn().mockRejectedValue(new Error('config 404')),
    })

    deliver(link)

    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
    expect(launching()).toBe(false)
  })

  // a superseded launch finishing must not report that the one behind it is
  // done — the bar would go out while a load is still running
  test('stays set when a superseded launch finishes under a live one', async () => {
    let resolveFirst = (_pm: PluginManager) => {}
    let resolveSecond = (_pm: PluginManager) => {}
    const load = jest
      .fn<Promise<PluginManager>, [LaunchTarget]>()
      .mockReturnValueOnce(
        new Promise<PluginManager>(res => {
          resolveFirst = res
        }),
      )
      .mockReturnValueOnce(
        new Promise<PluginManager>(res => {
          resolveSecond = res
        }),
      )
    const { deliver, launching, onLoad } = setup({ load })

    deliver(link)
    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(1)
    })
    deliver(file)
    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2)
    })

    resolveFirst(pluginManagerA)
    await waitFor(() => {
      expect(mockDestroy).toHaveBeenCalledWith(pluginManagerA)
    })
    expect(launching()).toBe(true)

    resolveSecond(pluginManagerB)
    await waitFor(() => {
      expect(onLoad).toHaveBeenCalledWith(pluginManagerB)
    })
    expect(launching()).toBe(false)
  })
})
