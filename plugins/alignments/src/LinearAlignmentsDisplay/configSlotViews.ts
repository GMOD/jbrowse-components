import { getConf } from '@jbrowse/core/configuration'
import { withPreset } from '@jbrowse/core/util/colorScale'
import { colorSettingOf } from '@jbrowse/display-kit/colorConfigSchema'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'

import {
  ALIGNMENTS_FIELD_PRESETS,
  alignmentsColorEncoding,
  alignmentsColorNotices,
  baseLayerOf,
  bodyColorScheme,
  colorByOf,
  colorFieldOf,
  pinnedInsertSizeBand,
} from '../shared/alignmentsColor.ts'
import { arcColorFieldOf } from '../shared/arcColorOptions.ts'
import { facetUnitNotices } from '../shared/groupFeatures.ts'
import { isLayoutOrder } from '../shared/types.ts'
import { readFilterOf } from './readFilterConfigSchema.ts'

import type {
  AlignmentsColorEncoding,
  AlignmentsColorSetting,
} from '../shared/alignmentsColor.ts'
import type {
  ArcColorField,
  BaseLayer,
  ColorSchemeType,
  ReadFilter,
  Facet,
  LayoutOrder,
  ModificationColorBy,
  ReadColorBy,
  SortType,
} from '../shared/types.ts'
import type { LinearAlignmentsDisplayConfigSchema } from './configSchema.ts'
import type {
  AlignmentsUnit,
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
 * `canCollapseGroupRows`) and `showOutline` (which reads `unit`) stayed
 * behind despite also being slot reads.
 */
export interface ConfigSlotSelf extends IStateTreeNode {
  type: string
  configuration: Instance<LinearAlignmentsDisplayConfigSchema>
}

export function configSlotViews(self: ConfigSlotSelf) {
  const insertSizeBand = stableIdentityComputed(() =>
    pinnedInsertSizeBand(
      alignmentsColorEncoding(colorSettingOf(self.configuration.color)),
    ),
  )
  return {
    /** #getter */
    get unit(): AlignmentsUnit {
      return getConf(self, 'unit')
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
    get showInterchrom(): boolean {
      return getConf(self, 'showInterchrom')
    },
    /**
     * #getter
     * Whether ordinary concordant pairs get an arc. Same definition of
     * concordant as `filterBy.properPairs`, which hides the reads themselves —
     * see `isConcordantPairRead`.
     */
    get showProperPairArcs(): boolean {
      return getConf(self, 'showProperPairArcs')
    },
    /**
     * #getter
     * Whether the read cloud keeps the pairs of ordinary insert size.
     */
    get showModalPairsInCloud(): boolean {
      return getConf(self, 'showModalPairsInCloud')
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
    get showLongRange(): boolean {
      return getConf(self, 'showLongRange')
    },
    /** #getter */
    get readConnections(): ReadConnectionsMode {
      return getConf(self, 'readConnections')
    },
    /** #getter */
    get readConnectionsDown(): boolean {
      return getConf(self, 'readConnectionsDown')
    },
    /**
     * #getter
     * Whether sashimi arcs draw: the slot, and the coverage band they hang off.
     */
    get showSashimiArcs(): boolean {
      return getConf(self, 'showSashimiArcs') && this.showCoverage
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
    get colorSetting(): AlignmentsColorSetting {
      return colorSettingOf(self.configuration.color)
    },
    /**
     * #getter
     * `colorSetting` as it paints, through the one resolver every display's
     * color object goes through.
     */
    get colorEncoding(): AlignmentsColorEncoding {
      return alignmentsColorEncoding(this.colorSetting)
    },
    /**
     * #getter
     * `color.labels` as written, read apart from `colorSetting`, which every
     * color tier keys on, so renaming a key entry re-bakes no read.
     */
    get colorLabels(): readonly string[] {
      return getConf(self, ['color', 'labels'])
    },
    /**
     * #getter
     * `color.title` as written: unset keeps the key's own heading, `''` draws
     * none.
     */
    get colorTitle(): string | undefined {
      return getConf(self, ['color', 'title'])
    },
    /**
     * #getter
     * The key's heading: `color.title` as written, else its field preset's
     * while the color paints through the preset, so `{ field: 'mapq' }` keys
     * as "Mapping quality". Unset keeps the key's own heading.
     */
    get colorKeyTitle(): string | undefined {
      return withPreset(
        { ...this.colorSetting, title: this.colorTitle },
        ALIGNMENTS_FIELD_PRESETS,
      ).title
    },
    /**
     * #getter
     * `color.descending` as written, else its field preset's while the color
     * paints through the preset, so `{ field: 'mapq' }` keys 30+ first. Read
     * apart from `colorSetting`, so turning the key round re-bakes no read.
     */
    get colorKeyDescending(): boolean | undefined {
      return withPreset(
        {
          ...this.colorSetting,
          descending: getConf(self, ['color', 'descending']),
        },
        ALIGNMENTS_FIELD_PRESETS,
      ).descending
    },
    /**
     * #getter
     * What the `color` object's slots say together that it cannot paint as
     * written, which the corner notice lists.
     */
    get colorNotices(): string[] {
      return alignmentsColorNotices({
        ...this.colorSetting,
        labels: this.colorLabels,
      })
    },
    /**
     * #getter
     * What `facet` names that `unit` cannot group by, which the corner notice
     * lists.
     */
    get facetNotices(): string[] {
      return facetUnitNotices(this.facet, this.unit)
    },
    /**
     * #getter
     * The short/long cut points `color.domain` pins under an insert-size
     * field, undefined while the sampled band decides. Compared by value, so
     * a color write that leaves the cut points alone relayouts nothing.
     */
    get pinnedInsertSizeBand() {
      return insertSizeBand.get()
    },
    /**
     * #getter
     */
    get modificationSettings(): ModificationColorBy {
      return getConf(self, 'modifications')
    },
    /**
     * #getter
     * The read fill `color` selects.
     */
    get colorBy(): ReadColorBy {
      return colorByOf(this.colorEncoding)
    },
    /**
     * #getter
     * The field the read fill paints by, `''` for the plain fill.
     */
    get colorField(): string {
      return colorFieldOf(this.colorBy)
    },
    /**
     * #getter
     * The field the arcs and the read cloud paint: `arcColor`'s own, or the
     * reads' where `arcColor` names none.
     */
    get arcColorField(): ArcColorField {
      return arcColorFieldOf(
        getConf(self, ['arcColor', 'field']),
        this.colorField,
      )
    },
    /**
     * #getter
     * The per-base layer `baseColor` selects, with the settings the
     * modification fields read beside it; undefined while none is drawn.
     */
    get baseLayer(): BaseLayer | undefined {
      return baseLayerOf(
        {
          field: getConf(self, ['baseColor', 'field']),
          scale: getConf(self, ['baseColor', 'scale']),
        },
        this.modificationSettings,
      )
    },
    /**
     * #getter
     * What the read body paints as: `colorBy`, or the modification layer's
     * own pale strand tint while the fill is plain.
     */
    get bodyColorScheme(): ColorSchemeType {
      return bodyColorScheme(this.colorBy, this.baseLayer)
    },
    /**
     * #getter
     */
    get readFilter(): ReadFilter {
      return readFilterOf(self.configuration.filter)
    },
    /**
     * #getter
     */
    // The configured fixed-mode read size, independent of the fit squeeze.
    // Consumers that EDIT the size (the "Custom..." height dialog) must
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
    get showNonCanonicalJunctions(): boolean {
      return getConf(self, 'showNonCanonicalJunctions')
    },
    /**
     * #getter
     */
    get fadeLowFreqMismatches(): boolean {
      return getConf(self, 'fadeLowFreqMismatches')
    },
    /**
     * #getter
     */
    get mismatchAlpha(): boolean {
      return getConf(self, 'mismatchAlpha')
    },
    /**
     * #getter
     * The whole-window row order: `sort`'s type, or `position` under a column
     * sort, which lays the reads off its column out by start (a tier-2
     * relayout).
     */
    get layoutOrder(): LayoutOrder {
      const type: SortType = getConf(self, ['sort', 'type'])
      return isLayoutOrder(type) ? type : 'position'
    },
    /**
     * #getter
     * The `facet` object as written, undefined while ungrouped. The worker
     * partitions one fetch into a section per value of its field.
     */
    get facet(): Facet | undefined {
      return facetSettingOf({
        field: getConf(self, ['facet', 'field']),
        domain: getConf(self, ['facet', 'domain']),
      })
    },
    /**
     * #getter
     */
    get readConnectionsLineWidth() {
      return getConf(self, 'readConnectionsLineWidth')
    },
  }
}
