import { act, renderHook } from '@testing-library/react'

import { onDeviceLost } from './gpuDevice.ts'
import { RECOVERY_WINDOW_MS } from './recoveryBudget.ts'
import {
  CONTEXT_LOST_REPORT_GRACE_MS,
  isGpuContextLostError,
  useRenderingBackend,
} from './useRenderingBackend.ts'

jest.mock('./gpuDevice.ts', () => ({
  onDeviceLost: jest.fn(() => jest.fn()),
}))

let consoleErrorSpy: jest.SpyInstance

beforeEach(() => {
  jest.useFakeTimers()
  jest.mocked(onDeviceLost).mockClear()
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.useRealTimers()
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

  test('losses a window apart are not one flap, and each gets its own budget', async () => {
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

    // Spend the whole budget, twice, an hour apart. A lifetime counter passes
    // the first round and gives up on the second, leaving a long-lived tab
    // unable to auto-recover at all; the window is what tells the two apart.
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 2; i++) {
        act(() => {
          simulateDeviceLost()
        })
        await act(async () => {})
      }
      expect(model.renderError).toBeUndefined()
      await wait(RECOVERY_WINDOW_MS * 60)
    }

    // 1 initial + 2 rebuilds per round, and no give-up banner in either.
    expect(factory).toHaveBeenCalledTimes(5)
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

  // Advancing inside `act` is what flushes the passive effect that schedules
  // the backoff — advancing outside it does not, which is why this file used to
  // claim fake timers could not drive the recovery path at all. They also fake
  // `performance.now()`, so the budget's window is drivable too.
  //
  // `rerender()` stands in for the observer re-render that re-runs the hook when
  // `renderError` changes in the app.
  const wait = (ms: number) =>
    act(async () => {
      jest.advanceTimersByTime(ms)
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

    // 1 initial + at most MAX_RECOVERIES (2) auto-retries.
    expect(factory).toHaveBeenCalledTimes(3)

    // And it STOPS. Waiting one more backoff cannot tell "gave up" from "the
    // next backoff has not elapsed yet" — the pair that used to stand here read
    // 3 with the give-up branch deleted outright. Outrunning every remaining
    // backoff is what makes the cap the only thing this can be measuring.
    for (let i = 0; i < 10; i++) {
      rerender()
      await wait(30_000)
    }
    expect(factory).toHaveBeenCalledTimes(3)
  })

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
  })

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

    // Nothing user-visible until the grace window for `webglcontextrestored`
    // has passed — and asserted just under it, not just after the dispatch.
    // Any deferral at all satisfies the latter, so the window read 0 with no
    // test noticing.
    await wait(CONTEXT_LOST_REPORT_GRACE_MS - 1)
    expect(model.renderError).toBeUndefined()

    await wait(2)
    expect(isGpuContextLostError(model.renderError)).toBe(true)
  })

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
  })

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
  })

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
  })

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

  test('a new model on the same component gets a fresh canvas element', async () => {
    // A container that renders its children by position hands this hook a new
    // model whenever its list is rebuilt — `LinearComparativeView.setViews`
    // empties and re-reconciles `levels`, so every synteny band's model is
    // replaced under a canvas that survives. Re-initializing on that element is
    // a `dispose()` racing a `create()` on one WebGPU context, and whichever
    // landed last decided whether the band could draw again.
    const canvas = document.createElement('canvas')
    const factory = createMockFactory()
    const first = createMockModel()
    const second = createMockModel()

    const { result, rerender } = renderHook(
      ({ model }) => useRenderingBackend(factory, model),
      { initialProps: { model: first } },
    )
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})
    const keyBefore = result.current.canvasKey

    rerender({ model: second })
    await act(async () => {})

    expect(result.current.canvasKey).not.toBe(keyBefore)
  })

  test("a new model does not inherit the previous display's given-up recovery", async () => {
    // gaveUp is latched per display. Carried across a model swap it would leave
    // the new one unable to auto-recover from its first context loss, silently —
    // the listener returns early and nothing rebuilds.
    const factory = jest
      .fn()
      .mockResolvedValue({ dispose: jest.fn(), setErrorHandler: jest.fn() })
    const first = createReactiveModel()
    const second = createReactiveModel()
    const canvas = document.createElement('canvas')

    const { result, rerender } = renderHook(
      ({ model }) => useRenderingBackend(factory, model),
      { initialProps: { model: first } },
    )
    act(() => {
      result.current.canvasRef(canvas)
    })
    await act(async () => {})

    // Spend the whole budget on the first model: 1 initial init + 2 rebuilds,
    // then the give-up banner.
    for (let i = 0; i < 5; i++) {
      act(() => {
        simulateDeviceLost()
      })
      await act(async () => {})
    }
    expect(factory).toHaveBeenCalledTimes(3)
    expect(isGpuContextLostError(first.renderError)).toBe(true)

    // The swap itself re-initializes, on the fresh element the app's keyed
    // canvas gives it.
    rerender({ model: second })
    await act(async () => {})
    expect(factory).toHaveBeenCalledTimes(4)

    // And the new display's first loss is recovered rather than refused.
    act(() => {
      simulateDeviceLost()
    })
    await act(async () => {})
    expect(factory).toHaveBeenCalledTimes(5)
    expect(second.renderError).toBeUndefined()
  })

  test('a superseded canvas element is not initialized', async () => {
    // The stale pairing this hook used to act on: a `contextVersion` bump
    // remounts the canvas in the commit phase, but the ref callback's
    // `setCanvas` lands in a later render — so the init effect fires once with
    // the new version still holding the previous element. That built a whole
    // backend on an element nothing shows and threw it away, which is the second
    // of the two overlapping inits.
    const canvas1 = document.createElement('canvas')
    const canvas2 = document.createElement('canvas')
    const factory = jest
      .fn()
      .mockResolvedValue({ dispose: jest.fn(), setErrorHandler: jest.fn() })
    const model = createMockModel()

    const { result } = renderHook(() => useRenderingBackend(factory, model))
    act(() => {
      result.current.canvasRef(canvas1)
    })
    await act(async () => {})
    expect(factory).toHaveBeenCalledTimes(1)

    // retry() bumps the version; the element it remounts is already superseded
    // by the time the effect runs, which is what the ref callback records.
    act(() => {
      result.current.canvasRef(canvas2)
      result.current.retry()
    })
    await act(async () => {})

    expect(factory).toHaveBeenCalledTimes(2)
    expect(factory).toHaveBeenLastCalledWith(canvas2)
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
