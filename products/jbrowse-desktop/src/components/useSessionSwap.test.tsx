import { act, renderHook } from '@testing-library/react'

import { destroyPluginManager } from './StartScreen/util.tsx'
import { useSessionSwap } from './useSessionSwap.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// as in usePluginManagerLoad.test: mocking the module keeps the
// electron-coupled real util.tsx (and the heavy StartScreen tree) out of the
// way, leaving the sequencing under test
jest.mock('./StartScreen/util.tsx', () => ({
  destroyPluginManager: jest.fn(),
}))

const mockDestroy = jest.mocked(destroyPluginManager)

const pluginManagerA = { id: 'pm-a' } as unknown as PluginManager
const pluginManagerB = { id: 'pm-b' } as unknown as PluginManager

function setup(overrides: Partial<Parameters<typeof useSessionSwap>[0]> = {}) {
  const order: string[] = []
  // genuinely asynchronous, so that dropping the `await` in front of it is a
  // test failure rather than an ordering that happens to still hold: a flush
  // that resolves synchronously would record itself first either way
  const flush = jest.fn(async () => {
    await Promise.resolve()
    order.push('flush')
  })
  const onLoad = jest.fn(() => {
    order.push('onLoad')
  })

  const deps = { flush, onLoad, ...overrides }
  const { result } = renderHook(() => useSessionSwap(deps))
  const load = jest.fn(async () => {
    order.push('load')
    return pluginManagerA
  })
  return {
    ...deps,
    flush,
    order,
    load,
    swap: (fn: () => Promise<PluginManager> = load) => result.current.swap(fn),
    swapping: () => result.current.swapping,
  }
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

test('does nothing until a swap is asked for', () => {
  const { load, flush, onLoad } = setup()
  expect(load).not.toHaveBeenCalled()
  expect(flush).not.toHaveBeenCalled()
  expect(onLoad).not.toHaveBeenCalled()
})

// The regression every route through this hook used to have: the autosave is
// debounced by a second, so replacing the session without flushing loses
// whatever the user did in that second.
//
// The flush goes between the load and the install, not before both. The session
// stays live and autosaving through the load, so the only window is the instant
// of replacement — and flushing before a load that takes seconds would leave
// everything done during it unsaved.
test('flushes between loading the replacement and installing it', async () => {
  const { swap, order, onLoad } = setup()

  await swap()

  expect(onLoad).toHaveBeenCalledWith(pluginManagerA)
  expect(order).toEqual(['load', 'flush', 'onLoad'])
})

test('installs the loaded manager without destroying it', async () => {
  const { swap, onLoad } = setup()

  await swap()

  expect(onLoad).toHaveBeenCalledWith(pluginManagerA)
  expect(mockDestroy).not.toHaveBeenCalled()
})

// Nothing has been torn down when the load fails, so the session that was open
// is still open and still autosaving. The rejection goes to whoever asked for
// the swap — a menu item's dialog reports it inline — rather than being turned
// into a half-built session here.
test('a failed load rejects, installs nothing and flushes nothing', async () => {
  const error = new Error('config 404')
  const { swap, onLoad, flush } = setup()

  await expect(swap(() => Promise.reject(error))).rejects.toThrow('config 404')

  expect(onLoad).not.toHaveBeenCalled()
  expect(mockDestroy).not.toHaveBeenCalled()
  expect(flush).not.toHaveBeenCalled()
})

// two swaps back to back: without the generation guard they install in whatever
// order they resolve, leaving the *earlier* one live and the later one's RPC
// workers the only ones still running
test('a superseded swap is destroyed rather than installed', async () => {
  let resolveFirst = (_pm: PluginManager) => {}
  const { swap, onLoad } = setup()

  const first = swap(
    () =>
      new Promise<PluginManager>(res => {
        resolveFirst = res
      }),
  )
  await swap(() => Promise.resolve(pluginManagerB))
  expect(onLoad).toHaveBeenCalledWith(pluginManagerB)

  // the first one lands late; it must not overwrite the second
  resolveFirst(pluginManagerA)
  await first

  expect(mockDestroy).toHaveBeenCalledWith(pluginManagerA)
  expect(onLoad).toHaveBeenCalledTimes(1)
  expect(onLoad).toHaveBeenCalledWith(pluginManagerB)
})

// The pushed route keeps the open session on screen while it loads, so without
// this the window shows nothing at all between accepting a link and the session
// changing under you. The navigating path it replaced put up a loading screen
// immediately.
// Every assertion here reads committed render state, so each step runs inside
// `act` — without it `result.current` is whatever was rendered before the update
// landed, and "still in flight" would pass by reading a stale `false`.
describe('the in-flight flag the Loader shows a progress bar for', () => {
  test('is false until a swap starts', () => {
    expect(setup().swapping()).toBe(false)
  })

  test('is set for the whole load and cleared once installed', async () => {
    let resolveLoad = (_pm: PluginManager) => {}
    const { swap, swapping, onLoad } = setup()

    let done!: Promise<void>
    await act(async () => {
      done = swap(
        () =>
          new Promise<PluginManager>(res => {
            resolveLoad = res
          }),
      )
    })
    expect(swapping()).toBe(true)

    await act(async () => {
      resolveLoad(pluginManagerA)
      await done
    })

    expect(onLoad).toHaveBeenCalled()
    expect(swapping()).toBe(false)
  })

  test('is cleared when a swap fails, so the bar does not run forever', async () => {
    const { swap, swapping } = setup()

    await act(async () => {
      await expect(
        swap(() => Promise.reject(new Error('nope'))),
      ).rejects.toThrow()
    })

    expect(swapping()).toBe(false)
  })

  // a superseded swap finishing must not report that the one behind it is done —
  // the bar would go out while a load is still running
  test('stays set when a superseded swap finishes under a live one', async () => {
    let resolveFirst = (_pm: PluginManager) => {}
    let resolveSecond = (_pm: PluginManager) => {}
    const { swap, swapping, onLoad } = setup()

    let first!: Promise<void>
    let second!: Promise<void>
    await act(async () => {
      first = swap(
        () =>
          new Promise<PluginManager>(res => {
            resolveFirst = res
          }),
      )
      second = swap(
        () =>
          new Promise<PluginManager>(res => {
            resolveSecond = res
          }),
      )
    })

    await act(async () => {
      resolveFirst(pluginManagerA)
      await first
    })
    expect(mockDestroy).toHaveBeenCalledWith(pluginManagerA)
    expect(swapping()).toBe(true)

    await act(async () => {
      resolveSecond(pluginManagerB)
      await second
    })
    expect(onLoad).toHaveBeenCalledWith(pluginManagerB)
    expect(swapping()).toBe(false)
  })
})
