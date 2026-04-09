import { act, renderHook } from '@testing-library/react'

import { useGpuRenderer } from './useGpuRenderer.ts'

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
})
