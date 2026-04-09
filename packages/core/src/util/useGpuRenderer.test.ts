import { act, renderHook } from '@testing-library/react'

import { useGpuRenderer } from './useGpuRenderer.ts'
import { onDeviceLost } from '../gpu/getGpuDevice.ts'

jest.mock('../gpu/getGpuDevice.ts', () => ({
  onDeviceLost: jest.fn(() => jest.fn()),
}))

beforeEach(() => {
  jest.mocked(onDeviceLost).mockClear()
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

function createCanvasRef(canvas?: HTMLCanvasElement) {
  return { current: canvas ?? document.createElement('canvas') }
}

describe('useGpuRenderer', () => {
  test('initializes renderer and sets ready on success', async () => {
    const factory = createMockFactory()
    const canvasRef = createCanvasRef()

    const { result } = renderHook(() => useGpuRenderer(canvasRef, factory))

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeNull()

    await act(async () => {})

    expect(result.current.ready).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.rendererRef.current).toBeDefined()
  })

  test('sets error when factory rejects', async () => {
    const factory = createMockFactory(true)
    const canvasRef = createCanvasRef()

    const { result } = renderHook(() => useGpuRenderer(canvasRef, factory))

    await act(async () => {})

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
  })

  test('retry resets error and ready', async () => {
    const factory = createMockFactory(true)
    const canvasRef = createCanvasRef()

    const { result } = renderHook(() => useGpuRenderer(canvasRef, factory))

    await act(async () => {})
    expect(result.current.error).toBeInstanceOf(Error)

    act(() => {
      result.current.retry()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.ready).toBe(false)
  })

  test('does nothing when canvas ref is null', async () => {
    const factory = createMockFactory()
    const canvasRef = { current: null }

    const { result } = renderHook(() => useGpuRenderer(canvasRef, factory))

    await act(async () => {})

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.rendererRef.current).toBeNull()
  })

  test('disposes old renderer and re-initializes on WebGL context restore', async () => {
    const canvas = document.createElement('canvas')
    const canvasRef = createCanvasRef(canvas)
    const dispose = jest.fn()
    const factory = jest.fn().mockResolvedValue({ dispose })

    const { result } = renderHook(() => useGpuRenderer(canvasRef, factory))
    await act(async () => {})
    expect(result.current.ready).toBe(true)
    expect(factory).toHaveBeenCalledTimes(1)

    act(() => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    })
    act(() => {
      canvas.dispatchEvent(new Event('webglcontextrestored'))
    })
    await act(async () => {})

    expect(dispose).toHaveBeenCalledTimes(1)
    expect(factory).toHaveBeenCalledTimes(2)
    expect(result.current.ready).toBe(true)
  })

  test('prevents default on webglcontextlost to allow restore', () => {
    const canvas = document.createElement('canvas')
    renderHook(() =>
      useGpuRenderer(createCanvasRef(canvas), createMockFactory()),
    )

    const event = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  test('disposes old renderer and re-initializes on WebGPU device loss', async () => {
    const canvas = document.createElement('canvas')
    const canvasRef = createCanvasRef(canvas)
    const dispose = jest.fn()
    const factory = jest.fn().mockResolvedValue({ dispose })

    const { result } = renderHook(() => useGpuRenderer(canvasRef, factory))
    await act(async () => {})
    expect(result.current.ready).toBe(true)
    expect(factory).toHaveBeenCalledTimes(1)

    act(() => {
      simulateDeviceLost()
    })
    await act(async () => {})

    expect(dispose).toHaveBeenCalledTimes(1)
    expect(factory).toHaveBeenCalledTimes(2)
    expect(result.current.ready).toBe(true)
  })

  test('re-initializes when canvas element is replaced after regionTooLarge recovery', async () => {
    const canvas1 = document.createElement('canvas')
    const canvas2 = document.createElement('canvas')
    const canvasRef: { current: HTMLCanvasElement | null } = {
      current: canvas1,
    }
    const dispose = jest.fn()
    const factory = jest.fn().mockResolvedValue({ dispose })

    const { result, rerender } = renderHook(() =>
      useGpuRenderer(canvasRef, factory),
    )
    await act(async () => {})

    expect(result.current.ready).toBe(true)
    expect(factory).toHaveBeenCalledTimes(1)

    // Simulate regionTooLarge: component returns early, canvas unmounts
    canvasRef.current = null
    rerender()
    await act(async () => {})

    // Simulate recovery: regionTooLarge cleared, new canvas element mounts
    // React creates a fresh canvas element on remount — it is not canvas1
    canvasRef.current = canvas2
    rerender()
    await act(async () => {})

    expect(factory).toHaveBeenCalledTimes(2)
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(result.current.ready).toBe(true)
  })

  test('cleans up device lost listener on unmount', () => {
    const cleanup = jest.fn()
    jest.mocked(onDeviceLost).mockReturnValueOnce(cleanup)

    const { unmount } = renderHook(() =>
      useGpuRenderer(createCanvasRef(), createMockFactory()),
    )
    unmount()

    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
