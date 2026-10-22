import { getConf, readConfObject, setConf } from '@jbrowse/core/configuration'
import { withPreset } from '@jbrowse/core/util/colorScale'
import { filterMembersNarrowing } from '@jbrowse/core/util/jexlFilters'
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
import {
  readFilterMembers,
  readFilterOf,
} from './baseAlignmentsFilterConfigSchema.ts'
import {
  DEFAULT_MIN_SASHIMI_READS,
  drawnReadConnectionsOf,
} from './constants.ts'

import type {
  AlignmentsColorEncoding,
  AlignmentsColorSetting,
} from '../shared/alignmentsColor.ts'
import type {
  ArcColorField,
  BaseLayer,
  ColorSchemeType,
  ConnectionFilter,
  ReadFilter,
  Facet,
  LayoutOrder,
  ModificationColorBy,
  ReadColorBy,
  JunctionFilter,
} from '../shared/types.ts'
import type { BaseLinearAlignmentsDisplayConfigModel } from './baseConfigSchema.ts'
import type { LinearAlignmentsDisplayConfigModel } from './configSchema.ts'
import type {
  AlignmentsUnit,
  ReadConnectionsMark,
  ReadConnectionsMode,
  ReadConnectionsPlacement,
  SashimiPlacement,
} from './constants.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

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
  conf: BaseLinearAlignmentsDisplayConfigModel,
) {
  return [
    ...alignmentsColorProblems({
      ...colorSettingOf(conf.color),
      labels: readConfObject(conf, ['color', 'labels']),
    }),
    ...facetUnitNotices(
      facetSettingOf({
        field: readConfObject(conf, ['facet', 'field']),
        sort: readConfObject(conf, ['facet', 'sort']),
      }),
      readConfObject(conf, 'unit'),
    ),
  ]
}

export interface ConfigSlotSelf extends IStateTreeNode {
  type: string
  configuration: BaseLinearAlignmentsDisplayConfigModel
}

/**
 * The display's configuration when it declares `sashimi`, `filter.junctions`,
 * `baseColor` and `modifications`, which LGVSyntenyDisplay's leaves out.
 * `getConf` reads an undeclared slot as undefined without failing, so every
 * read of the four goes through here, and a display without them answers off.
 */
export function readsConfOf(
  conf: BaseLinearAlignmentsDisplayConfigModel,
): LinearAlignmentsDisplayConfigModel | undefined {
  return 'sashimi' in conf
    ? (conf as LinearAlignmentsDisplayConfigModel)
    : undefined
}

/** `readsConfOf`, for a write or a test: a display without the four throws. */
export function requireReadsConf(self: ConfigSlotSelf) {
  const conf = readsConfOf(self.configuration)
  if (!conf) {
    throw new Error(
      `${self.type} has no sashimi, filter.junctions, baseColor or modifications`,
    )
  }
  return conf
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
      return getConf(self, ['coverage', 'interbase', 'show'])
    },
    /** #getter */
    get coverageMinAlleleFraction(): number {
      return getConf(self, ['coverage', 'minAlleleFraction'])
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
      return getConf(self, ['pileup', 'mismatches', 'show'])
    },
    /** #getter */
    get showSoftClipping(): boolean {
      return getConf(self, ['pileup', 'softClips', 'show'])
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
     * Whether the display declares the sashimi band, which a synteny block,
     * having no introns, has no use for.
     */
    get hasSashimi(): boolean {
      return readsConfOf(self.configuration) !== undefined
    },
    /** #getter */
    get showSashimi(): boolean {
      const conf = readsConfOf(self.configuration)
      return conf ? readConfObject(conf, ['sashimi', 'show']) : false
    },
    /** #getter */
    get sashimiHeight(): number {
      const conf = readsConfOf(self.configuration)
      return conf ? readConfObject(conf, ['sashimi', 'height']) : 0
    },
    /** #getter */
    get sashimiPlacement(): SashimiPlacement {
      const conf = readsConfOf(self.configuration)
      return conf ? readConfObject(conf, ['sashimi', 'placement']) : 'up'
    },
    /**
     * #getter
     * Where the arcs draw: `sashimi.placement` over the coverage band, and
     * `down`, in a separate strip, while the band is hidden.
     */
    get effectiveSashimiPlacement(): SashimiPlacement {
      return this.showCoverage ? this.sashimiPlacement : 'down'
    },
    /** #getter */
    get showSashimiCounts(): boolean {
      const conf = readsConfOf(self.configuration)
      return conf ? readConfObject(conf, ['sashimi', 'labels', 'show']) : false
    },
    /** #getter */
    get junctionFilter(): JunctionFilter {
      const conf = readsConfOf(self.configuration)
      return conf
        ? {
            minReads: readConfObject(conf, ['filter', 'junctions', 'minReads']),
            nonCanonical: readConfObject(conf, [
              'filter',
              'junctions',
              'nonCanonical',
            ]),
          }
        : { minReads: DEFAULT_MIN_SASHIMI_READS }
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
        getConf(self, ['readConnections', 'ordinaryPairs', 'show']),
        this.readConnectionsMark === 'cloud',
      )
    },
    /**
     * #getter
     * `minInterchromReads` counts within one fragment length on both sides of
     * a breakpoint (`clusteredInterchromSupport`), since a mate-pair
     * breakpoint is not localized to a base.
     */
    get connectionFilter(): ConnectionFilter {
      return {
        interchrom: getConf(self, ['filter', 'connections', 'interchrom']),
        offscreenMates: getConf(self, [
          'filter',
          'connections',
          'offscreenMates',
        ]),
        minInterchromReads: getConf(self, [
          'filter',
          'connections',
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
      const conf = readsConfOf(self.configuration)
      return conf ? readConfObject(conf, 'modifications') : {}
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
      const conf = readsConfOf(self.configuration)
      return conf
        ? baseLayerOf(
            {
              field: readConfObject(conf, ['baseColor', 'field']),
              scale: readConfObject(conf, ['baseColor', 'scale']),
            },
            this.modificationSettings,
          )
        : undefined
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
     * #method
     * How `filter` differs from what the track's config declares, its read
     * members and its junction and connection tests together: the "Filter
     * by..." count and what "Clear all filters" writes back.
     */
    filterNarrowing() {
      return filterMembersNarrowing(self, [
        ...readFilterMembers,
        'junctions',
        'connections',
      ])
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
        sort: getConf(self, ['facet', 'sort']),
      })
    },
  }
}

// One member at a time, so a patch leaves the members it does not name as
// they were, the `junctions` and `connections` objects among them; `undefined`
// clears a category back to unfiltered.
function patchFilter(
  conf: BaseLinearAlignmentsDisplayConfigModel,
  path: readonly string[],
  patch: object,
) {
  for (const [member, value] of Object.entries(patch)) {
    setConf(conf, ['filter', ...path, member] as never, value)
  }
}

export function configSlotActions(self: ConfigSlotSelf) {
  return {
    /**
     * #action
     * Writes every read member, one `filterBy` leaves out back to its
     * default, and leaves `filter.junctions` and `filter.connections` as
     * they are. A key that is no read member is refused before any lands.
     */
    setReadFilter(filterBy: Partial<ReadFilter>) {
      const stray = Object.keys(filterBy).filter(
        key => !readFilterMembers.includes(key as keyof ReadFilter),
      )
      if (stray.length > 0) {
        throw new Error(
          `setReadFilter takes ${readFilterMembers.join(', ')}, not ${stray.join(', ')}`,
        )
      }
      patchFilter(
        self.configuration,
        [],
        Object.fromEntries(
          readFilterMembers.map(member => [member, filterBy[member]]),
        ),
      )
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
      setConf(self, ['coverage', 'interbase', 'show'], show)
    },

    /**
     * #action
     */
    setCoverageMinAlleleFraction(fraction: number) {
      setConf(self, ['coverage', 'minAlleleFraction'], fraction)
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
      setConf(self, ['pileup', 'mismatches', 'show'], show)
    },

    /**
     * #action
     */
    setShowSoftClipping(value: boolean) {
      setConf(self, ['pileup', 'softClips', 'show'], value)
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
     * Writes `sashimi.show` alone. Without the coverage band the arcs draw
     * in a separate strip (`effectiveSashimiPlacement`).
     */
    setShowSashimi(show: boolean) {
      setConf(requireReadsConf(self), ['sashimi', 'show'], show)
    },

    /**
     * #action
     */
    setSashimiPlacement(placement: SashimiPlacement) {
      setConf(requireReadsConf(self), ['sashimi', 'placement'], placement)
    },

    /**
     * #action
     */
    setShowSashimiCounts(show: boolean) {
      setConf(requireReadsConf(self), ['sashimi', 'labels', 'show'], show)
    },

    /**
     * #action
     */
    setJunctionFilter(patch: Partial<JunctionFilter>) {
      patchFilter(requireReadsConf(self), ['junctions'], patch)
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
      setConf(self, ['readConnections', 'ordinaryPairs', 'show'], show)
    },

    /**
     * #action
     */
    setConnectionFilter(patch: Partial<ConnectionFilter>) {
      patchFilter(self.configuration, ['connections'], patch)
    },
  }
}
