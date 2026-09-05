import { HEIGHT_MULTIPLIERS } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import {
  MIN_FIT_BOX_PX,
  resolveFitLadder,
  solveIsoformCount,
  solveLabelRoomFactor,
  squeezeFloorScale,
} from './fitLadder.ts'
import { maxIsoformCount } from './isoformTrim.ts'
import {
  createContentHeightProbe,
  createIncrementalLayout,
  createIsoformCountProbe,
} from './layout.ts'
import { minDrawnBoxHeight } from './layoutQueries.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FitRung, FitStage, LabelReservation } from './fitLadder.ts'
import type { IncrementalLayout } from './layout.ts'
import type {
  IsoformCountFreeInputs,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
  LayoutRegionData,
} from './layoutInputs.ts'

export const EMPTY_LAID_OUT_DATA = new Map<number, FeatureDataResult>()

const BODIES_RESERVATION: LabelReservation = {
  showLabels: false,
  showDescriptions: false,
  dropBelowLabelRows: false,
}

const BARE_RESERVATION: LabelReservation = {
  showLabels: false,
  showDescriptions: false,
  dropBelowLabelRows: true,
}

export interface FitLadderHost {
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>
  layoutReady: boolean
  // `expandedGeneIds` is Required, not merely picked: every rung spreads
  // these inputs, and a host that could omit it re-collapses the gene the
  // user opened at the `full` rung.
  layoutInputs: Pick<
    LayoutInputs,
    'bpPerPx' | 'reversedRegions' | 'displayMode' | 'pinnedFeatureIds'
  > &
    Required<Pick<LayoutInputs, 'expandedGeneIds'>>
  showLabels: boolean
  effectiveShowDescriptions: boolean
  displayMode: DisplayMode
  fitMeasureFeatureIds: ReadonlySet<string> | undefined
  fitHeightToDisplay: boolean
  autoHeight: boolean
  showsEveryIsoform: boolean
  reservesBelowLabelRows: boolean
  fitTargetHeight: number
  incrementalLayout: IncrementalLayout
  incrementalLayoutLabelsOnly: IncrementalLayout
  incrementalLayoutBodiesOnly: IncrementalLayout
  incrementalLayoutDecimated: IncrementalLayout
  incrementalLayoutIsoforms: IncrementalLayout
  incrementalLayoutBare: IncrementalLayout
}

// One instance per reservation config: a shared instance can only cache one
// config at a time.
export function fitLadderVolatiles() {
  return {
    /**
     * #volatile
     */
    // Mutating the memo's internal cache is invisible to MobX, so reading it
    // inside a computed is safe.
    incrementalLayout: createIncrementalLayout(),
    /**
     * #volatile
     */
    incrementalLayoutLabelsOnly: createIncrementalLayout(),
    /**
     * #volatile
     */
    incrementalLayoutBodiesOnly: createIncrementalLayout(),
    /**
     * #volatile
     */
    // Unseeded because the rung's factor is chosen by measuring unseeded
    // candidate packs, and the commit has to match what was measured.
    incrementalLayoutDecimated: createIncrementalLayout({
      seedPriorRows: false,
    }),
    /**
     * #volatile
     */
    // Unseeded for the same reason as `incrementalLayoutDecimated`: the count
    // is chosen by measuring.
    incrementalLayoutIsoforms: createIncrementalLayout({
      seedPriorRows: false,
    }),
    /**
     * #volatile
     */
    incrementalLayoutBare: createIncrementalLayout(),
  }
}

export function fitLadderViews(self: FitLadderHost) {
  return {
    /**
     * #method
     * One fit-escalation candidate: the stack packed with the given label
     * reservation, via that config's own memo instance so each keeps stable
     * references across renders.
     */
    fitLayoutAt(
      memo: IncrementalLayout,
      reserved: LabelReservation,
    ): Map<number, FeatureDataResult> {
      return self.layoutReady
        ? memo(self.rpcDataMap, { ...self.layoutInputs, ...reserved })
        : EMPTY_LAID_OUT_DATA
    },
    /**
     * #getter
     * What the `full` rung reserves: the names and descriptions the settings
     * ask for.
     */
    get fullReservation(): LabelReservation {
      return {
        showLabels: self.showLabels,
        showDescriptions: self.effectiveShowDescriptions,
        dropBelowLabelRows: false,
      }
    },
    /**
     * #getter
     * The `labels` and `decimated` rungs' reservation: names kept,
     * descriptions dropped.
     */
    get labelsReservation(): LabelReservation {
      return {
        showLabels: self.showLabels,
        showDescriptions: false,
        dropBelowLabelRows: false,
      }
    },
    /**
     * #getter
     * The `isoforms` rung's reservation.
     */
    get isoformsReservation(): LabelReservation {
      return {
        showLabels: self.showLabels,
        showDescriptions: self.fitHeightToDisplay
          ? false
          : self.effectiveShowDescriptions,
        dropBelowLabelRows: false,
      }
    },
    /**
     * #getter
     * The `decimated` rung's layout inputs minus the whitespace factor.
     */
    get decimatedBaseInputs(): LabelRoomFactorFreeInputs {
      return {
        ...self.layoutInputs,
        ...this.labelsReservation,
        labelDecimation: 'fitWidth',
        // The rungs below `isoforms` inherit the count that rung failed at:
        // every isoform goes before any name does.
        maxIsoformsPerGene: this.fitIsoformCount,
      }
    },
    /**
     * #method
     * Layout inputs for the `decimated` rung at one whitespace factor.
     */
    decimatedLayoutInputs(labelRoomFactor: number): LayoutInputs {
      return { ...this.decimatedBaseInputs, labelRoomFactor }
    },
    /**
     * #getter
     * Measures the `decimated` rung's stack height at any whitespace factor,
     * against the features the ladder measures its rungs with — so the factor
     * the solve picks is judged on the same stack the rung is then kept or
     * rejected on.
     */
    get decimatedHeightProbe(): (labelRoomFactor: number) => number {
      return createContentHeightProbe(
        self.rpcDataMap,
        this.decimatedBaseInputs,
        self.fitMeasureFeatureIds,
      )
    },
    /**
     * #method
     * The whitespace factor the `decimated` rung commits at: the smallest one
     * whose packed stack fits `trackHeight` (smallest = most names kept), or
     * undefined when even the most aggressive decimation overflows.
     */
    solveLabelRoomFactor(trackHeight: number) {
      return solveLabelRoomFactor(this.decimatedHeightProbe, trackHeight)
    },
    /**
     * #getter
     * The `isoforms` rung's layout inputs minus the count itself, typed
     * without it so the solve's shared preparation provably cannot depend on
     * it.
     */
    get isoformsBaseInputs(): IsoformCountFreeInputs {
      return { ...self.layoutInputs, ...this.isoformsReservation }
    },
    /**
     * #getter
     * Measures the `isoforms` rung's stack height at any isoform count,
     * against the features the ladder measures its rungs with.
     */
    get isoformsHeightProbe(): (maxIsoforms: number) => number {
      return createIsoformCountProbe(
        self.rpcDataMap,
        this.isoformsBaseInputs,
        self.fitMeasureFeatureIds,
      )
    },
    /**
     * #getter
     * The most isoforms any trimmable gene ON SCREEN has — the top of the
     * solve's bracket, and the count above which a trim can take nothing
     * away.
     */
    get maxIsoformsOnScreen() {
      return maxIsoformCount(
        self.rpcDataMap.values(),
        self.fitMeasureFeatureIds,
        self.layoutInputs.expandedGeneIds,
      )
    },
    /**
     * #getter
     * The isoform count the `isoforms` rung commits at: the largest whose
     * names-kept stack fits `fitTargetHeight`, so the most transcripts are
     * kept without giving up a name.
     */
    get fitIsoformCount(): number | undefined {
      return self.layoutReady && !self.autoHeight && !self.showsEveryIsoform
        ? solveIsoformCount(
            this.isoformsHeightProbe,
            self.fitTargetHeight,
            this.maxIsoformsOnScreen,
            self.fitHeightToDisplay ? 1 : undefined,
          )
        : undefined
    },
    /**
     * #getter
     * The `isoforms` stack: every gene trimmed to `fitIsoformCount`
     * transcripts, names intact.
     */
    get fitIsoformsSolved(): Map<number, FeatureDataResult> {
      const maxIsoformsPerGene = this.fitIsoformCount
      if (maxIsoformsPerGene === undefined) {
        return self.fitHeightToDisplay
          ? this.fitLabelsOnlyLayout
          : this.baseLaidOutDataMap
      }
      return self.incrementalLayoutIsoforms(self.rpcDataMap, {
        ...this.isoformsBaseInputs,
        maxIsoformsPerGene,
      })
    },
    /**
     * #getter
     * Full reservation (names + descriptions): rendered at fit stage `full`
     * and in non-fit modes, and the first stack `fitStage` probes.
     */
    get baseLaidOutDataMap(): Map<number, FeatureDataResult> {
      return this.fitLayoutAt(self.incrementalLayout, this.fullReservation)
    },
    /**
     * #getter
     * Names reserved, descriptions dropped — the `labels` stage's stack.
     */
    get fitLabelsOnlyLayout(): Map<number, FeatureDataResult> {
      return self.effectiveShowDescriptions
        ? this.fitLayoutAt(
            self.incrementalLayoutLabelsOnly,
            this.labelsReservation,
          )
        : this.baseLaidOutDataMap
    },
    /**
     * #getter
     * The whitespace factor the `decimated` rung commits at: the smallest one
     * whose packed stack fits `fitTargetHeight`, so the most names are kept.
     */
    get fitDecimatedFactor(): number | undefined {
      // Memoized so `rowGeometrySignature` reads the same answer the rung
      // packed at without a second bisection.
      return self.layoutReady && self.showLabels
        ? this.solveLabelRoomFactor(self.fitTargetHeight)
        : undefined
    },
    /**
     * #getter
     * The `decimated` stack: names kept only on features with at least
     * `fitDecimatedFactor ×` their label width in neighbour whitespace (plus
     * pinned/highlighted, always).
     */
    get fitDecimatedSolved(): Map<number, FeatureDataResult> {
      // Probe and commit must pack identically, hence the unseeded
      // `incrementalLayoutDecimated`; seeding this rung from the `labels`
      // stack was tried and moved zero rows.
      const factor = this.fitDecimatedFactor
      // Falls back to the `isoforms` stack, not `labels`: this rung is below
      // that one, and falling past its trim packs a stack the ladder already
      // rejected.
      return factor === undefined
        ? this.fitIsoformsSolved
        : self.incrementalLayoutDecimated(
            self.rpcDataMap,
            this.decimatedLayoutInputs(factor),
          )
    },
    get fitBodiesOnlyLayout(): Map<number, FeatureDataResult> {
      const maxIsoformsPerGene = this.fitIsoformCount
      // Shared by reference only while there is no trim to apply, or the
      // reuse drops it.
      return self.showLabels || maxIsoformsPerGene !== undefined
        ? self.incrementalLayoutBodiesOnly(self.rpcDataMap, {
            ...self.layoutInputs,
            ...BODIES_RESERVATION,
            maxIsoformsPerGene,
          })
        : this.fitLabelsOnlyLayout
    },
    /**
     * #getter
     * The `bare` stack: `bodies` with the `below` subfeature-label rows spent
     * at zero height, so the last reduction before a squeeze gives back rows
     * whose text the squeeze was about to hide anyway.
     */
    get fitBareLayout(): Map<number, FeatureDataResult> {
      return self.incrementalLayoutBare(self.rpcDataMap, {
        ...self.layoutInputs,
        ...BARE_RESERVATION,
        maxIsoformsPerGene: this.fitIsoformCount,
      })
    },
    /**
     * #getter
     * The shortest box the layout draws on screen, read off the layout rather
     * than the `featureHeight` slot, a per-feature jexl callback that throws
     * with no feature in scope.
     */
    get fitSmallestBoxPx() {
      return minDrawnBoxHeight(
        this.baseLaidOutDataMap,
        self.fitMeasureFeatureIds,
      )
    },
    /**
     * #getter
     * Floor on the fit squeeze: the smallest vertical scale that still leaves
     * every drawn box at least `MIN_FIT_BOX_PX` tall.
     */
    get fitMinScale() {
      return squeezeFloorScale(this.fitSmallestBoxPx, MIN_FIT_BOX_PX)
    },
    /**
     * #getter
     * Ceiling on the fit grow: the largest vertical scale before a feature
     * body exceeds the height it would have outside fit mode.
     */
    get fitMaxScale() {
      return Math.max(1, 1 / HEIGHT_MULTIPLIERS[self.displayMode])
    },
    /**
     * #getter
     * The resolved fit outcome — which reservation `level` survived, its
     * unscaled `layout`, and the vertical `scale` to fill the track — bundled
     * so the three can never disagree.
     */
    get fitStage(): FitStage {
      const base = this.baseLaidOutDataMap
      const fit = self.fitHeightToDisplay
      // Non-fit mode routes through `resolveFitLadder` too, with minScale =
      // maxScale = 1, so FitStage is assembled in one place.
      const trimmed = () => this.fitIsoformCount
      const full: FitRung = {
        level: 'full',
        reserved: this.fullReservation,
        layout: () => base,
      }
      // "All transcripts" leaves no isoform rung rather than one that trims
      // nothing: as the last rung of the fixed ladder it would report `level:
      // 'isoforms'` over a stack every transcript survived.
      const isoformRung: FitRung[] = self.showsEveryIsoform
        ? []
        : [
            {
              level: 'isoforms',
              reserved: this.isoformsReservation,
              layout: () => this.fitIsoformsSolved,
              maxIsoforms: trimmed,
            },
          ]
      // Only where the settings reserve `below` rows, or the rung packs a
      // byte-identical copy of `bodies` and reports a reduction that reduced
      // nothing.
      const bareRung: FitRung[] = self.reservesBelowLabelRows
        ? [
            {
              level: 'bare',
              reserved: BARE_RESERVATION,
              layout: () => this.fitBareLayout,
              maxIsoforms: trimmed,
            },
          ]
        : []
      return resolveFitLadder(
        fit
          ? [
              full,
              {
                level: 'labels',
                reserved: this.labelsReservation,
                layout: () => this.fitLabelsOnlyLayout,
              },
              ...isoformRung,
              {
                level: 'decimated',
                reserved: this.labelsReservation,
                layout: () => this.fitDecimatedSolved,
                maxIsoforms: trimmed,
              },
              {
                level: 'bodies',
                reserved: BODIES_RESERVATION,
                layout: () => this.fitBodiesOnlyLayout,
                maxIsoforms: trimmed,
              },
              ...bareRung,
            ]
          : self.autoHeight
            ? [full]
            : [full, ...isoformRung],
        self.fitTargetHeight,
        fit ? this.fitMinScale : 1,
        fit ? this.fitMaxScale : 1,
        self.fitMeasureFeatureIds,
      )
    },
  }
}
