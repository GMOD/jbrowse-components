import {
  MORPH_DURATION_MS,
  animationAllowed,
  easeInOutCubic,
  getSession,
  morphClockMs,
} from '@jbrowse/core/util'
import {
  autorunOnReadyView,
  installAnimationDeadline,
} from '@jbrowse/display-kit/displayAutoruns'
import { untracked } from 'mobx'

import { maxBottom } from './layoutQueries.ts'
import {
  canMorph,
  captureFeatureTops,
  interpolateYData,
  rowGeometrySignature,
} from './yMorph.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FitStage } from './fitLadder.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface YMorphState {
  morphFromTops: Map<string, number> | undefined
  morphProgress: number
  morphStartMs: number
  morphFromMaxY: number
}

export interface YMorphHost extends YMorphState {
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>
}

export interface YMorphAutorunHost extends YMorphState, IStateTreeNode {
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>
  morphEased: number
  fitStage: FitStage
  fitScale: number
  fitDecimatedFactor: number | undefined
  displayMode: DisplayMode
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  beginYMorph: (fromTops: Map<string, number>, fromMaxY: number) => void
  endAnimation: () => void
}

export function yMorphVolatiles() {
  return {
    /**
     * #volatile
     */
    morphFromTops: undefined as Map<string, number> | undefined,
    /**
     * #volatile
     */
    morphProgress: 1,
    morphStartMs: 0,
    morphFromMaxY: 0,
  }
}

export function yMorphViews(self: YMorphHost) {
  return {
    /**
     * #getter
     */
    // The one place `easeInOutCubic` is applied, so the interpolated map, the
    // overlay offset and the mid-flight re-seed all describe the frame the
    // canvas drew.
    get morphEased() {
      return easeInOutCubic(self.morphProgress)
    },
    /**
     * #getter
     * a row morph is in flight, which the chrome publishes for the capture
     * waits
     */
    get animating() {
      return self.morphFromTops !== undefined
    },
    /**
     * #getter
     */
    // Returns `laidOutDataMap` by reference when idle, so consumers do not
    // re-upload unless an animation is in flight.
    get renderDataMap(): ReadonlyMap<number, FeatureDataResult> {
      const from = self.morphFromTops
      const t = this.morphEased
      // t === 1 is a morph driven to its end but not yet settled, so it
      // returns the destination by reference rather than an identical rebuilt
      // map.
      if (from === undefined || t === 1) {
        return self.laidOutDataMap
      }
      return interpolateYData(from, self.laidOutDataMap, t)
    },
  }
}

function settleYMorph(self: YMorphState) {
  self.morphFromTops = undefined
  self.morphProgress = 1
  // Cleared, not left behind: the morph autorun folds it into the next hold
  // with a plain `Math.max`, which is only right if a settled display holds no
  // height.
  self.morphFromMaxY = 0
}

export function yMorphActions(self: YMorphState) {
  return {
    /**
     * #action
     */
    beginYMorph(fromTops: Map<string, number>, fromMaxY: number) {
      self.morphFromTops = fromTops
      self.morphFromMaxY = fromMaxY
      self.morphStartMs = morphClockMs()
      self.morphProgress = 0
    },
    /**
     * #action
     */
    setMorphProgress(t: number) {
      self.morphProgress = Math.min(1, Math.max(0, t))
    },
    /**
     * #action
     * the chrome's frame clock
     */
    advanceAnimation(nowMs: number) {
      const t = (nowMs - self.morphStartMs) / MORPH_DURATION_MS
      if (t < 1) {
        self.morphProgress = Math.max(0, t)
      } else {
        settleYMorph(self)
      }
    },
    /**
     * #action
     */
    endAnimation() {
      settleYMorph(self)
    },
  }
}

// Seeded lazily on the first initialized run, not at install: `showLabels`
// transitively reads view.width, which throws before the view is measured,
// and a throw in afterAttach makes the session loader drop the display as
// unhydratable.
export function installYMorphAutorun(self: YMorphAutorunHost) {
  let prevLayout: ReadonlyMap<number, FeatureDataResult> | undefined
  let prevGeometry: string | undefined
  autorunOnReadyView(
    self,
    () => {
      const current = self.laidOutDataMap
      const { level, maxIsoforms } = self.fitStage
      const geometry = rowGeometrySignature({
        displayMode: self.displayMode,
        renderedShowLabels: self.renderedShowLabels,
        renderedShowDescriptions: self.renderedShowDescriptions,
        fitScale: self.fitScale,
        fitLevel: level,
        // Only where it selects rows: at any other rung reading it would pay
        // for a bisection to discriminate stacks it had no hand in.
        labelRoomFactor:
          level === 'decimated' ? self.fitDecimatedFactor : undefined,
        maxIsoforms,
      })
      const scaleUnchanged = geometry === prevGeometry
      const from = prevLayout
      prevLayout = current
      prevGeometry = geometry
      if (
        from === undefined ||
        from === current ||
        from.size === 0 ||
        current.size === 0
      ) {
        return
      }
      // morphFromTops/morphProgress/morphFromMaxY advance every rAF frame —
      // read untracked so the morph clock can't re-trigger this layout autorun.
      // eslint-disable-next-line no-restricted-syntax -- self-write: the morph clock is this layout's own effect
      const { fromTops, fromMaxY } = untracked(() => {
        // A morph still in flight means a non-debounced second layout change
        // interrupted it; re-seed from the live displayed positions and hold
        // the taller of the two heights.
        return {
          fromTops: captureFeatureTops(
            from,
            self.morphFromTops,
            self.morphEased,
          ),
          fromMaxY: Math.max(maxBottom(from), self.morphFromMaxY),
        }
      })
      // No scroll clamp here: `TrackHeightClampScroll` already pulls the
      // offset back, bounded by the on-screen `scrollableHeight`, where a
      // clamp written here could only see the buffered pack.
      if (
        scaleUnchanged &&
        animationAllowed(getSession(self).animationMode) &&
        canMorph(fromTops, current)
      ) {
        self.beginYMorph(fromTops, fromMaxY)
      } else {
        self.endAnimation()
      }
    },
    { name: 'CanvasYMorph' },
  )
  installAnimationDeadline(
    self,
    () =>
      self.morphFromTops === undefined
        ? undefined
        : self.morphStartMs + MORPH_DURATION_MS,
    () => {
      self.endAnimation()
    },
    'CanvasYMorphDeadline',
  )
}
