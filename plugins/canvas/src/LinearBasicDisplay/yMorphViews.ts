import { getSession } from '@jbrowse/core/util'
import { autorunOnReadyView } from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import { untracked } from 'mobx'

import { maxBottom } from './layout.ts'
import {
  canMorph,
  captureFeatureTops,
  easeInOutCubic,
  interpolateYData,
  morphAllowed,
  morphClockMs,
  morphOffset,
  rowGeometrySignature,
} from './yMorph.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FitStage } from './fitLadder.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/** The morph clock's own state, read by every member below. */
export interface YMorphState {
  morphFromTops: Map<string, number> | undefined
  morphProgress: number
  morphStartMs: number
  morphFromMaxY: number
}

/** What the morph views read: its own clock plus the settled destination. */
export interface YMorphHost extends YMorphState {
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>
}

/** What `morphOffsetFor` additionally needs: the two id → item indexes. */
export interface MorphOffsetHost extends YMorphState {
  morphEased: number
  featureIdIndex: ReadonlyMap<string, { topPx: number }>
  subfeatureIdIndex: ReadonlyMap<string, { parentFeatureId: string }>
}

/** What the morph autorun drives and reads. */
export interface YMorphAutorunHost extends YMorphState, IStateTreeNode {
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>
  morphEased: number
  fitStage: FitStage
  fitScale: number
  fitDecimatedFactor: number | undefined
  displayMode: DisplayMode
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  scrollTop: number
  height: number
  setScrollTop: (n: number) => void
  beginYMorph: (fromTops: Map<string, number>, fromMaxY: number) => void
  endYMorph: () => void
}

/**
 * Feature-Y transition state. While `morphFromTops` is set, `renderDataMap`
 * eases each feature from its previous row (id -> topPx here) toward its
 * `laidOutDataMap` row by `morphProgress` (0->1, driven by a rAF clock).
 * Render-only — hit-test and layout always read the destination
 * `laidOutDataMap`.
 */
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
    // Height of the layout being animated away from; `maxY` holds at the
    // taller of this and the destination during a morph (anti-clip).
    morphFromMaxY: 0,
  }
}

export function yMorphViews(self: YMorphHost) {
  return {
    /**
     * #getter
     */
    // The morph's progress with the easing curve applied. The ONE place
    // `easeInOutCubic` is called on it: the interpolated map below, the
    // overlay offset and the mid-flight re-seed in CanvasYMorph all read
    // this, so none of them can end up describing a different frame than
    // the one the canvas drew.
    get morphEased() {
      return easeInOutCubic(self.morphProgress)
    },
    /**
     * #getter
     */
    // What the canvas + DOM overlays actually draw. Identical to
    // `laidOutDataMap` except during a row re-pack, when feature Y eases
    // from the previous layout to the new one (see yMorph). Returns the
    // same object reference as `laidOutDataMap` when idle, so consumers
    // don't re-upload/re-render unless an animation is in flight.
    get renderDataMap(): ReadonlyMap<number, FeatureDataResult> {
      const from = self.morphFromTops
      const t = this.morphEased
      // t === 1 is the settled frame between the clock's final
      // setMorphProgress(1) and endYMorph clearing morphFromTops: every
      // feature already sits at its destination, so return laidOutDataMap by
      // reference (same as idle) instead of rebuilding an identical map. The
      // stable reference also lets the MobX computed skip a redundant
      // re-render when endYMorph then clears the morph.
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
    // Start the feature-Y transition from `fromTops` (each feature's row in
    // the layout being left) toward the current `laidOutDataMap`. The rAF
    // clock that advances `morphProgress` lives in FeatureComponent (it
    // observes `morphFromTops`) and recomputes t from `morphStartMs` each
    // frame, so resetting these mid-flight cleanly retargets the animation.
    // A zoom morph (300ms) finishes before the next zoom (coarseBpPerPx is
    // debounced 500ms), but non-debounced changes (pin toggle, region flip)
    // can land mid-morph; the CanvasYMorph autorun re-seeds `fromTops` from
    // the live displayed positions in that case so the retarget doesn't snap.
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
      // Cleared, not left behind: `maxY` reads it only while a morph is in
      // flight, but CanvasYMorph folds it into the next morph's hold with a
      // plain `Math.max`, which is only correct if a settled display reports
      // no held height.
      self.morphFromMaxY = 0
    },
  }
}

export function morphOffsetViews(self: MorphOffsetHost) {
  return {
    /**
     * #method
     */
    // How far this feature's glyph is currently drawn from the row it is
    // laid out on, or 0 when no morph is easing it. The DOM overlay boxes
    // add it to their tops: they take geometry from `featureItemMap`, which
    // is built off the settled `laidOutDataMap` so hit targets are the
    // destination, and without this a selection or hover box sits on the
    // destination row for the morph's 300ms while the glyph inside it is
    // still travelling. A subfeature rides its parent's row, so its box
    // takes the parent's offset.
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

/**
 * Drive the feature-Y transition. When `laidOutDataMap` re-packs at the same
 * vertical scale (a zoom step — not a label/mode change, which alters row
 * heights), animate from the previous rows to the new ones; otherwise snap.
 * Compares to the prior map kept in closure so the trigger is the layout change
 * itself.
 *
 * Seeded lazily on the autorun's first initialized run, NOT at install:
 * showLabels/effectiveShowDescriptions transitively read view.width (via the
 * density gate), which throws before the view is measured. Reading them
 * synchronously in afterAttach would throw during session restore —
 * propagating out of display instantiation and making the session loader drop
 * the display as "unhydratable". These prevs are only compared once prevLayout
 * is non-undefined, which can't happen until after the first guarded run has
 * set them.
 */
export function installYMorphAutorun(self: YMorphAutorunHost) {
  let prevLayout: ReadonlyMap<number, FeatureDataResult> | undefined
  let prevGeometry: string | undefined
  autorunOnReadyView(
    self,
    () => {
      const current = self.laidOutDataMap
      // Same row heights/scale as the previous layout means the change
      // is a same-scale zoom re-pack (row *assignment* only) and can
      // morph; a changed signature rescaled every row (mode/label/fit-
      // level change, or a fit squeeze) and must snap. See
      // rowGeometrySignature for why it reads the rendered, not raw,
      // label/description flags.
      const { level } = self.fitStage
      const geometry = rowGeometrySignature({
        displayMode: self.displayMode,
        renderedShowLabels: self.renderedShowLabels,
        renderedShowDescriptions: self.renderedShowDescriptions,
        fitScale: self.fitScale,
        fitLevel: level,
        // Only where it selects rows: at any other rung the solve is
        // never run, and reading it would pay for a bisection to
        // discriminate stacks it had no hand in.
        labelRoomFactor:
          level === 'decimated' ? self.fitDecimatedFactor : undefined,
      })
      const scaleUnchanged = geometry === prevGeometry
      const from = prevLayout
      prevLayout = current
      prevGeometry = geometry
      // Not a real layout-to-layout transition (first data, an
      // empty map on nav) — nothing to morph or snap.
      if (
        from === undefined ||
        from === current ||
        from.size === 0 ||
        current.size === 0
      ) {
        return
      }
      // scrollTop/height are viewport state, not layout inputs, and
      // morphFromTops/morphProgress/morphFromMaxY advance every rAF
      // frame — read all untracked so neither writing scrollTop back
      // below nor the morph clock can re-trigger this layout autorun.
      // eslint-disable-next-line no-restricted-syntax -- self-write: scrollTop is written back below, and the morph clock is this layout's own effect
      const { scrollTop, height, fromTops, fromMaxY } = untracked(() => {
        // A morph still in flight means a second, non-debounced
        // layout change (a pin toggle or region flip — unlike zoom)
        // is interrupting it. Re-seed the next morph from each
        // feature's live displayed position instead of `from`'s
        // settled rows so mid-flight features don't snap, and hold
        // the content height across the taller of the two morphs so
        // a feature easing up from a deep row isn't clipped. With
        // nothing in flight both fall through to `from` alone: no
        // morphFromTops eases the capture, and endYMorph zeroed the
        // held height.
        return {
          scrollTop: self.scrollTop,
          height: self.height,
          fromTops: captureFeatureTops(
            from,
            self.morphFromTops,
            self.morphEased,
          ),
          fromMaxY: Math.max(maxBottom(from), self.morphFromMaxY),
        }
      })
      // Whenever the new layout is shorter than the current scroll
      // position, clamp back into range so the viewport can't strand
      // past the content bottom. This happens on same-scale repacks
      // (zoom-in de-stacking rows) AND on mode/label changes (compact
      // mode shrinks every row) — so it must run before the branch
      // below, not only in the same-scale path. Clamp to the incoming
      // layout's own bottom, NOT self.scrollableHeight/maxY: mid-morph
      // those are held at the taller of old/new (morphFromMaxY,
      // anti-clip), so reusing them here would skip clamping to the
      // shorter incoming content until the morph settles.
      const maxScroll = Math.max(0, maxBottom(current) - height)
      if (scrollTop > maxScroll) {
        self.setScrollTop(maxScroll)
      }
      // Only a same-scale repack (a zoom step) has comparable rows to
      // pin against; a mode/label change rescales every row, so let it
      // snap without a row morph.
      if (
        scaleUnchanged &&
        morphAllowed(getSession(self).animationMode) &&
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
