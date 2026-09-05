import { animationAllowed, getSession } from '@jbrowse/core/util'
import { autorunOnReadyView } from '@jbrowse/display-kit/displayAutoruns'
import { untracked } from 'mobx'

import { maxBottom } from './layoutQueries.ts'
import {
  canMorph,
  captureFeatureTops,
  easeInOutCubic,
  interpolateYData,
  morphClockMs,
  morphOffset,
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

export interface MorphOffsetHost extends YMorphState {
  morphEased: number
  featureIdIndex: ReadonlyMap<string, { topPx: number }>
  subfeatureIdIndex: ReadonlyMap<string, { parentFeatureId: string }>
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
  endYMorph: () => void
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
     */
    // Returns `laidOutDataMap` by reference when idle, so consumers do not
    // re-upload unless an animation is in flight.
    get renderDataMap(): ReadonlyMap<number, FeatureDataResult> {
      const from = self.morphFromTops
      const t = this.morphEased
      // t === 1 is the settled frame between the clock's final
      // `setMorphProgress(1)` and `endYMorph`, so it returns the destination
      // by reference rather than an identical rebuilt map.
      if (from === undefined || t === 1) {
        return self.laidOutDataMap
      }
      return interpolateYData(from, self.laidOutDataMap, t)
    },
  }
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
     */
    endYMorph() {
      self.morphFromTops = undefined
      self.morphProgress = 1
      // Cleared, not left behind: the morph autorun folds it into the next
      // hold with a plain `Math.max`, which is only right if a settled
      // display holds no height.
      self.morphFromMaxY = 0
    },
  }
}

export function morphOffsetViews(self: MorphOffsetHost) {
  return {
    /**
     * #method
     */
    // Overlay boxes take geometry from the settled `laidOutDataMap`, so
    // without this a hover box sits on the destination row while the glyph is
    // still travelling; a subfeature rides its parent's row.
    morphOffsetFor(featureId: string) {
      const from = self.morphFromTops
      if (from === undefined) {
        return 0
      }
      const topLevelId = self.featureIdIndex.has(featureId)
        ? featureId
        : (self.subfeatureIdIndex.get(featureId)?.parentFeatureId ?? featureId)
      const item = self.featureIdIndex.get(topLevelId)
      return item === undefined
        ? 0
        : morphOffset(from, topLevelId, item.topPx, self.morphEased)
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
        self.endYMorph()
      }
    },
    { name: 'CanvasYMorph' },
  )
}
