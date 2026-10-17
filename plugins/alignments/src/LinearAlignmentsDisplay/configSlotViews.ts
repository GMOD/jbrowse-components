import { getConf, readConfObject, setConf } from '@jbrowse/core/configuration'
import { withPreset } from '@jbrowse/core/util/colorScale'
import { colorSettingOf } from '@jbrowse/display-kit/colorConfigSchema'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'

import { ordinaryPairsShown } from '../features/arcs/arcTypes.ts'
import {
  ALIGNMENTS_FIELD_PRESETS,
  alignmentsColorEncoding,
  alignmentsColorProblems,
  baseLayerOf,
  bodyColorScheme,
  colorByOf,
  colorFieldOf,
  pinnedInsertSizeBand,
} from '../shared/alignmentsColor.ts'
import { arcColorFieldOf } from '../shared/arcColorOptions.ts'
import { facetUnitNotices } from '../shared/groupFeatures.ts'
import { sortOf } from './alignmentsSortConfigSchema.ts'
import { drawnReadConnectionsOf } from './constants.ts'
import { readFilterOf } from './readFilterConfigSchema.ts'

import type {
  AlignmentsColorEncoding,
  AlignmentsColorSetting,
} from '../shared/alignmentsColor.ts'
import type {
  ArcColorField,
  BaseLayer,
  ColorSchemeType,
  ReadConnectionsFilter,
  ReadFilter,
  Facet,
  LayoutOrder,
  ModificationColorBy,
  ReadColorBy,
  SashimiFilter,
} from '../shared/types.ts'
import type { LinearAlignmentsDisplayConfigSchema } from './configSchema.ts'
import type {
  AlignmentsUnit,
  ReadConnectionsMark,
  ReadConnectionsMode,
  ReadConnectionsPlacement,
  SashimiPlacement,
} from './constants.ts'
import type { CoverageFilter } from '@jbrowse/alignments-core/coverageBandConfigSchema'
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
 * between this file and model.ts, and it is why `collapseSections` (which reads
 * `canCollapseSections`) and `showOutline` (which reads `unit`) stayed
 * behind despite also being slot reads.
 */
/**
 * What a config says beside the schema's rules that the reads cannot draw as
 * written: a per-base `color.field`, levels a field does not have, and a
 * `facet` the `unit` cannot group by.
 */
export function alignmentsConfigProblems(
  conf: Instance<LinearAlignmentsDisplayConfigSchema>,
) {
  return [
    ...alignmentsColorProblems({
      ...colorSettingOf(conf.color),
      labels: readConfObject(conf, ['color', 'labels']),
    }),
    ...facetUnitNotices(
      facetSettingOf({
        field: readConfObject(conf, ['facet', 'field']),
        domain: readConfObject(conf, ['facet', 'domain']),
      }),
      readConfObject(conf, 'unit'),
    ),
  ]
}

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
    get showCoverage(): boolean {
      return getConf(self, ['coverage', 'show'])
    },
    /** #getter */
    get coverageHeight(): number {
      return getConf(self, ['coverage', 'height'])
    },
    /** #getter */
    get showInterbaseIndicators(): boolean {
      return getConf(self, ['coverage', 'showInterbaseIndicators'])
    },
    /** #getter */
    get coverageFilter(): CoverageFilter {
      return {
        minAlleleFraction: getConf(self, [
          'coverage',
          'filter',
          'minAlleleFraction',
        ]),
      }
    },
    /** #getter */
    get showPileup(): boolean {
      return getConf(self, ['pileup', 'show'])
    },
    /**
     * #getter
     * `pileup.readHeight` as configured, independent of the fit squeeze.
     * Consumers that EDIT the size (the "Custom..." height dialog) must start
     * from it, not the fractional fit pitch `featureHeight` resolves to in fit
     * mode, or opening the dialog while compressed would bake the squeeze.
     */
    get configuredReadHeight(): number {
      return getConf(self, ['pileup', 'readHeight'])
    },
    /** #getter */
    get pileupMaxLayoutHeight(): number {
      return getConf(self, ['pileup', 'maxLayoutHeight'])
    },
    /** #getter */
    get showMismatches(): boolean {
      return getConf(self, ['pileup', 'showMismatches'])
    },
    /** #getter */
    get showSoftClipping(): boolean {
      return getConf(self, ['pileup', 'showSoftClipping'])
    },
    /** #getter */
    get showConnectors(): boolean {
      return getConf(self, ['pileup', 'showConnectors'])
    },
    /** #getter */
    get fadeLowBaseQuality(): boolean {
      return getConf(self, ['pileup', 'fadeLowBaseQuality'])
    },
    /** #getter */
    get fadeLowFrequency(): boolean {
      return getConf(self, ['pileup', 'fadeLowFrequency'])
    },
    /**
     * #getter
     * Whether sashimi arcs draw: `sashimi.show`, and the coverage band they
     * hang off.
     */
    get showSashimi(): boolean {
      return getConf(self, ['sashimi', 'show']) && this.showCoverage
    },
    /** #getter */
    get sashimiHeight(): number {
      return getConf(self, ['sashimi', 'height'])
    },
    /** #getter */
    get sashimiPlacement(): SashimiPlacement {
      return getConf(self, ['sashimi', 'placement'])
    },
    /** #getter */
    get showSashimiCounts(): boolean {
      return getConf(self, ['sashimi', 'showCounts'])
    },
    /** #getter */
    get sashimiFilter(): SashimiFilter {
      return {
        minReads: getConf(self, ['sashimi', 'filter', 'minReads']),
        nonCanonical: getConf(self, ['sashimi', 'filter', 'nonCanonical']),
      }
    },
    /** #getter */
    get showReadConnections(): boolean {
      return getConf(self, ['readConnections', 'show'])
    },
    /** #getter */
    get readConnectionsMark(): ReadConnectionsMark {
      return getConf(self, ['readConnections', 'mark'])
    },
    /**
     * #getter
     * The mark the read-connection band draws, or 'off' while it is hidden.
     */
    get drawnReadConnections(): ReadConnectionsMode {
      return drawnReadConnectionsOf(
        this.showReadConnections,
        this.readConnectionsMark,
      )
    },
    /** #getter */
    get readConnectionsHeight(): number {
      return getConf(self, ['readConnections', 'height'])
    },
    /** #getter */
    get readConnectionsPlacement(): ReadConnectionsPlacement {
      return getConf(self, ['readConnections', 'placement'])
    },
    /** #getter */
    get readConnectionsLineWidth(): number {
      return getConf(self, ['readConnections', 'lineWidth'])
    },
    /**
     * #getter
     * Whether the band draws its ordinary pairs: the arcs' concordant ones
     * (`isConcordantPairRead`, whose failure on a paired primary read is
     * `filter.svSignal`'s discordant clause) and the cloud's modal-insert
     * ones. Unset, arcs keep them and the cloud drops them.
     */
    get showOrdinaryPairs(): boolean {
      return ordinaryPairsShown(
        getConf(self, ['readConnections', 'showOrdinaryPairs']),
        this.readConnectionsMark === 'cloud',
      )
    },
    /**
     * #getter
     * `minInterchromReads` counts within one fragment length on both sides of
     * a breakpoint (`clusteredInterchromSupport`), since a mate-pair
     * breakpoint is not localized to a base.
     */
    get readConnectionsFilter(): ReadConnectionsFilter {
      return {
        interchrom: getConf(self, ['readConnections', 'filter', 'interchrom']),
        offscreenMates: getConf(self, [
          'readConnections',
          'filter',
          'offscreenMates',
        ]),
        minInterchromReads: getConf(self, [
          'readConnections',
          'filter',
          'minInterchromReads',
        ]),
      }
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
     * The field the arcs and the read cloud paint: `readConnections.color`'s
     * own, or the reads' where it names none.
     */
    get readConnectionsColorField(): ArcColorField {
      return arcColorFieldOf(
        getConf(self, ['readConnections', 'color', 'field']),
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
     * The whole-window row order: `sort`'s type, or `position` under a column
     * sort, which lays the reads off its column out by start (a tier-2
     * relayout).
     */
    get layoutOrder(): LayoutOrder {
      return sortOf(self.configuration.sort, refName => refName).layoutOrder
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
  }
}

// One member at a time, so a patch leaves the members it does not name as
// they were; `undefined` clears a category back to unfiltered.
function patchFilter(
  self: ConfigSlotSelf,
  band: 'coverage' | 'sashimi' | 'readConnections',
  patch: object,
) {
  for (const [member, value] of Object.entries(patch)) {
    setConf(self, [band, 'filter', member] as never, value)
  }
}

export function configSlotActions(self: ConfigSlotSelf) {
  return {
    /**
     * #action
     */
    setReadFilter(filterBy: ReadFilter) {
      setConf(self, 'filter', filterBy)
    },

    /**
     * #action
     */
    setShowCoverage(show: boolean) {
      setConf(self, ['coverage', 'show'], show)
    },

    /**
     * #action
     */
    setShowInterbaseIndicators(show: boolean) {
      setConf(self, ['coverage', 'showInterbaseIndicators'], show)
    },

    /**
     * #action
     */
    setCoverageFilter(patch: Partial<CoverageFilter>) {
      patchFilter(self, 'coverage', patch)
    },

    /**
     * #action
     */
    setShowPileup(show: boolean) {
      setConf(self, ['pileup', 'show'], show)
    },

    /**
     * #action
     */
    setShowMismatches(show: boolean) {
      setConf(self, ['pileup', 'showMismatches'], show)
    },

    /**
     * #action
     */
    setShowSoftClipping(value: boolean) {
      setConf(self, ['pileup', 'showSoftClipping'], value)
    },

    /**
     * #action
     * A main-thread tier-2/4 setting, not in `rpcProps`: toggling never
     * refetches.
     */
    setShowConnectors(flag: boolean) {
      setConf(self, ['pileup', 'showConnectors'], flag)
    },

    /**
     * #action
     */
    setFadeLowBaseQuality(value: boolean) {
      setConf(self, ['pileup', 'fadeLowBaseQuality'], value)
    },

    /**
     * #action
     * Writes `sashimi.show` alone. The arcs draw only with the coverage band
     * (`showSashimi`), and the menu greys the row out without it rather than
     * turning the band back on behind the user's back.
     */
    setShowSashimi(show: boolean) {
      setConf(self, ['sashimi', 'show'], show)
    },

    /**
     * #action
     */
    setSashimiPlacement(placement: SashimiPlacement) {
      setConf(self, ['sashimi', 'placement'], placement)
    },

    /**
     * #action
     */
    setShowSashimiCounts(show: boolean) {
      setConf(self, ['sashimi', 'showCounts'], show)
    },

    /**
     * #action
     */
    setSashimiFilter(patch: Partial<SashimiFilter>) {
      patchFilter(self, 'sashimi', patch)
    },

    /**
     * #action
     * What the "Connection overlay" radio writes: 'off' hides the band and
     * keeps its mark for the way back.
     */
    setDrawnReadConnections(mode: ReadConnectionsMode) {
      if (mode === 'off') {
        setConf(self, ['readConnections', 'show'], false)
      } else {
        setConf(self, ['readConnections', 'mark'], mode)
        setConf(self, ['readConnections', 'show'], true)
      }
    },

    /**
     * #action
     */
    setReadConnectionsPlacement(placement: ReadConnectionsPlacement) {
      setConf(self, ['readConnections', 'placement'], placement)
    },

    /**
     * #action
     */
    setReadConnectionsLineWidth(width: number) {
      setConf(self, ['readConnections', 'lineWidth'], width)
    },

    /**
     * #action
     * Paint the connections by `field`, `''` following the reads.
     * `readConnections.color` holds a field and nothing else, so it skips
     * `colorForField`, whose `scale: 'none'` it has no slot for.
     */
    setReadConnectionsColorField(field: ArcColorField | '') {
      setConf(self, ['readConnections', 'color', 'field'], field)
    },

    /**
     * #action
     */
    setShowOrdinaryPairs(show?: boolean) {
      setConf(self, ['readConnections', 'showOrdinaryPairs'], show)
    },

    /**
     * #action
     */
    setReadConnectionsFilter(patch: Partial<ReadConnectionsFilter>) {
      patchFilter(self, 'readConnections', patch)
    },
  }
}
