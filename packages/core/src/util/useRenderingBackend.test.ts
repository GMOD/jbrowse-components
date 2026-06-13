import { act, renderHook } from '@testing-library/react'

import { useRenderingBackend } from './useRenderingBackend.ts'
import { onDeviceLost } from '../gpu/gpuDevice.ts'

jest.mock('../gpu/gpuDevice.ts', () => ({
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
    return Promise.resolve({ dispose: jest.fn() })
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
    const factory = jest.fn().mockResolvedValue({ dispose })
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
    const factory = jest.fn().mockResolvedValue({ dispose })
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

  test('re-initializes when canvas element is replaced after regionTooLarge recovery', async () => {
    const canvas1 = document.createElement('canvas')
    const canvas2 = document.createElement('canvas')
    const dispose = jest.fn()
    const factory = jest.fn().mockResolvedValue({ dispose })
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
