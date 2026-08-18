import { act, renderHook } from '@testing-library/react'

import { onDeviceLost } from './gpuDevice.ts'
import {
  isGpuContextLostError,
  useRenderingBackend,
} from './useRenderingBackend.ts'

jest.mock('./gpuDevice.ts', () => ({
  onDeviceLost: jest.fn(() => jest.fn()),
}))

let consoleErrorSpy: jest.SpyInstance

beforeEach(() => {
  jest.mocked(onDeviceLost).mockClear()
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

function simulateDeviceLost() {
  const listener = jest.mocked(onDeviceLost).mock.calls.at(-1)?.[0]
  listener?.()
}

function createMockFactory(shouldReject = false) {
  return (_canvas: HTMLCanvasElement) => {
    if (shouldReject) {
      return Promise.reject(new Error('GPU crash'))
    }
    return Promise.resolve({ dispose: jest.fn(), setErrorHandler: jest.fn() })
  }
}

function createMockModel() {
  return {
    startRenderingBackend: jest.fn(),
    stopRenderingBackend: jest.fn(),
    renderNow: jest.fn(),
    renderError: undefined as unknown,
    setRenderError: jest.fn(),
  }
}

// setRenderError actually mutates renderError so the recovery effect (which
// reads model.renderError) observes it across rerenders, mirroring the observer
// re-render that drives it in the app.
function createReactiveModel() {
  const model = {
    startRenderingBackend: jest.fn(),
    stopRenderingBackend: jest.fn(),
    renderNow: jest.fn(),
    renderError: undefined as unknown,
    setRenderError: jest.fn((e: unknown) => {
      model.renderError = e
    }),
  }
  return model
}

describe('useRenderingBackend', () => {
  test('initializes backend and starts it on success', async () => {
    const factory = createMockFactory()
    const canvas = document.createElement('canvas')
    const model = createMockModel()

    const { result } = renderHook(() => useRenderingBackend(factory, model))

    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})

    // clears any stale error then starts the backend
    expect(model.setRenderError).toHaveBeenCalledWith(undefined)
    expect(model.startRenderingBackend).toHaveBeenCalledTimes(1)
    expect(model.startRenderingBackend.mock.calls[0]![0]).toBeDefined()
  })

  test('reports error via setRenderError when factory rejects', async () => {
    const factory = createMockFactory(true)
    const canvas = document.createElement('canvas')
    const model = createMockModel()

    const { result } = renderHook(() => useRenderingBackend(factory, model))
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})

    expect(model.startRenderingBackend).not.toHaveBeenCalled()
    expect(model.setRenderError).toHaveBeenCalledWith(expect.any(Error))
  })

  test('retry clears error via setRenderError', async () => {
    const factory = createMockFactory(true)
    const canvas = document.createElement('canvas')
    const model = createMockModel()

    const { result } = renderHook(() => useRenderingBackend(factory, model))
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})
    expect(model.setRenderError).toHaveBeenLastCalledWith(expect.any(Error))

    act(() => {
      result.current.retry()
    })

    expect(model.setRenderError).toHaveBeenLastCalledWith(undefined)
  })

  test('does nothing when canvas ref is null', async () => {
    const factory = createMockFactory()
    const model = createMockModel()

    renderHook(() => useRenderingBackend(factory, model))
    await act(async () => {})

    expect(model.startRenderingBackend).not.toHaveBeenCalled()
    expect(model.setRenderError).not.toHaveBeenCalled()
  })

  test('disposes old backend and re-initializes on WebGL context restore', async () => {
    const canvas = document.createElement('canvas')
    const dispose = jest.fn()
    const factory = jest
      .fn()
      .mockResolvedValue({ dispose, setErrorHandler: jest.fn() })
    const model = createMockModel()

    const { result } = renderHook(() => useRenderingBackend(factory, model))
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})
    expect(factory).toHaveBeenCalledTimes(1)
    expect(model.startRenderingBackend).toHaveBeenCalledTimes(1)

    act(() => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    })
    act(() => {
      canvas.dispatchEvent(new Event('webglcontextrestored'))
    })
    await act(async () => {})

    expect(dispose).toHaveBeenCalledTimes(1)
    expect(model.stopRenderingBackend).toHaveBeenCalledTimes(1)
    expect(factory).toHaveBeenCalledTimes(2)
    expect(model.startRenderingBackend).toHaveBeenCalledTimes(2)
  })

  test('prevents default on webglcontextlost to allow restore', async () => {
    const canvas = document.createElement('canvas')
    const factory = createMockFactory()
    const model = createMockModel()
    const { result } = renderHook(() => useRenderingBackend(factory, model))
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})

    const event = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  test('disposes old backend and re-initializes on WebGPU device loss', async () => {
    const canvas = document.createElement('canvas')
    const dispose = jest.fn()
    const factory = jest
      .fn()
      .mockResolvedValue({ dispose, setErrorHandler: jest.fn() })
    const model = createMockModel()

    const { result } = renderHook(() => useRenderingBackend(factory, model))
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})
    expect(factory).toHaveBeenCalledTimes(1)

    act(() => {
      simulateDeviceLost()
    })
    await act(async () => {})

    expect(dispose).toHaveBeenCalledTimes(1)
    expect(factory).toHaveBeenCalledTimes(2)
    expect(model.startRenderingBackend).toHaveBeenCalledTimes(2)
  })

  test('stops re-initializing after a bounded number of device losses', async () => {
    const factory = jest
      .fn()
      .mockResolvedValue({ dispose: jest.fn(), setErrorHandler: jest.fn() })
    const model = createReactiveModel()
    const canvas = document.createElement('canvas')

    const { result } = renderHook(() => useRenderingBackend(factory, model))
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})
    expect(factory).toHaveBeenCalledTimes(1)

    // A device that keeps dying. Nothing reports this path, so uncapped it is a
    // display re-initializing against a dead device for as long as the tab is
    // open — the failure the budget exists to stop.
    for (let i = 0; i < 5; i++) {
      act(() => {
        simulateDeviceLost()
      })
      await act(async () => {})
    }

    // 1 initial + at most MAX_RECOVERIES (2) rebuilds.
    expect(factory).toHaveBeenCalledTimes(3)
    // And it says so rather than sitting silently on a dead device.
    expect(isGpuContextLostError(model.renderError)).toBe(true)
  })

  test('a device loss recovers silently while it is within budget', async () => {
    const factory = jest
      .fn()
      .mockResolvedValue({ dispose: jest.fn(), setErrorHandler: jest.fn() })
    const model = createReactiveModel()
    const canvas = document.createElement('canvas')

    const { result } = renderHook(() => useRenderingBackend(factory, model))
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})

    act(() => {
      simulateDeviceLost()
    })
    await act(async () => {})

    expect(factory).toHaveBeenCalledTimes(2)
    // No banner: gpuDevice already dropped the dead device and the re-init got
    // a fresh one, so there is nothing for the user to act on.
    expect(model.renderError).toBeUndefined()
  })

  test('re-initializes when canvas element is replaced after regionTooLarge recovery', async () => {
    const canvas1 = document.createElement('canvas')
    const canvas2 = document.createElement('canvas')
    const dispose = jest.fn()
    const factory = jest
      .fn()
      .mockResolvedValue({ dispose, setErrorHandler: jest.fn() })
    const model = createMockModel()

    const { result } = renderHook(() => useRenderingBackend(factory, model))
    act(() => {
      result.current.canvasRef(canvas1)
    })
    await act(async () => {})

    expect(factory).toHaveBeenCalledTimes(1)

    // Simulate regionTooLarge: component returns early, canvas unmounts
    act(() => {
      result.current.canvasRef(null)
    })
    await act(async () => {})

    // Simulate recovery: new canvas element mounts
    act(() => {
      result.current.canvasRef(canvas2)
    })
    await act(async () => {})

    expect(factory).toHaveBeenCalledTimes(2)
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(model.startRenderingBackend).toHaveBeenCalledTimes(2)
  })

  // Real timers (not fake): jest fake timers block React's passive-effect
  // flush, so the recovery effect — which must run to schedule the backoff —
  // never fires under them. `rerender()` stands in for the observer re-render
  // that re-runs the hook when `renderError` changes in the app.
  const wait = (ms: number) =>
    act(async () => {
      await new Promise(r => setTimeout(r, ms))
    })

  test('auto-recovers from context loss a bounded number of times, then stops', async () => {
    // factory always rejects = GPU capacity never frees, the worst case
    const factory = jest.fn().mockRejectedValue(new Error('context lost'))
    const model = createReactiveModel()
    const canvas = document.createElement('canvas')
    const { result, rerender } = renderHook(() =>
      useRenderingBackend(factory, model),
    )
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})
    expect(factory).toHaveBeenCalledTimes(1)
    expect(model.renderError).toBeInstanceOf(Error)

    // a real context-loss event arms auto-recovery
    act(() => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    })

    // Each cycle: rerender (observer would, on the renderError change) →
    // schedule the next backoff → wait it out → the re-init rejects again.
    // backoff is 1s then 2s; after the cap no further attempt is scheduled.
    rerender()
    await wait(1400)
    rerender()
    await wait(2400)
    rerender()
    await wait(2400)

    // 1 initial + at most MAX_RECOVERIES (2) auto-retries.
    // Crucially it STOPS — no unbounded thrash.
    expect(factory).toHaveBeenCalledTimes(3)
  }, 15000)

  test('does not auto-recover a non-context render error', async () => {
    const factory = jest.fn().mockRejectedValue(new Error('bad config'))
    const model = createReactiveModel()
    const canvas = document.createElement('canvas')
    const { result, rerender } = renderHook(() =>
      useRenderingBackend(factory, model),
    )
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})
    expect(factory).toHaveBeenCalledTimes(1)

    // no webglcontextlost dispatched → recovery must stay disarmed
    rerender()
    await wait(1400)
    rerender()
    await wait(2400)

    expect(factory).toHaveBeenCalledTimes(1)
  }, 10000)

  test('reports a context loss the browser never restores as renderError', async () => {
    const factory = createMockFactory()
    const model = createReactiveModel()
    const canvas = document.createElement('canvas')
    const { result } = renderHook(() => useRenderingBackend(factory, model))
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})
    expect(model.renderError).toBeUndefined()

    act(() => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    })
    // nothing user-visible until the grace window for `webglcontextrestored`
    // has passed
    expect(model.renderError).toBeUndefined()

    await wait(600)
    expect(isGpuContextLostError(model.renderError)).toBe(true)
  }, 10000)

  test('stays silent when the browser restores the context in the grace window', async () => {
    const factory = createMockFactory()
    const model = createReactiveModel()
    const canvas = document.createElement('canvas')
    const { result } = renderHook(() => useRenderingBackend(factory, model))
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})

    act(() => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    })
    act(() => {
      canvas.dispatchEvent(new Event('webglcontextrestored'))
    })
    await wait(600)

    expect(model.renderError).toBeUndefined()
  }, 10000)

  test('does not report a context loss after the canvas unmounts', async () => {
    const factory = createMockFactory()
    const model = createReactiveModel()
    const canvas = document.createElement('canvas')
    const { result } = renderHook(() => useRenderingBackend(factory, model))
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})

    act(() => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    })
    act(() => {
      result.current.canvasRef(null)
    })
    await wait(600)

    expect(model.renderError).toBeUndefined()
  }, 10000)

  test('does not report a context loss across a pagehide teardown', async () => {
    const factory = createMockFactory()
    const model = createReactiveModel()
    const canvas = document.createElement('canvas')
    const { result } = renderHook(() => useRenderingBackend(factory, model))
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})

    act(() => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
      window.dispatchEvent(new Event('pagehide'))
    })
    await wait(600)

    // bfcache thaws the timer after pageshow rebuilt the backend, so a report
    // here would banner a working canvas
    expect(model.renderError).toBeUndefined()
  }, 10000)

  test('canvasKey changes per re-init so a consumer can remount the element', async () => {
    const factory = createMockFactory()
    const model = createReactiveModel()
    const canvas = document.createElement('canvas')
    const { result } = renderHook(() => useRenderingBackend(factory, model))
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})
    const initial = result.current.canvasKey

    // a browser-driven restore rebuilds, and must do so on a new element
    act(() => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
      canvas.dispatchEvent(new Event('webglcontextrestored'))
    })
    await act(async () => {})
    const afterRestore = result.current.canvasKey
    expect(afterRestore).not.toBe(initial)

    act(() => {
      result.current.retry()
    })
    await act(async () => {})
    expect(result.current.canvasKey).not.toBe(afterRestore)
  })

  test('cleans up device lost listener on unmount', () => {
    const cleanup = jest.fn()
    jest.mocked(onDeviceLost).mockReturnValueOnce(cleanup)

    const factory = createMockFactory()
    const model = createMockModel()
    const { unmount } = renderHook(() => useRenderingBackend(factory, model))
    unmount()

    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
