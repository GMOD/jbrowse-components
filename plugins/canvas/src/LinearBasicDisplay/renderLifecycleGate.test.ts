import { createTestEnvironment } from './testEnv.ts'

import type { CanvasFeatureRenderingBackend } from './components/canvasFeatureRenderingBackendTypes.ts'

// Pins `canRender` (RenderLifecycleMixin's default-true precondition, overridden
// by MultiRegionDisplayMixin / GlobalFetchMixin with `view.initialized`):
// neither lifecycle callback may run before the view is measured, because every
// render callback reads view geometry — `renderBlocks` → `visibleRegions` →
// `view.width` — which throws by design there, and the render autorun turns a
// throw into the GPU render-error banner.
//
// It lives here, not with the mixin, because MultiRegionDisplayMixin can't be
// instantiated standalone (its afterAttach resolves the containing view), so a
// real display in a real view is the only way to exercise the gate. It's also the
// one test that would catch the override silently ceasing to apply, which would
// leave the guard permanently open with nothing else failing.
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

    // attaching installs the autorun pair, which fires immediately — and must
    // find the gate shut rather than read a throwing view getter
    display.startRenderingBackend(backend)
    expect(calls).toEqual({ uploads: 0, renders: 0, releases: 0 })
    expect(display.canvasDrawn).toBe(false)

    // `initialized` is observable, so measuring the view re-fires the pair with
    // no re-attach
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
    ])

    // the upload autorun ran too, but over an empty map it has nothing to
    // hand the backend: a per-key release fires only for a key that left
    expect(display.canRender).toBe(true)
    expect(calls.renders).toBeGreaterThan(0)
    expect(calls.releases).toBe(0)
  })
})
