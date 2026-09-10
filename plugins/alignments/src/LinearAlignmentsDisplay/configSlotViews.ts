import { getConf } from '@jbrowse/core/configuration'

import { normalizeColorBy } from '../shared/colorSchemes.ts'
import { normalizeGroupBy } from '../shared/groupFeatures.ts'
import { normalizeFilterBy } from '../shared/types.ts'

import type {
  ArcColorByType,
  ColorBy,
  FilterBy,
  GroupBy,
} from '../shared/types.ts'
import type { LinearAlignmentsDisplayConfigSchema } from './configSchema.ts'
import type {
  LinkedReadsMode,
  ReadConnectionsMode,
  SashimiArcsMode,
} from './constants.ts'
import type { IStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

/**
 * Every track-menu toggle that is nothing but its config slot, read with
 * `getConf`. Config slots persist across hide/retick (#5591), unlike the MST
 * props these replaced.
 *
 * They live here rather than in the model chain because none of them reads the
 * model — only its `configuration`. The chain keeps them as one
 * `.views(configSlotViews)` link, so the composed TYPE is unchanged and every
 * read site is still `self.x`.
 *
 * **A getter that reads any OTHER model member does not belong here** — it
 * belongs in the chain, where `self` is the model so far. That is the line
 * between this file and model.ts, and it is why `collapseGroupRows` (which reads
 * `canCollapseGroupRows`) and `showOutline` (which reads `isChainMode`) stayed
 * behind despite also being slot reads.
 */
export interface ConfigSlotSelf extends IStateTreeNode {
  type: string
  configuration: Instance<LinearAlignmentsDisplayConfigSchema>
}

export function configSlotViews(self: ConfigSlotSelf) {
  return {
    /** #getter */
    get linkedReads(): LinkedReadsMode {
      return getConf(self, 'linkedReads')
    },
    /** #getter */
    get showBezierConnections(): boolean {
      return getConf(self, 'showBezierConnections')
    },
    /** #getter */
    get showCoverage(): boolean {
      return getConf(self, 'showCoverage')
    },
    /** #getter */
    get showPileup(): boolean {
      return getConf(self, 'showPileup')
    },
    /** #getter */
    get coverageHeight(): number {
      return getConf(self, 'coverageHeight')
    },
    /** #getter */
    get coverageSnpMinFrequency(): number {
      return getConf(self, 'coverageSnpMinFrequency')
    },
    /** #getter */
    get showMismatches(): boolean {
      return getConf(self, 'showMismatches')
    },
    /** #getter */
    get showInterbaseIndicators(): boolean {
      return getConf(self, 'showInterbaseIndicators')
    },
    /** #getter */
    get flipStrandLongReadChains(): boolean {
      return getConf(self, 'flipStrandLongReadChains')
    },
    /** #getter */
    get colorSupplementaryChains(): boolean {
      return getConf(self, 'colorSupplementaryChains')
    },
    /** #getter */
    get drawInter(): boolean {
      return getConf(self, 'drawInter')
    },
    /**
     * #getter
     * Whether ordinary concordant pairs get an arc. Same definition of
     * concordant as `filterBy.properPairs`, which hides the reads themselves —
     * see `isConcordantPairRead`.
     */
    get drawProperPairArcs(): boolean {
      return getConf(self, 'drawProperPairArcs')
    },
    /**
     * #getter
     * Reads a translocation must gather, within one fragment length on both
     * sides, before its connector ticks are drawn. See
     * `clusteredInterchromSupport` — the count is over a window because a
     * mate-pair breakpoint is not localized to a base.
     */
    get minInterchromSupport(): number {
      return getConf(self, 'minInterchromSupport')
    },
    /** #getter */
    get drawLongRange(): boolean {
      return getConf(self, 'drawLongRange')
    },
    /** #getter */
    get arcColorByType(): ArcColorByType {
      return getConf(self, 'arcColorByType')
    },
    /** #getter */
    get readConnections(): ReadConnectionsMode {
      return getConf(self, 'readConnections')
    },
    /** #getter */
    get readConnectionsDown(): boolean {
      return getConf(self, 'readConnectionsDown')
    },
    /** #getter */
    get showSashimiArcs(): boolean {
      return getConf(self, 'showSashimiArcs')
    },
    /** #getter */
    get sashimiArcsMode(): SashimiArcsMode {
      return getConf(self, 'sashimiArcsMode')
    },
    /** #getter */
    get minSashimiScore(): number {
      return getConf(self, 'minSashimiScore')
    },
    /** #getter */
    get sashimiArcsHeight(): number {
      return getConf(self, 'sashimiArcsHeight')
    },
    /** #getter */
    get readConnectionsHeight(): number {
      return getConf(self, 'readConnectionsHeight')
    },
    /** #getter */
    get showSoftClipping(): boolean {
      return getConf(self, 'showSoftClipping')
    },

    /**
     * #getter
     */
    get colorBy(): ColorBy {
      return normalizeColorBy(getConf(self, 'colorBy'))
    },
    /**
     * #getter
     */
    get filterBy(): FilterBy {
      return normalizeFilterBy(getConf(self, 'filterBy'))
    },
    /**
     * #getter
     */
    // The configured fixed-mode read size, independent of the fit squeeze.
    // Consumers that EDIT the size (the "Set feature height" dialog) must
    // start from the configured value, not the fractional fit pitch that
    // `featureHeight` resolves to in fit mode — otherwise opening the dialog
    // while compressed would bake the squeezed height.
    get configuredFeatureHeight(): number {
      return getConf(self, 'featureHeight')
    },
    /**
     * #getter
     */
    get maxHeight() {
      return getConf(self, 'maxHeight')
    },
    /**
     * #getter
     * Whether to draw the supporting-read count on each sashimi arc.
     */
    get showSashimiLabels(): boolean {
      return getConf(self, 'showSashimiLabels')
    },
    /**
     * #getter
     * Whether junctions with a non-canonical splice motif are dropped from
     * the sashimi arcs.
     */
    get hideNonCanonicalJunctions(): boolean {
      return getConf(self, 'hideNonCanonicalJunctions')
    },
    /**
     * #getter
     */
    get showLowFreqMismatches() {
      return !!getConf(self, 'showLowFreqMismatches')
    },
    /**
     * #getter
     */
    get mismatchAlpha(): boolean {
      return getConf(self, 'mismatchAlpha')
    },
    /**
     * #getter
     * Lay out the widest features in the lowest pileup rows (main-thread
     * tier-2 relayout via laidOutPileupMap). LGVSyntenyDisplay defaults it
     * on. Ignored while an explicit `sortedBy` position sort is active.
     */
    get largeFeaturesFirst(): boolean {
      return getConf(self, 'largeFeaturesFirst')
    },
    /**
     * #getter
     * Lay out reads whose CIGAR carries a skip in the lowest pileup rows
     * (tier-2 relayout). Ignored while an explicit `sortedBy` position
     * sort is active.
     */
    get splicedReadsFirst(): boolean {
      return getConf(self, 'splicedReadsFirst')
    },
    /**
     * #getter
     * In-track stacked grouping dimension (undefined = ungrouped). Falls
     * back to the `groupBy` config slot, so a track can be pre-grouped
     * declaratively. Sent to the worker via rpcProps; the worker partitions
     * one fetch into N sections. The slot is `frozen` (unvalidated JSON), so
     * `normalizeGroupBy` is the chokepoint that keeps an unrecognized type or
     * a tag grouping with no tag name from reaching the worker.
     */
    get groupBy(): GroupBy | undefined {
      return normalizeGroupBy(getConf(self, 'groupBy'))
    },
    /**
     * #getter
     */
    get readConnectionsLineWidth() {
      return getConf(self, 'readConnectionsLineWidth')
    },
  }
}
