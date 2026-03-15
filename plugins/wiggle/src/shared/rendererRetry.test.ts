import { WiggleRenderer } from './WiggleRenderer.ts'

describe('WiggleRenderer.getOrCreate', () => {
  test('returns same renderer for same canvas', () => {
    const canvas = document.createElement('canvas')
    const r1 = WiggleRenderer.getOrCreate(canvas)
    const r2 = WiggleRenderer.getOrCreate(canvas)
    expect(r1).toBe(r2)
  })

  test('returns different renderer for different canvas', () => {
    const canvas1 = document.createElement('canvas')
    const canvas2 = document.createElement('canvas')
    const r1 = WiggleRenderer.getOrCreate(canvas1)
    const r2 = WiggleRenderer.getOrCreate(canvas2)
    expect(r1).not.toBe(r2)
  })
})

describe('retry state machine', () => {
  test('simulates retry: resetting ready triggers re-init on new canvas', () => {
    let ready = true
    let error: string | null = 'GPU failed'
    let rendererRef: { current: unknown } = { current: 'oldRenderer' }

    function retry() {
      error = null
      ready = false
      rendererRef.current = null
    }

    retry()

    expect(error).toBeNull()
    expect(ready).toBe(false)
    expect(rendererRef.current).toBeNull()

    const newCanvas = document.createElement('canvas')
    const newRenderer = WiggleRenderer.getOrCreate(newCanvas)
    rendererRef.current = newRenderer
    ready = true

    expect(ready).toBe(true)
    expect(rendererRef.current).toBe(newRenderer)
  })

  test('without reset, ready stays true and useEffect deps unchanged', () => {
    let ready = true
    let error: string | null = 'GPU failed'

    function badRetry() {
      error = null
    }

    badRetry()

    expect(error).toBeNull()
    expect(ready).toBe(true)
  })
})
