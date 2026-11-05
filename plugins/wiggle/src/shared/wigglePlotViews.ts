import {
  axisPlotBox,
  computeScoreStats,
  visibleStats,
} from '@jbrowse/wiggle-core'

import { declaredValueDomain } from '../LinearWiggleDisplay/sourcesLogic.ts'
import { getRowHeight } from './wiggleComponentUtils.ts'
import { wiggleAutoscaleRange } from './wiggleResolveViews.ts'

import type { WigglePlotGeometry } from './wiggleDisplayViews.ts'
import type { Extent } from './wiggleMarkConfigSchema.ts'
import type {
  SettledBlocksView,
  SummaryField,
  WiggleDataResult,
} from '@jbrowse/wiggle-core'

/** What {@link wiggleDomainViews} reads: the axis and the fetched data. */
export interface WiggleDomainHost {
  autoscaledDomain: [number, number] | undefined
  rpcDataMap: ReadonlyMap<number, WiggleDataResult>
}

/** The score domain a wiggle display draws, and the bounds its data declares. */
export function wiggleDomainViews(self: WiggleDomainHost) {
  return {
    /**
     * #getter
     */
    get domain() {
      return self.autoscaledDomain
    },
    /**
     * #getter
     * The bounds the adapter declares its values lie in, where it declares
     * any (`getValueDomain`): a GC content track's [0, 1], so its axis
     * reads alike at every locus. Config bounds still win.
     */
    get defaultScoreDomain(): [number | undefined, number | undefined] {
      return declaredValueDomain(self.rpcDataMap.values())
    },
  }
}

/** What {@link wiggleRowsBoxViews} reads: the box and the rows drawn in it. */
export interface WiggleRowsBoxHost {
  height: number
  rowsTopOffset: number
  isDensityMode: boolean
  scoreGradientPaints: boolean
  sources: readonly unknown[]
}

/**
 * The height a wiggle display's rows, or its one plot, fill, and how many
 * sources share it. The display installs them as a `.views()` layer; a static
 * export installs the same layer.
 */
export function wiggleRowsBoxViews(self: WiggleRowsBoxHost) {
  return {
    get numSources() {
      return self.sources.length
    },

    /**
     * #getter
     * The height under `rowsTopOffset` the rows, or the one plot, fill.
     */
    get rowsHeight() {
      return Math.max(0, self.height - self.rowsTopOffset)
    },

    /**
     * #getter
     * A density row has no y scale, so under the one ramp the ramp is the
     * key and shows the domain; bars and points keep their axis beside it.
     */
    get scoreRampReplacesAxis() {
      return self.isDensityMode && self.scoreGradientPaints
    },
  }
}

/** What {@link wiggleRowHeightViews} reads: the box and the layout. */
export interface WiggleRowHeightHost {
  isOverlay: boolean
  rowsHeight: number
  numSources: number
}

/** How a wiggle display divides its rows' height among them. */
export function wiggleRowHeightViews(self: WiggleRowHeightHost) {
  return {
    /**
     * #getter
     * Resolved per-row height. This display is always fit-to-display-height —
     * its rows declare no `step`, so there is no pinned height to
     * resolve — but it uses the same name every row display exposes its
     * resolved height under (see agent-docs/reference/ROW_HEIGHT_AND_FIT),
     * which is also what tree-sidebar's `TreeDrawingModel` reads.
     */
    get effectiveRowHeight() {
      return self.isOverlay
        ? self.rowsHeight
        : getRowHeight(self.rowsHeight, self.numSources)
    },

    /**
     * #getter
     * Rows actually drawn: overlay collapses every source onto one shared
     * plot. Read by the render state and by everything that repeats itself
     * per row (scalebars, cross hatches), so they can't disagree about how
     * many rows exist.
     */
    get numRows() {
      return self.isOverlay ? 1 : self.numSources
    },
  }
}

/** What {@link wigglePlotViews} reads: the rows and their height. */
export interface WigglePlotHost {
  rowsTopOffset: number
  rowsHeight: number
  numRows: number
  effectiveRowHeight: number
}

/** Where a wiggle display's rows, or its one plot, sit in its height. */
export function wigglePlotViews(self: WigglePlotHost) {
  return {
    /**
     * #getter
     * One row takes the scalebar-label gutter at top and bottom, so its end
     * labels are never clipped; a stack of rows gives that up, because the
     * axis is drawn per row and maximum density is the point. `ticks`, the
     * render height, the on-screen canvas and the SVG clip all read this, so
     * a tick stays on the data it labels.
     */
    get plotGeometry(): WigglePlotGeometry {
      const { rowsTopOffset, rowsHeight, numRows } = self
      if (numRows === 1) {
        const { yTop, plotHeight } = axisPlotBox(rowsHeight)
        return {
          yTop: rowsTopOffset + yTop,
          plotHeight,
          numRows: 1,
          tickHeight: rowsHeight,
        }
      }
      return {
        yTop: rowsTopOffset,
        plotHeight: rowsHeight,
        numRows,
        tickHeight: self.effectiveRowHeight,
      }
    },
  }
}

/** What {@link wiggleStatsViews} reads: the frame, the data and the field. */
export interface WiggleStatsHost {
  host: SettledBlocksView
  rpcDataMap: ReadonlyMap<number, WiggleDataResult>
  autoscaleSourceNames: Set<string>
  summaryField: SummaryField
  effectiveExtent: Extent
}

/** The stats the drawn sources reach in the settled blocks of the frame. */
export function wiggleStatsViews(self: WiggleStatsHost) {
  return {
    /**
     * #getter
     * The stats of the sources visible in the settled blocks, `undefined`
     * until the view and the data are ready.
     */
    get statsInView() {
      const names = self.autoscaleSourceNames
      return visibleStats({
        active: true,
        view: self.host,
        payloadFor: index => self.rpcDataMap.get(index),
        itemsFor: regionData =>
          regionData.sources.filter(source => names.has(source.name)),
        accumulate: entries =>
          computeScoreStats(self.summaryField, entries, self.effectiveExtent),
      })
    },
  }
}

/** What {@link wiggleAutoscaleViews} reads: the stats and the y scale. */
export interface WiggleAutoscaleHost {
  statsInView: ReturnType<typeof wiggleStatsViews>['statsInView']
  summaryField: SummaryField
  effectiveExtent: Extent
  fenceQuantile: number
  axisReachesZero: boolean
  scoreRuleValues: number[]
}

/**
 * What the drawn sources span in the settled blocks of the frame, which the
 * autoscaled domain is drawn from.
 */
export function wiggleAutoscaleViews(self: WiggleAutoscaleHost) {
  return {
    /**
     * #getter
     * What the sources visible in the settled blocks span, under the
     * autoscale mode (`wiggleAutoscaleRange`). `undefined` until the view
     * and the data are ready, which is not the `[0, 1]` a caller falls
     * back to — see `visibleStats`.
     */
    get autoscaleRange(): [number, number] | undefined {
      return wiggleAutoscaleRange(self.statsInView, {
        quantile: self.fenceQuantile,
        zero: self.axisReachesZero,
        field: self.summaryField,
        extent: self.effectiveExtent,
        ruleValues: self.scoreRuleValues,
      })
    },

    /**
     * #getter
     * The least and greatest value the visible sources draw, unfenced.
     */
    get valuesInView(): [number, number] | undefined {
      const walked = self.statsInView
      return walked ? [walked.stats.scoreMin, walked.stats.scoreMax] : undefined
    },
  }
}
