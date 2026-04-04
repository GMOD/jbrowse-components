import { act, renderHook } from '@testing-library/react'

import { useGpuRenderer } from './useGpuRenderer.ts'

function createMockRendererCache(initResult = true) {
  const renderers = new Map<
    HTMLCanvasElement,
    { init: jest.Mock; dispose: jest.Mock }
  >()

  return {
    getOrCreate(canvas: HTMLCanvasElement) {
      let renderer = renderers.get(canvas)
      if (!renderer) {
        renderer = {
          init: jest.fn(() => Promise.resolve(initResult)),
          dispose: jest.fn(),
        }
        renderers.set(canvas, renderer)
      }
      return renderer
    },
    renderers,
  }
}

function createCanvasRef(canvas?: HTMLCanvasElement) {
  return { current: canvas ?? document.createElement('canvas') }
}

describe('useGpuRenderer', () => {
  test('initializes renderer and sets ready on success', async () => {
    const cache = createMockRendererCache(true)
    const canvasRef = createCanvasRef()

    const { result } = renderHook(() => useGpuRenderer(canvasRef, cache))

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeNull()

    await act(async () => {})

    expect(result.current.ready).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.rendererRef.current).toBeDefined()
  })

  test('sets error when init returns false', async () => {
    const cache = createMockRendererCache(false)
    const canvasRef = createCanvasRef()

    const { result } = renderHook(() => useGpuRenderer(canvasRef, cache))

    await act(async () => {})

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
  })

  test('sets error when init throws', async () => {
    const cache = {
      getOrCreate() {
        return {
          init: () => Promise.reject(new Error('GPU crash')),
          dispose: jest.fn(),
        }
      },
    }
    const canvasRef = createCanvasRef()

    const { result } = renderHook(() => useGpuRenderer(canvasRef, cache))

    await act(async () => {})

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
  })

  test('retry resets error and ready', async () => {
    const cache = createMockRendererCache(false)
    const canvasRef = createCanvasRef()

    const { result } = renderHook(() => useGpuRenderer(canvasRef, cache))

    await act(async () => {})
    expect(result.current.error).toBeInstanceOf(Error)

    act(() => {
      result.current.retry()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.ready).toBe(false)
  })

  test('does nothing when canvas ref is null', async () => {
    const cache = createMockRendererCache(true)
    const canvasRef = { current: null }

    const { result } = renderHook(() => useGpuRenderer(canvasRef, cache))

    await act(async () => {})

    expect(result.current.ready).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.rendererRef.current).toBeNull()
  })
})
