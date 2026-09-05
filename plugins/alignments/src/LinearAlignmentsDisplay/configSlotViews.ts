import {
  getConf,
  makePin,
  makeTogglePin,
  resolveConf,
} from '@jbrowse/core/configuration'

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
 * Every track-menu toggle that is nothing but its config slot: a `getConf` or a
 * promotable `resolveConf` read, or the `makePin` control that promotes one.
 * Config slots persist across hide/retick (#5591), unlike the MST props these
 * replaced.
 *
 * They live here rather than in the model chain because none of them reads the
 * model — only its `configuration`, which `ResolvableDisplay` is core's name for.
 * The chain keeps them as one `.views(configSlotViews)` link, so the composed
 * TYPE is unchanged and every read site is still `self.x`.
 *
 * **A getter that reads any OTHER model member does not belong here** — it
 * belongs in the chain, where `self` is the model so far. That is the line
 * between this file and model.ts, and it is why `collapseGroupRows` (which reads
 * `canCollapseGroupRows`) and `showOutline` (which reads `isChainMode`) stayed
 * behind despite also being slot reads.
 */
export interface ConfigSlotSelf extends IStateTreeNode {
  // `type` because the promotable cascade keys its session-wide tier on the
  // display type, and `configuration` because that is where the slot lives.
  // Spelled out rather than `extends ResolvableDisplay`: that is an intersection
  // alias, and an interface extending it drops the members it does not restate.
  type: string
  configuration: Instance<LinearAlignmentsDisplayConfigSchema>
}

export function configSlotViews(self: ConfigSlotSelf) {
  return {
    /** #getter */
    // Resolved through the promotable-slot tiers: a track pins 'off'/'normal'
    // explicitly, else follows the session-wide default (view-as-pairs),
    // falling back to 'off'. resolveConf never returns the unset sentinel.
    // See promotableDefaults.ts.
    get linkedReads(): LinkedReadsMode {
      return resolveConf(self, 'linkedReads')
    },
    /** #getter */
    // "apply view-as-pairs to the open tracks" control (pin): active
    // when 'normal' is the session default for this display type
    get pairsDisplayTypeDefault() {
      return makePin(self, 'linkedReads', 'normal')
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
    // Resolved through the promotable-slot tiers: a track pins
    // 'off'/'arc'/'cloud' explicitly, else follows the session-wide
    // default, falling back to 'off'. resolveConf never returns the
    // unset sentinel. See promotableDefaults.ts.
    get readConnections(): ReadConnectionsMode {
      return resolveConf(self, 'readConnections')
    },
    /** #getter */
    // "apply arcs to the open tracks" control (pin): active when
    // 'arc' is the session default. Independent of read cloud (both toggles
    // share the readConnections slot but target different on-values).
    get arcsDisplayTypeDefault() {
      return makePin(self, 'readConnections', 'arc')
    },
    /** #getter */
    // "apply read cloud to the open tracks" control (pin): active when
    // 'cloud' is the session default
    get readCloudDisplayTypeDefault() {
      return makePin(self, 'readConnections', 'cloud')
    },
    /** #getter */
    // Resolved through the promotable-slot tiers (resolveConf): a
    // maybeBoolean sentinel (like showSoftClipping) — an unset track follows
    // the session-wide default, else the promotedBase (true). resolveConf
    // never surfaces the `undefined` inherit sentinel.
    get readConnectionsDown(): boolean {
      return resolveConf(self, 'readConnectionsDown')
    },
    /** #getter */
    // the arcs-below-coverage checkbox over every open track of this type (pin)
    get readConnectionsDownDisplayTypeDefault() {
      return makeTogglePin(self, 'readConnectionsDown')
    },
    /** #getter */
    // Sentinel promotable slot: a track pins arcs on/off explicitly, else
    // follows the session-wide default, falling back to on.
    get showSashimiArcs(): boolean {
      return resolveConf(self, 'showSashimiArcs')
    },
    /**
     * #getter
     * the submenu's own sashimi checkbox over every open track of this type
     * (pin)
     */
    get showSashimiArcsDisplayTypeDefault() {
      return makeTogglePin(self, 'showSashimiArcs')
    },
    /** #getter */
    // Sentinel promotable slot (like linkedReads/readConnections): a track
    // pins 'up' explicitly, else follows the session-wide default, falling
    // back to 'up'.
    get sashimiArcsMode(): SashimiArcsMode {
      return resolveConf(self, 'sashimiArcsMode')
    },
    /**
     * #method
     * "apply this arc placement to the open tracks" control (pin),
     * one per option of the radio group. A method rather than a getter per
     * value: the options share one slot and differ only in the on-value, so
     * naming each combination was what made the base value 'up' look
     * unpinnable.
     */
    sashimiArcsModeDisplayTypeDefault(mode: SashimiArcsMode) {
      return makePin(self, 'sashimiArcsMode', mode)
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
    // Resolved through the promotable-slot tiers (resolveConf): an
    // explicit track value customizes soft clipping on or off; otherwise it
    // follows the session-wide default, falling back to off. A `maybeBoolean`
    // slot, so (unlike the old plain boolean) an explicit "off" can be customized
    // back over a session default of "on".
    get showSoftClipping(): boolean {
      return resolveConf(self, 'showSoftClipping')
    },

    /** #getter */
    // the soft-clipping checkbox over every open track of this type (pin)
    get softClippingDisplayTypeDefault() {
      return makeTogglePin(self, 'showSoftClipping')
    },

    /**
     * #getter
     */
    // colorBy is a sentinel promotable slot: a track following the default (colorBy at
    // its unset default) follows the session-wide color default
    // (e.g. "color every alignments track by methylation"), resolving to the
    // `promotedBase` `{type:'normal'}` when nothing is promoted; picking any
    // scheme — `normal` included — pins this track over that default.
    // resolveConf walks the cascade and never surfaces `inherit`.
    get colorBy(): ColorBy {
      return normalizeColorBy(resolveConf(self, 'colorBy'))
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
      return resolveConf(self, 'featureHeight')
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
     * Resolved through the promotable-slot tiers (resolveConf): an
     * explicit track value pins labels on or off; otherwise it follows the
     * session-wide default, falling back to off. A `maybeBoolean` slot, so
     * (like mismatchAlpha) a session default of "on" can be customized back
     * off on a single track.
     */
    get showSashimiLabels(): boolean {
      return resolveConf(self, 'showSashimiLabels')
    },
    /**
     * #getter
     * the sashimi-labels checkbox over every open track of this type (pin)
     */
    get showSashimiLabelsDisplayTypeDefault() {
      return makeTogglePin(self, 'showSashimiLabels')
    },
    /**
     * #getter
     * Whether junctions with a non-canonical splice motif are dropped from
     * the sashimi arcs. Promotable like `showSashimiLabels`.
     */
    get hideNonCanonicalJunctions(): boolean {
      return resolveConf(self, 'hideNonCanonicalJunctions')
    },
    /**
     * #getter
     * the non-canonical-junction checkbox over every open track of this
     * type (pin)
     */
    get hideNonCanonicalJunctionsDisplayTypeDefault() {
      return makeTogglePin(self, 'hideNonCanonicalJunctions')
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
    // Resolved through the promotable-slot tiers (resolveConf): an
    // explicit track value customizes the fade on or off; otherwise it follows the
    // session-wide default, falling back to off. A `maybeBoolean` slot, so
    // (unlike showSoftClipping) a session default of "on" can be customized back
    // off on a single track.
    get mismatchAlpha(): boolean {
      return resolveConf(self, 'mismatchAlpha')
    },
    /**
     * #getter
     */
    // the fade-by-quality checkbox over every open track of this type (pin)
    get mismatchAlphaDisplayTypeDefault() {
      return makeTogglePin(self, 'mismatchAlpha')
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
