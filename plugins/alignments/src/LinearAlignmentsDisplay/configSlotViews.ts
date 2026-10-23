import { getConf, readConfObject, setConf } from '@jbrowse/core/configuration'
import { withPreset } from '@jbrowse/core/util/colorScale'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { filterFieldNarrowing } from '@jbrowse/core/util/jexlFilters'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'

import {
  arcStrokeScale,
  strokeWidthScale,
} from '../features/arcs/arcLineWidth.ts'
import { ordinaryPairsShown } from '../features/arcs/arcTypes.ts'
import {
  ALIGNMENTS_FIELD_PRESETS,
  alignmentsColorEncoding,
  alignmentsColorSettingOf,
  alignmentsColorProblems,
  baseLayerOf,
  bodyColorScheme,
  pinnedInsertSizeBand,
  readColorByOf,
  readColorFieldOf,
} from '../shared/alignmentsColor.ts'
import {
  connectionEntries,
  connectionFilterOf,
  filterPatchOfObject,
  filterProblems,
  junctionEntries,
  junctionFilterOf,
  mergeFilter,
  readPredicatesOf,
  strayFilterMembers,
  withFields,
} from '../shared/alignmentsFilter.ts'
import { arcColorFieldOf } from '../shared/arcColorOptions.ts'
import { facetUnitNotices } from '../shared/groupFeatures.ts'
import { sortOf } from './alignmentsSortConfigSchema.ts'
import {
  READ_CONNECTIONS_MARK_TYPE,
  drawnReadConnectionsOf,
  readConnectionsMarkOf,
} from './constants.ts'

import type {
  AlignmentsColorEncoding,
  AlignmentsColorSetting,
} from '../shared/alignmentsColor.ts'
import type { FilterObject } from '../shared/alignmentsFilter.ts'
import type {
  ArcColorField,
  BaseLayer,
  ColorSchemeType,
  ConnectionFilter,
  Facet,
  LayoutOrder,
  ModificationColorBy,
  ReadColorBy,
  JunctionFilter,
  JunctionFilterPatch,
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
import type { Reversible } from '@jbrowse/core/ui/filterMenuItems'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinkSizeScale } from '@jbrowse/render-core/marks'

/** The `filter` list as written, before the defaults merge in. */
export function writtenFilterOf(
  conf: BaseLinearAlignmentsDisplayConfigModel,
): FieldPredicate[] {
  return predicatesOf(conf.filter)
}

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
 * between this file and model.ts, and it is why `collapseSections`, which reads
 * `canCollapseSections`, stayed behind despite also being a slot read.
 */
/**
 * What a config says beside the schema's rules that the reads cannot draw as
 * written: a per-base `encoding.color.field`, levels a field does not have,
 * and a `facet` the `unit` cannot group by.
 */
export function alignmentsConfigProblems(
  conf: BaseLinearAlignmentsDisplayConfigModel,
) {
  return [
    ...alignmentsColorProblems(alignmentsColorSettingOf(conf.encoding.color)),
    ...facetUnitNotices(
      facetSettingOf({
        field: readConfObject(conf, ['facet', 'field']),
        sort: readConfObject(conf, ['facet', 'sort']),
      }),
      readConfObject(conf, 'unit'),
    ),
    ...filterProblems(writtenFilterOf(conf)),
    ...(readsConfOf(conf)
      ? []
      : writtenFilterOf(conf)
          .filter(p => p.field.startsWith('junction.'))
          .map(
            p =>
              `filter: ${p.field} tests splice junctions, which this display does not draw`,
          )),
  ]
}

export interface ConfigSlotSelf extends IStateTreeNode {
  type: string
  configuration: BaseLinearAlignmentsDisplayConfigModel
}

/**
 * The display's configuration when it declares `sashimi`, `pileup.bases` and
 * `modifications`, which LGVSyntenyDisplay's leaves out, and so draws the
 * splice junctions the `junction` filter fields test.
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
      `${self.type} has no sashimi, junction filter, pileup.bases or modifications`,
    )
  }
  return conf
}

export function configSlotViews(self: ConfigSlotSelf) {
  const insertSizeBand = stableIdentityComputed(() =>
    pinnedInsertSizeBand(
      alignmentsColorEncoding(
        alignmentsColorSettingOf(self.configuration.encoding.color),
      ),
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
      return getConf(self, ['pileup', 'connectors', 'show'])
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
    /**
     * #getter
     * The `filter` list as written, before the defaults merge in: what a
     * session spec reopens the display with.
     */
    get writtenFilter(): FieldPredicate[] {
      return writtenFilterOf(self.configuration)
    },
    /**
     * #getter
     * The `filter` list the display applies: what is written, merged over
     * the defaults by field.
     */
    get filterPredicates(): FieldPredicate[] {
      return mergeFilter(this.writtenFilter)
    },
    /**
     * #getter
     * The splice junctions drawn, off the `junction` fields.
     */
    get junctionFilter(): JunctionFilter {
      return junctionFilterOf(this.filterPredicates)
    },
    /** #getter */
    get showReadConnections(): boolean {
      return getConf(self, ['readConnections', 'show'])
    },
    /** #getter */
    get readConnectionsMark(): ReadConnectionsMark {
      return readConnectionsMarkOf(
        getConf(self, ['readConnections', 'mark', 'type']),
      )
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
    /**
     * #getter
     * The link mark's size scale `readConnections.encoding.strokeWidth`
     * draws.
     */
    get readConnectionsStrokeScale(): LinkSizeScale {
      return strokeWidthScale({
        value: getConf(self, [
          'readConnections',
          'encoding',
          'strokeWidth',
          'value',
        ]),
        field: getConf(self, [
          'readConnections',
          'encoding',
          'strokeWidth',
          'field',
        ]),
        scale: {
          type: getConf(self, [
            'readConnections',
            'encoding',
            'strokeWidth',
            'scale',
            'type',
          ]),
          range: getConf(self, [
            'readConnections',
            'encoding',
            'strokeWidth',
            'scale',
            'range',
          ]),
        },
      })
    },
    /**
     * #getter
     * The width a one-read connection strokes at, which the Line width menu
     * shows.
     */
    get readConnectionsLineWidth(): number {
      return this.readConnectionsStrokeScale.range[0]
    },
    /**
     * #getter
     * Whether the band draws its ordinary pairs: the arcs' concordant ones
     * (`isConcordantPairRead`, whose failure on a paired primary read is
     * the `svSignal` filter field's discordant clause) and the cloud's modal-insert
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
     * The connections drawn, off the `connection` and `breakpoint` fields.
     * `breakpoint.reads` counts within one fragment length on both sides of
     * a breakpoint (`clusteredInterchromSupport`), since a mate-pair
     * breakpoint is not localized to a base.
     */
    get connectionFilter(): ConnectionFilter {
      return connectionFilterOf(this.filterPredicates)
    },

    /**
     * #getter
     */
    get colorSetting(): AlignmentsColorSetting {
      return alignmentsColorSettingOf(self.configuration.encoding.color)
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
     * `encoding.color.scale.names` as written, read apart from
     * `colorSetting`, which every color tier keys on, so renaming a key entry
     * re-bakes no read.
     */
    get colorLabels(): readonly string[] {
      return getConf(self, ['encoding', 'color', 'scale', 'names'])
    },
    /**
     * #getter
     * `encoding.color.legend.title` as written: unset keeps the key's own
     * heading, `''` draws none.
     */
    get colorTitle(): string | undefined {
      return getConf(self, ['encoding', 'color', 'legend', 'title'])
    },
    /**
     * #getter
     * The key's heading: `encoding.color.legend.title` as written, else its
     * field preset's while the color paints through the preset, so
     * `encoding.color: "mapq"` keys as "Mapping quality". Unset keeps the
     * key's own heading.
     */
    get colorKeyTitle(): string | undefined {
      return withPreset(
        { ...this.colorSetting, legend: { title: this.colorTitle } },
        ALIGNMENTS_FIELD_PRESETS,
      ).legend.title
    },
    /**
     * #getter
     * `encoding.color.legend.descending` as written, else its field preset's
     * while the color paints through the preset, so `encoding.color: "mapq"`
     * keys 30+ first. Read apart from `colorSetting`, so turning the key
     * round re-bakes no read.
     */
    get colorKeyDescending(): boolean | undefined {
      return withPreset(
        {
          ...this.colorSetting,
          legend: {
            descending: getConf(self, [
              'encoding',
              'color',
              'legend',
              'descending',
            ]),
          },
        },
        ALIGNMENTS_FIELD_PRESETS,
      ).legend.descending
    },
    /**
     * #getter
     * The short/long cut points `encoding.color.scale.domain` pins under an insert-size
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
     * The field the read fill paints by, `''` for the plain fill.
     */
    get colorField(): string {
      return readColorFieldOf(this.colorEncoding)
    },
    /**
     * #getter
     * @deprecated read `colorField`, the field itself.
     */
    get colorBy(): ReadColorBy {
      return readColorByOf(this.colorField)
    },
    /**
     * #getter
     * The field the arcs, the read cloud and the pileup connectors paint:
     * `readConnections.encoding.color`'s own, or the reads' where it names
     * none.
     */
    get readConnectionsColorField(): ArcColorField {
      return arcColorFieldOf(
        getConf(self, ['readConnections', 'encoding', 'color', 'field']),
        this.colorField,
      )
    },
    /**
     * #getter
     * The per-base layer `pileup.bases` draws, with the settings the
     * modification fields read beside it; undefined while none is drawn.
     */
    get baseLayer(): BaseLayer | undefined {
      const conf = readsConfOf(self.configuration)
      return conf
        ? baseLayerOf(
            {
              show: readConfObject(conf, ['pileup', 'bases', 'show']),
              field: readConfObject(conf, [
                'pileup',
                'bases',
                'encoding',
                'color',
                'field',
              ]),
            },
            this.modificationSettings,
          )
        : undefined
    },
    /**
     * #getter
     * What the read body paints as: `colorField`'s scheme, or the modification layer's
     * own pale strand tint while the fill is plain.
     */
    get bodyColorScheme(): ColorSchemeType {
      return bodyColorScheme(this.colorField, this.baseLayer)
    },
    /**
     * #getter
     * The read fields of `filterPredicates`, which the worker applies.
     */
    get readPredicates(): FieldPredicate[] {
      return readPredicatesOf(this.filterPredicates)
    },
    /**
     * #method
     * How `filter` differs from what the track's config declares, as a count
     * of the fields that moved: the "Filter by..." count, and what "Clear all
     * filters" writes back.
     */
    filterNarrowing(): Reversible {
      return filterFieldNarrowing(self, () => true)
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

export function configSlotActions(self: ConfigSlotSelf) {
  function setFilterFields(
    patch: Readonly<Record<string, readonly FieldPredicate[] | undefined>>,
  ) {
    setConf(
      self.configuration,
      'filter',
      withFields(writtenFilterOf(self.configuration), patch),
    )
  }
  return {
    /**
     * #action
     * Replaces the entries on each field the patch names, `undefined`
     * returning a field to its defaults; every other field keeps what was
     * written.
     */
    setFilterFields,

    /**
     * #action
     * An object-form filter, a launch modifier's or a JSON settings bag's,
     * written onto this display's list by field as the track menu writes
     * (`filterPatchOfObject`).
     */
    applyFilterObject(object: FilterObject) {
      const stray = strayFilterMembers(object as Record<string, unknown>)
      if (stray.length > 0) {
        throw new Error(`filter has no ${stray.join(', ')}`)
      }
      setFilterFields(
        filterPatchOfObject(
          object,
          mergeFilter(writtenFilterOf(self.configuration)),
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
      setConf(self, ['pileup', 'connectors', 'show'], flag)
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
    setJunctionFilter(patch: JunctionFilterPatch) {
      requireReadsConf(self)
      setFilterFields(junctionEntries(patch))
    },

    /**
     * #action
     * What the "Read arcs" and "Read cloud" checkboxes write: 'off' hides the
     * band and keeps its mark for the way back.
     */
    setDrawnReadConnections(mode: ReadConnectionsMode) {
      if (mode === 'off') {
        setConf(self, ['readConnections', 'show'], false)
      } else {
        setConf(
          self,
          ['readConnections', 'mark', 'type'],
          READ_CONNECTIONS_MARK_TYPE[mode],
        )
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
     * Stroke a one-read connection `width` px, widening with its reads as the
     * default curve does; undefined returns to the default 1 px.
     */
    setReadConnectionsLineWidth(width?: number) {
      setConf(
        self,
        ['readConnections', 'encoding', 'strokeWidth'],
        width === undefined
          ? {}
          : { scale: { range: arcStrokeScale(width).range.map(String) } },
      )
    },

    /**
     * #action
     * Paint the connections by `field`, `''` following the reads.
     */
    setReadConnectionsColorField(field: ArcColorField | '') {
      setConf(self, ['readConnections', 'encoding', 'color', 'field'], field)
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
      setFilterFields(connectionEntries(patch))
    },
  }
}
