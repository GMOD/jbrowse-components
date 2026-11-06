import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'
import { sameAsLast } from '@jbrowse/display-kit/stableIdentityComputed'
import { createEncodeMemo } from '@jbrowse/render-core/encodeMemo'
import { observable } from 'mobx'

import { scaleLaidOutData, unplaceBelow } from './applyLayout.ts'
import { indexById } from './baseModelHelpers.ts'
import {
  buildFeatureFlatbushIndex,
  buildSubfeatureFlatbushIndex,
} from './components/hitTesting.ts'
import { featureGroupSections } from './facet.ts'
import { buildRegionInstanceIndex } from './featureHighlightInk.ts'
import {
  MIN_FIT_BOX_PX,
  labeledBodyFloorScale,
  renderedLabelContext,
  resolveFitLadder,
  solveBodyScale,
  solveIsoformCount,
  solveLabelRoomFactors,
  squeezeFloorScale,
} from './fitLadder.ts'
import { maxIsoformCount } from './isoformTrim.ts'
import { namedLabelTiers } from './labelReservation.ts'
import {
  createContentHeightProbe,
  createIncrementalLayout,
  createIsoformCountProbe,
  createPackHeightCache,
  createPackHeightProbe,
} from './layout.ts'
import {
  keepsAnyName,
  maxDrawnBoxHeight,
  minDrawnBoxHeight,
} from './layoutQueries.ts'
import { isPlacedRow } from './rowPlacement.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FlatbushRegionIndexes } from './components/hitTesting.ts'
import type { LabelPlacementContext } from './components/labelPositioning.ts'
import type { FeatureFacet, FeatureGroupSection } from './facet.ts'
import type { RegionInstanceIndex } from './featureHighlightInk.ts'
import type { FitRung, FitStage, LabelReservation } from './fitLadder.ts'
import type { IncrementalLayout, PackHeightCache } from './layout.ts'
import type {
  IsoformCountFreeInputs,
  LabelRoomFactorFreeInputs,
  LabelRoomFactors,
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

// Structural, so a host that is not a LinearBasicDisplay (the variant
// display's records band, the R export) carries the band without importing a
// model type.
export interface FeatureBandHost {
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>
  layoutReady: boolean
  // `expandedGeneIds` is Required, not merely picked: every rung spreads
  // these inputs, and a host that could omit it re-collapses the gene the
  // user opened at the `full` rung.
  layoutInputs: Pick<
    LayoutInputs,
    | 'bpPerPx'
    | 'displayMode'
    | 'pinnedFeatureIds'
    | 'facet'
    | 'hiddenGroupKeys'
    | 'geneNamesOnly'
  > &
    Required<Pick<LayoutInputs, 'expandedGeneIds'>>
  showLabels: boolean
  effectiveShowDescriptions: boolean
  facet: FeatureFacet | undefined
  fitMeasureFeatureIds: ReadonlySet<string> | undefined
  fitHeightToDisplay: boolean
  autoHeight: boolean
  showsEveryIsoform: boolean
  reservesBelowLabelRows: boolean
  fitTargetHeight: number
  labelFontSize: number
  // Past the ladder's last rung, leave unplaced what overflows
  // `fitTargetHeight` rather than squeeze the stack into it.
  hidesOverflow: boolean
}

interface HitIndexSource {
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>
  renderedLabels: LabelPlacementContext
}

// `bpPerPx` is the layout's, the throttled `coarseBpPerPx` the rows were
// packed at. Per region, since the incremental layout keeps an unchanged
// region's object and a Flatbush rebuild costs a Hilbert sort.
function createHitIndexes(self: FeatureBandHost, band: HitIndexSource) {
  const sameInputs = sameAsLast<{
    bpPerPx: number
    showLabels: boolean
    showDescriptions: boolean
    fontSize: number
  }>()
  return {
    flatbush: createEncodeMemo(
      () => band.laidOutDataMap,
      () => {
        const { showLabels, showDescriptions, fontSize } = band.renderedLabels
        return sameInputs({
          bpPerPx: self.layoutInputs.bpPerPx,
          showLabels,
          showDescriptions,
          fontSize,
        })
      },
      (data, { bpPerPx, ...labels }, idx): FlatbushRegionIndexes => ({
        feature: buildFeatureFlatbushIndex(
          data.flatbushItems,
          data.floatingLabelsData,
          bpPerPx,
          self.rpcDataMap.get(idx)?.reversed === true,
          labels,
        ),
        subfeature: buildSubfeatureFlatbushIndex(data.subfeatureInfos),
      }),
    ),
    instances: createEncodeMemo(
      () => band.laidOutDataMap,
      undefined,
      data => buildRegionInstanceIndex(data),
    ),
  }
}

/**
 * The feature pipeline from fetched regions to what a band draws and picks:
 * the fit ladder, the kept stack, the labels it reserved, its sections, its
 * id lookups and its hit indexes. LinearBasicDisplay mixes it into its views;
 * the variant display's records band and the R export host it on a plain
 * object.
 */
export function featureBandViews(self: FeatureBandHost) {
  // One memo per reservation config, since an instance caches one config at a
  // time. Closure state, so MobX sees neither the memos nor their caches.
  const incrementalLayout = createIncrementalLayout()
  const incrementalLayoutLabelsOnly = createIncrementalLayout()
  const incrementalLayoutBodiesOnly = createIncrementalLayout()
  // Unseeded where the rung's knob is chosen by measuring unseeded candidate
  // packs, and the commit has to match what was measured.
  const incrementalLayoutDecimated = createIncrementalLayout({
    seedPriorRows: false,
  })
  const incrementalLayoutIsoforms = createIncrementalLayout({
    seedPriorRows: false,
  })
  const incrementalLayoutThinned = createIncrementalLayout({
    seedPriorRows: false,
  })
  const incrementalLayoutBare = createIncrementalLayout()
  const packHeightsIsoforms = createPackHeightCache()
  const packHeightsThinned = createPackHeightCache()
  const packHeightsDecimated = createPackHeightCache()
  // A settle re-resolves the fit stage onto the same layout and scale, and
  // fresh clones would re-index and re-upload every region.
  let squeezed:
    | {
        layout: ReadonlyMap<number, FeatureDataResult>
        scale: number
        facet: FeatureFacet | undefined
        out: ReadonlyMap<number, FeatureDataResult>
      }
    | undefined
  // A settle re-resolves the fit stage onto the same labels, and a fresh
  // context would re-run every label layer and ink reading it.
  const sameLabels = sameAsLast<LabelPlacementContext>()
  // Built on the first read, off the band as hosted: an MST node or a MobX
  // observable, which the memos must read through to see its computeds.
  let hitIndexes: ReturnType<typeof createHitIndexes> | undefined
  // A rung the ladder stops reaching would otherwise keep its cloned layout
  // and the raw regions it was packed from alive, so each solve empties what
  // this mode cannot reach and drops what the store has since evicted from the
  // rest.
  const releaseUnreachedMemos = () => {
    const live = self.rpcDataMap
    if (!self.fitHeightToDisplay) {
      incrementalLayoutLabelsOnly.clear()
      incrementalLayoutDecimated.clear()
      incrementalLayoutThinned.clear()
      incrementalLayoutBodiesOnly.clear()
      incrementalLayoutBare.clear()
      packHeightsThinned.clear()
      packHeightsDecimated.clear()
    }
    if (self.autoHeight || self.showsEveryIsoform) {
      incrementalLayoutIsoforms.clear()
      packHeightsIsoforms.clear()
    }
    for (const memo of [
      incrementalLayout,
      incrementalLayoutLabelsOnly,
      incrementalLayoutBodiesOnly,
      incrementalLayoutDecimated,
      incrementalLayoutIsoforms,
      incrementalLayoutThinned,
      incrementalLayoutBare,
      packHeightsIsoforms,
      packHeightsThinned,
      packHeightsDecimated,
    ]) {
      memo.prune(live)
    }
  }
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
     * The `isoforms` rung's reservation: the `labels` rung's when fitting to
     * the display, else the `full` rung's.
     */
    get isoformsReservation(): LabelReservation {
      return self.fitHeightToDisplay
        ? this.labelsReservation
        : this.fullReservation
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
        // The factor is solved with the bodies at their floor, so no name
        // goes while a body could still give up height instead.
        bodyScale: this.fitLabeledBodyFloor,
      }
    },
    /**
     * #method
     * Layout inputs for the `decimated` rung at one pair of whitespace
     * factors.
     */
    decimatedLayoutInputs(factors: LabelRoomFactors): LayoutInputs {
      return { ...this.decimatedBaseInputs, ...factors }
    },
    /**
     * #getter
     * Measures the `decimated` rung's stack height at any whitespace factor,
     * against the features the ladder measures its rungs with — so the factor
     * the solve picks is judged on the same stack the rung is then kept or
     * rejected on.
     */
    get decimatedHeightProbe(): (
      labelRoomFactor: number,
      geneLabelRoomFactor?: number,
    ) => number {
      return createContentHeightProbe(
        self.rpcDataMap,
        this.decimatedBaseInputs,
        self.fitMeasureFeatureIds,
        packHeightsDecimated,
      )
    },
    /**
     * #method
     * The whitespace factors the `decimated` rung commits at: gene names
     * first, then the rest, each the smallest whose packed stack fits
     * `trackHeight` (smallest = most names kept), or undefined when even the
     * most aggressive decimation overflows.
     */
    solveLabelRoomFactors(trackHeight: number) {
      const tiers = namedLabelTiers(
        self.rpcDataMap.values(),
        self.fitMeasureFeatureIds,
      )
      return solveLabelRoomFactors(
        this.decimatedHeightProbe,
        trackHeight,
        self.layoutInputs.geneNamesOnly ? { ...tiers, other: false } : tiers,
      )
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
        packHeightsIsoforms,
      )
    },
    /**
     * #getter
     * The most isoforms any trimmable gene on screen has — the top of the
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
      return incrementalLayoutIsoforms(self.rpcDataMap, {
        ...this.isoformsBaseInputs,
        maxIsoformsPerGene,
      })
    },
    /**
     * #getter
     * The `thinned` rung's layout inputs minus the body scale: every name,
     * no descriptions, the `isoforms` rung's count.
     */
    get thinnedBaseInputs(): LabelRoomFactorFreeInputs {
      return {
        ...self.layoutInputs,
        ...this.labelsReservation,
        maxIsoformsPerGene: this.fitIsoformCount,
      }
    },
    /**
     * #method
     * Measures a labelled stack's height at any body scale. Each scale
     * needs a separate prep, since the pack reads body heights from it.
     */
    bodyScaleHeightProbe(
      cache: PackHeightCache,
      inputs: LabelRoomFactorFreeInputs,
      factors?: LabelRoomFactors,
    ): (bodyScale: number) => number {
      const heightAt = createPackHeightProbe(
        self.rpcDataMap,
        inputs,
        self.fitMeasureFeatureIds,
        cache,
      )
      return bodyScale =>
        heightAt({
          bodyScale,
          maxIsoformsPerGene: inputs.maxIsoformsPerGene,
          labelRoomFactor: factors?.labelRoomFactor,
          geneLabelRoomFactor: factors?.geneLabelRoomFactor,
        })
    },
    /**
     * #getter
     * The smallest body scale the labelled rungs may pack at: the tallest
     * body stays `LABELED_BODY_TO_FONT_RATIO` of the label font, and the
     * shortest stays drawn.
     */
    get fitLabeledBodyFloor() {
      return labeledBodyFloorScale(
        maxDrawnBoxHeight(this.baseLaidOutDataMap, self.fitMeasureFeatureIds),
        this.fitSmallestBoxPx,
        self.labelFontSize,
      )
    },
    /**
     * #getter
     * The body scale the `thinned` rung commits at: the largest whose
     * stack, every name kept, fits `fitTargetHeight`, or undefined when even
     * the floor overflows.
     */
    get fitBodyScale(): number | undefined {
      if (!self.layoutReady || !self.showLabels) {
        return undefined
      }
      return solveBodyScale(
        this.bodyScaleHeightProbe(packHeightsThinned, this.thinnedBaseInputs),
        self.fitTargetHeight,
        this.fitLabeledBodyFloor,
      )
    },
    /**
     * #getter
     * The `thinned` stack: every name at its font size over bodies shortened
     * to `fitBodyScale`.
     */
    get fitThinnedSolved(): Map<number, FeatureDataResult> {
      const bodyScale = this.fitBodyScale
      // Falls back to a stack the ladder already rejected, so it moves on.
      return bodyScale === undefined
        ? this.fitIsoformsSolved
        : incrementalLayoutThinned(self.rpcDataMap, {
            ...this.thinnedBaseInputs,
            bodyScale,
          })
    },
    /**
     * #getter
     * Full reservation (names + descriptions): rendered at fit stage `full`
     * and in non-fit modes, and the first stack `fitStage` probes.
     */
    get baseLaidOutDataMap(): Map<number, FeatureDataResult> {
      return this.fitLayoutAt(incrementalLayout, this.fullReservation)
    },
    /**
     * #getter
     * Names reserved, descriptions dropped — the `labels` stage's stack.
     */
    get fitLabelsOnlyLayout(): Map<number, FeatureDataResult> {
      return self.effectiveShowDescriptions
        ? this.fitLayoutAt(incrementalLayoutLabelsOnly, this.labelsReservation)
        : this.baseLaidOutDataMap
    },
    /**
     * #getter
     * The whitespace factors the `decimated` rung commits at: the smallest
     * whose packed stack fits `fitTargetHeight`, so the most names are kept.
     */
    get fitDecimatedFactors(): LabelRoomFactors | undefined {
      // Memoized so `rowGeometrySignature` reads the same answer the rung
      // packed at without a second bisection.
      return self.layoutReady && self.showLabels
        ? this.solveLabelRoomFactors(self.fitTargetHeight)
        : undefined
    },
    /**
     * #getter
     * The `decimated` stack: names kept only on features with at least
     * their tier's `fitDecimatedFactors ×` their label width in neighbour
     * whitespace (plus pinned/highlighted, always).
     */
    get fitDecimatedSolved(): Map<number, FeatureDataResult> {
      // Probe and commit must pack identically, hence the unseeded
      // `incrementalLayoutDecimated`; seeding this rung from the `labels`
      // stack was tried and moved zero rows.
      const factors = this.fitDecimatedFactors
      // Falls back to the `isoforms` stack, not `labels`: this rung is below
      // that one, and falling past its trim packs a stack the ladder already
      // rejected.
      const bodyScale = this.fitDecimatedBodyScale
      if (factors === undefined || bodyScale === undefined) {
        return this.fitIsoformsSolved
      }
      const layout = incrementalLayoutDecimated(self.rpcDataMap, {
        ...this.decimatedLayoutInputs(factors),
        bodyScale,
      })
      // With no name left it is the `bodies` stack under the wrong name.
      return keepsAnyName(layout, self.fitMeasureFeatureIds)
        ? layout
        : this.fitIsoformsSolved
    },
    /**
     * #getter
     * The body scale the `decimated` rung commits at: with the names
     * `fitDecimatedFactors` kept, the bodies grow back into whatever height
     * the dropped names freed.
     */
    get fitDecimatedBodyScale(): number | undefined {
      const factors = this.fitDecimatedFactors
      if (factors === undefined) {
        return undefined
      }
      const floor = this.fitLabeledBodyFloor
      return (
        solveBodyScale(
          this.bodyScaleHeightProbe(
            packHeightsDecimated,
            this.decimatedBaseInputs,
            factors,
          ),
          self.fitTargetHeight,
          floor,
        ) ?? floor
      )
    },
    get fitBodiesOnlyLayout(): Map<number, FeatureDataResult> {
      const maxIsoformsPerGene = this.fitIsoformCount
      // Shared by reference only while there is no trim to apply, or the
      // reuse drops it.
      return self.showLabels || maxIsoformsPerGene !== undefined
        ? incrementalLayoutBodiesOnly(self.rpcDataMap, {
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
      return incrementalLayoutBare(self.rpcDataMap, {
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
     * The resolved fit outcome — which reservation `level` survived, its
     * unscaled `layout`, and the vertical `scale` to fill the track — bundled
     * so the three can never disagree.
     */
    get fitStage(): FitStage {
      const base = this.baseLaidOutDataMap
      const fit = self.fitHeightToDisplay
      // Non-fit mode routes through `resolveFitLadder` too, with minScale =
      // 1, so FitStage is assembled in one place. maxScale is 1 in every
      // mode: a stack with room to spare keeps its display mode's size.
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
      const stage = resolveFitLadder(
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
                level: 'thinned',
                reserved: this.labelsReservation,
                layout: () => this.fitThinnedSolved,
                maxIsoforms: trimmed,
                bodyScale: () => this.fitBodyScale ?? 1,
              },
              {
                level: 'decimated',
                reserved: this.labelsReservation,
                layout: () => this.fitDecimatedSolved,
                maxIsoforms: trimmed,
                bodyScale: () => this.fitDecimatedBodyScale ?? 1,
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
        1,
        self.fitMeasureFeatureIds,
        // The chip rows keep their 16 px under the squeeze, so the scale is
        // solved over the rows alone.
        layout => {
          const { facet } = self
          return facet
            ? featureGroupSections(layout, facet, GROUP_LABEL_HEIGHT).length *
                GROUP_LABEL_HEIGHT
            : 0
        },
      )
      releaseUnreachedMemos()
      return stage
    },
    /**
     * #getter
     * What every consumer (hit test, GPU upload, React render) reads: the
     * kept stack, cloned and scaled only when squeezed, or with what
     * overflows left unplaced on a host that hides it.
     */
    get laidOutDataMap(): ReadonlyMap<number, FeatureDataResult> {
      const { layout, scale } = this.fitStage
      const { facet } = self
      if (self.hidesOverflow) {
        return unplaceBelow(layout, self.fitTargetHeight)
      }
      if (scale === 1) {
        return layout
      }
      if (
        squeezed?.layout !== layout ||
        squeezed.scale !== scale ||
        squeezed.facet !== facet
      ) {
        squeezed = {
          layout,
          scale,
          facet,
          out: scaleLaidOutData(
            layout,
            scale,
            facet && { facet, chipPx: GROUP_LABEL_HEIGHT },
          ),
        }
      }
      return squeezed.out
    },
    /**
     * #getter
     * The labels the kept rung reserved room for, and the size it priced
     * them at: what the canvas, the DOM layer, the hit test, the highlight
     * and the SVG export all draw or measure.
     */
    get renderedLabels(): LabelPlacementContext {
      return sameLabels(
        renderedLabelContext(
          this.fitStage,
          self.reservesBelowLabelRows,
          self.labelFontSize,
        ),
      )
    },
    /**
     * #getter
     * The stacked sections in stacking order, each with the chip row the
     * packer reserved above it, read off the same rows the glyphs paint;
     * empty while ungrouped.
     */
    get groupSections(): FeatureGroupSection[] {
      const { facet } = self
      return facet
        ? featureGroupSections(this.laidOutDataMap, facet, GROUP_LABEL_HEIGHT)
        : []
    },
    /**
     * #getter
     */
    get featureIdIndex() {
      return indexById(this.laidOutDataMap, d => d.flatbushItems)
    },
    /**
     * #getter
     */
    get subfeatureIdIndex() {
      return indexById(this.laidOutDataMap, d => d.subfeatureInfos)
    },
    /**
     * #method
     * Where a feature drew, `[startBp, top, endBp, bottom]`. A feature the
     * layout left unplaced, truncated or in a hidden section, is not found.
     */
    searchFeatureByID(id: string) {
      const item = this.featureIdIndex.get(id)
      return item && isPlacedRow(item.topPx)
        ? ([item.startBp, item.topPx, item.endBp, item.bottomPx] as const)
        : undefined
    },
    /**
     * #getter
     * Per-region hit index over the kept stack and the RENDERED label
     * flags, a label's overhang being part of its hit box.
     */
    get flatbushIndexes(): ReadonlyMap<number, FlatbushRegionIndexes> {
      if (!hitIndexes) {
        hitIndexes = createHitIndexes(self, this)
      }
      return hitIndexes.flatbush()
    },
    /**
     * #getter
     * Feature and subfeature ids to the primitives they painted, per
     * laid-out region. Deliberately held by no autorun: nothing builds it
     * until a hover or a selection asks which instances to light, and the
     * per-region memo outlives the computed that MobX drops between hovers.
     */
    get regionInstanceIndexes(): ReadonlyMap<number, RegionInstanceIndex> {
      if (!hitIndexes) {
        hitIndexes = createHitIndexes(self, this)
      }
      return hitIndexes.instances()
    },
  }
}

/**
 * The band on a plain host, for a host that is no MST model: `observable`
 * caches each getter as a computed, as mixing it into a model's views does,
 * and leaves its methods plain.
 */
export function hostFeatureBand(host: FeatureBandHost) {
  return observable(featureBandViews(host), {
    fitLayoutAt: false,
    decimatedLayoutInputs: false,
    solveLabelRoomFactors: false,
    bodyScaleHeightProbe: false,
    searchFeatureByID: false,
  })
}
