import { createTestEnvironment } from './testEnv.ts'

import type { CanvasFeatureRenderingBackend } from './components/canvasFeatureRenderingBackendTypes.ts'

function makeBackend() {
  const calls = { uploads: 0, renders: 0, releases: 0 }
  const backend: CanvasFeatureRenderingBackend = {
    upload() {
      calls.uploads++
    },
    release() {
      calls.releases++
    },
    setErrorHandler() {},
    renderBlocks() {
      calls.renders++
      return true
    },
    dispose() {},
  }
  return { backend, calls }
}

describe('render lifecycle gate (canRender)', () => {
  it('runs neither callback until the view is measured, then runs both', () => {
    const { createDisplay } = createTestEnvironment()
    const { view, display } = createDisplay(undefined, {
      unmeasuredView: true,
    })
    const { backend, calls } = makeBackend()

    expect(view.initialized).toBe(false)
    expect(display.canRender).toBe(false)

    display.startRenderingBackend(backend)
    expect(calls).toEqual({ uploads: 0, renders: 0, releases: 0 })
    expect(display.canvasDrawn).toBe(false)

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
    ])

    expect(display.canRender).toBe(true)
    expect(calls.renders).toBeGreaterThan(0)
    expect(calls.releases).toBe(0)
  })
})
