import { types } from '@jbrowse/mobx-state-tree'
import { computeDisplayPhase } from '@jbrowse/render-core/displayPhase'

import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

// Shared fixture for the two chrome suites: `DisplayChrome.test.tsx` drives the
// MUI overlay set, `plainChromeOverlays.test.tsx` drives the toolkit-free one.
// One model, so "the plain set honors the same contract" is a claim both suites
// test against identical state rather than two hand-built approximations that
// can quietly diverge.

export interface StubBackend {
  dispose(): void
}

export function stubFactory() {
  return Promise.resolve<StubBackend>({ dispose() {} })
}

// Minimal real MST model satisfying `ChromeModel & RenderLifecycleModel`.
// `displayPhase` is computed through the production `computeDisplayPhase` with a
// lazy loading thunk, so the model mirrors the real precedence/laziness contract
// rather than hard-coding a phase string.
export const TestChromeModel = types
  .model('TestChromeModel', {
    height: 100,
    regionTooLarge: false,
    regionTooLargeReason: '',
    canvasDrawn: false,
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
    setLoadingCondition(value: boolean) {
      self.loadingCondition = value
    },
    setStatus(message?: string, progress?: number) {
      self.statusMessage = message
      self.statusProgress = progress
    },
  }))
