import { types } from '@jbrowse/mobx-state-tree'
import { computeDisplayPhase } from '@jbrowse/render-core/displayPhase'

import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'
import type { RenderingBackend } from '@jbrowse/render-core/renderingBackendBase'

// Shared fixture for the two chrome suites: `DisplayChrome.test.tsx` drives the
// MUI overlay set, `plainChromeOverlays.test.tsx` drives the toolkit-free one.
// One model, so "the plain set honors the same contract" is a claim both suites
// test against identical state rather than two hand-built approximations that
// can quietly diverge.

export interface StubBackend extends RenderingBackend {}

export function stubFactory() {
  return Promise.resolve<StubBackend>({
    dispose() {},
    setErrorHandler() {},
  })
}

// Minimal real MST model satisfying `ChromeModel & RenderLifecycleModel`.
// `displayPhase` is computed through the production `computeDisplayPhase` with a
// lazy loading thunk, so the model mirrors the real precedence/laziness contract
// rather than hard-coding a phase string.
export const TestChromeModel = types
  .model('TestChromeModel', {
    // the chrome reads `configuration.displayId` for its `data-display-id`
    configuration: types.optional(
      types.frozen<{ displayId: string }>(),
      () => ({ displayId: 'test-display' }),
    ),
    height: 100,
    regionTooLarge: false,
    regionTooLargeReason: '',
    // the banner's "is zooming in still honest advice" axis, which
    // `RegionTooLargeMixin` answers from two consecutive byte measurements.
    // True is that getter's own default, i.e. "not yet proven otherwise"
    zoomCanReleaseGate: true,
    canvasDrawn: false,
    // the `rendersCanvas` half of `painted` below, so a suite can drive the
    // "deliberate static placeholder" case the raw flag cannot express
    rendersCanvas: true,
    statusMessage: types.maybe(types.string),
    statusProgress: types.maybe(types.number),
  })
  .volatile(
    (): {
      error: unknown
      renderError: unknown
      loadingCondition: boolean
    } => ({
      error: undefined,
      renderError: undefined,
      loadingCondition: false,
    }),
  )
  .views(self => ({
    // mirrors RenderLifecycleMixin.painted rather than restating a boolean, so
    // the chrome suites exercise the production rule — all three terms, with
    // `paintInert` filled the way both LGV fetch families fill it (`!!error`).
    // Dropping that term made the fixture disagree with every real display in
    // exactly the state it exists to cover: a fetch that failed before first
    // paint, whose canvas stays mounted so the raw flag can never flip.
    get painted(): boolean {
      return self.canvasDrawn || !self.rendersCanvas || !!self.error
    },
    get displayPhase(): DisplayPhase {
      return computeDisplayPhase(
        {
          renderError: self.renderError,
          regionTooLarge: self.regionTooLarge,
          error: self.error,
        },
        () => self.loadingCondition,
      )
    },
  }))
  .actions(self => ({
    reload() {},
    forceLoad() {},
    renderNow() {},
    startRenderingBackend(_backend: StubBackend) {},
    stopRenderingBackend() {},
    setRenderError(error: unknown) {
      self.renderError = error
    },
    setError(error: unknown) {
      self.error = error
    },
    setRegionTooLarge(value: boolean, reason = '') {
      self.regionTooLarge = value
      self.regionTooLargeReason = reason
    },
    setCanvasDrawn(value: boolean) {
      self.canvasDrawn = value
    },
    setRendersCanvas(value: boolean) {
      self.rendersCanvas = value
    },
    setLoadingCondition(value: boolean) {
      self.loadingCondition = value
    },
    setStatus(message?: string, progress?: number) {
      self.statusMessage = message
      self.statusProgress = progress
    },
  }))
