/**
 * The MAF display's coverage band: the depths it scales, its axis, its state
 * as the shared coverage marks take it, and its hovers. The scale itself is
 * alignments-core's (`coverageStatsViews`, `coverageAutoscaleViews`,
 * `coverageDomainViews`, `coverageTicksViews`), as on the alignments display.
 */
import {
  buildCoverageTooltipBin,
  hitCoverageBand,
} from '@jbrowse/alignments-core'
import { getPaletteHost } from '@jbrowse/core/util'

import { mafCoverageBandColors } from '../LinearMafRenderer/coverageBandColors.ts'
import { coverageTooltipBinAt } from './coverageTooltipBin.ts'

import type { MafRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafTopBands } from './mafTopBands.ts'
import type {
  CoverageBandState,
  CoverageSource,
  coverageDomainViews,
} from '@jbrowse/alignments-core'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { ScaleType, ValueScale, YScaleTicks } from '@jbrowse/wiggle-core'

/** What {@link mafCoverageSource} reads: the band's switch and the detail tier. */
export interface MafCoverageSourceHost {
  coverageBandActive: boolean
  detailOnScreen: ReadonlyMap<number, MafRegionData>
}

/**
 * The coverage `coverageStatsViews` scales: the worker-shipped
 * `coverage.coverageDepths` of each region the detail tier draws.
 */
export function mafCoverageSource(self: MafCoverageSourceHost): CoverageSource {
  return {
    active: () => self.coverageBandActive,
    regionsAt: index => {
      const coverage = self.detailOnScreen.get(index)?.coverage
      return coverage ? [coverage] : []
    },
  }
}

/** What {@link mafCoverageViews} reads: the band stack and the scale. */
export interface MafCoverageHost extends IStateTreeNode {
  topBands: MafTopBands
  coverageDepthDomain: [number, number] | undefined
  coverageTicks: YScaleTicks | undefined
  coverageScaleState: ReturnType<
    typeof coverageDomainViews
  >['coverageScaleState']
  scaleType: ScaleType
  symlogConstant: number
  axisGuide: Pick<ValueScale, 'caption' | 'rules' | 'grid' | 'showAxis'>
}

/** The coverage band's axis and its state as the shared marks take it. */
export function mafCoverageViews(self: MafCoverageHost) {
  return {
    /**
     * #getter
     * Overrides `ScoreScaleMixin`'s: `coverage.encoding.y.rules` are depths, so they
     * draw on the coverage band while it reserves px, never on the fixed
     * conservation scale.
     */
    get scoreRulesDrawn(): boolean {
      return self.topBands.reserved.coverage > 0
    },
    /**
     * #getter
     * The coverage band's palette slots, packed. Separate from
     * `renderState` so the nine-color CSS parse memoizes against the
     * palette.
     */
    get coverageBandColors() {
      return mafCoverageBandColors(getPaletteHost(self).palette)
    },
    /**
     * #getter
     * The coverage band as the shared marks and their hit test take it.
     * Height 0 draws no band: the setting is off or the summary tier owns
     * the view.
     */
    get coverageBandState(): CoverageBandState {
      return {
        ...self.topBands.rects.coverage,
        ...self.coverageScaleState,
        colors: this.coverageBandColors,
      }
    },
  }
}

/** What {@link mafCoverageHoverViews} reads: the band's state and the detail tier. */
export interface MafCoverageHoverHost {
  coverageBandState: CoverageBandState
  detailOnScreen: ReadonlyMap<number, MafRegionData>
  renderBlocks: RenderBlock[]
}

/** What the pointer reads off the coverage band. */
export function mafCoverageHoverViews(self: MafCoverageHoverHost) {
  return {
    /**
     * #method
     * The interbase bar or indicator triangle under a canvas point in the
     * coverage band, through the shared band's own hit test, or undefined
     * for the depth area and everywhere else.
     */
    coverageBandHit(displayedRegionIndex: number, x: number, y: number) {
      const coverage = self.detailOnScreen.get(displayedRegionIndex)?.coverage
      const block = self.renderBlocks.find(
        b => b.displayedRegionIndex === displayedRegionIndex,
      )
      return coverage && block
        ? hitCoverageBand(coverage, self.coverageBandState, block, x, y)
        : undefined
    },
    /**
     * #method
     * The depth and SNP tooltip bin at the base under the cursor, with the
     * percent identity at that position. Undefined when the region has no
     * fetched data or depth is zero.
     */
    coverageTooltipBin(
      displayedRegionIndex: number,
      basePos: number,
      bpPerPx: number,
      reversed = false,
    ) {
      const coverage = self.detailOnScreen.get(displayedRegionIndex)?.coverage
      return coverage
        ? coverageTooltipBinAt(
            coverage,
            basePos,
            bpPerPx,
            reversed,
            self.coverageBandState,
          )
        : undefined
    },
    /**
     * #method
     * The insertions at a band boundary the hit test named, summarized the
     * way the alignments band summarizes its interbase events.
     */
    interbaseTooltipBin(displayedRegionIndex: number, position: number) {
      const coverage = self.detailOnScreen.get(displayedRegionIndex)?.coverage
      const bin = coverage
        ? buildCoverageTooltipBin(
            position,
            coverage,
            coverage,
            {
              interbasePositions: coverage.insertionPositions,
              interbaseLengths: coverage.insertionLengths,
            },
            position,
          )
        : undefined
      return bin?.interbase.insertion
        ? { interbase: bin.interbase, interbaseDepth: bin.interbaseDepth }
        : undefined
    },
  }
}
