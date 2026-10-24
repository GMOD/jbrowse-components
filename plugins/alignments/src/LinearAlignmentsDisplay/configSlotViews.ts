import {
  alleleFloorOf,
  coverageLayerProblems,
  interbaseIndicatorRuleOf,
  withAlleleFloor,
} from '@jbrowse/alignments-core/coverageBandConfigSchema'
import { getConf, readConfObject, setConf } from '@jbrowse/core/configuration'
import { withPreset } from '@jbrowse/core/util/colorScale'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { filterFieldNarrowing } from '@jbrowse/core/util/jexlFilters'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'

import {
  strokeWidthScale,
  strokeWidthWithBase,
} from '../features/arcs/arcLineWidth.ts'
import { ordinaryPairsShown } from '../features/arcs/arcTypes.ts'
import { qualityOpacityOf } from '../features/mismatch/qualityOpacity.ts'
import {
  ALIGNMENTS_FIELD_PRESETS,
  alignmentsColorEncoding,
  alignmentsColorSettingOf,
  alignmentsColorProblems,
  baseLayerOf,
  bodyColorKind,
  pinnedInsertSizeBand,
  readColorFieldOf,
} from '../shared/alignmentsColor.ts'
import {
  connectionEntries,
  connectionFilterOf,
  filterProblems,
  junctionEntries,
  junctionFilterOf,
  mergeFilter,
  readPredicatesOf,
  withFields,
} from '../shared/alignmentsFilter.ts'
import { arcColorFieldOf } from '../shared/arcColorOptions.ts'
import {
  basesFilterProblems,
  basesFilterOf,
  DEFAULT_BASES_FILTER,
} from '../shared/basesFilter.ts'
import { facetUnitNotices } from '../shared/groupFeatures.ts'
import { sortOf, sortProblems } from './alignmentsSortConfigSchema.ts'
import {
  READ_CONNECTIONS_MARK_TYPE,
  drawnReadConnectionsOf,
  readConnectionsMarkOf,
} from './constants.ts'

import type { StrokeWidthSetting } from '../features/arcs/arcLineWidth.ts'
import type {
  MismatchOpacityField,
  QualityOpacity,
} from '../features/mismatch/qualityOpacity.ts'
import type {
  AlignmentsColorEncoding,
  AlignmentsColorSetting,
} from '../shared/alignmentsColor.ts'
import type {
  ArcColorField,
  BaseLayer,
  ColorFieldKind,
  ConnectionFilter,
  Facet,
  LayoutOrder,
  BasesFilter,
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
import type { InterbaseIndicatorRule } from '@jbrowse/alignments-core/coverageBandConfigSchema'
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
 * a `facet` the `unit` cannot group by, a column `sort` with no `pos`, and a
 * layer filter test its layer does not make.
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
    ...sortProblems(conf.sort),
    ...filterProblems(writtenFilterOf(conf)).map(line => `filter: ${line}`),
    ...coverageLayerProblems(conf.coverage),
    ...basesFilterProblems(readsConfOf(conf)?.pileup.bases.filter),
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
 * The display's configuration when it declares `sashimi` and `pileup.bases`,
 * which LGVSyntenyDisplay's leaves out, and so draws the
 * splice junctions the `junction` filter fields test.
 * `getConf` reads an undeclared slot as undefined without failing, so every
 * read of them goes through here, and a display without them answers off.
 */
export function readsConfOf(
  conf: BaseLinearAlignmentsDisplayConfigModel,
): LinearAlignmentsDisplayConfigModel | undefined {
  return 'sashimi' in conf
    ? (conf as LinearAlignmentsDisplayConfigModel)
    : undefined
}

/** `readsConfOf`, for a write or a test: a display without them throws. */
export function requireReadsConf(self: ConfigSlotSelf) {
  const conf = readsConfOf(self.configuration)
  if (!conf) {
    throw new Error(
      `${self.type} has no sashimi, junction filter or pileup.bases`,
    )
  }
  return conf
}

function strokeWidthSettingOf(self: ConfigSlotSelf): StrokeWidthSetting {
  const path = ['readConnections', 'encoding', 'strokeWidth'] as const
  return {
    value: getConf(self, [...path, 'value']),
    field: getConf(self, [...path, 'field']),
    scale: {
      type: getConf(self, [...path, 'scale', 'type']),
      range: getConf(self, [...path, 'scale', 'range']),
    },
  }
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
    /**
     * #getter
     * Whether the coverage band colors its allele segments, `coverage.alleles.show`
     */
    get showCoverageAlleles(): boolean {
      return getConf(self, ['coverage', 'alleles', 'show'])
    },
    /** #getter */
    get coverageMinAlleleFraction(): number {
      return alleleFloorOf(self.configuration.coverage.alleles.filter)
    },
    /**
     * #getter
     * `coverage.interbase.filter` as the worker's triangle rule.
     */
    get interbaseIndicatorRule(): InterbaseIndicatorRule {
      return interbaseIndicatorRuleOf(
        self.configuration.coverage.interbase.filter,
      )
    },
    /** #getter */
    get showPileup(): boolean {
      return getConf(self, ['pileup', 'show'])
    },
    /**
     * #getter
     * `pileup.mark.height` as configured, independent of the fit squeeze.
     * Consumers that EDIT the size (the "Custom..." height dialog) must start
     * from it, not the fractional fit pitch `featureHeight` resolves to in fit
     * mode, or opening the dialog while compressed would bake the squeeze.
     */
    get configuredReadHeight(): number {
      return getConf(self, ['pileup', 'mark', 'height'])
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
    /**
     * #getter
     * The field `pileup.mismatches.encoding.opacity` fades by, unset for
     * none: the "Fade low quality mismatches" checkbox.
     */
    get mismatchOpacityField(): MismatchOpacityField | undefined {
      return getConf(self, [
        'pileup',
        'mismatches',
        'encoding',
        'opacity',
        'field',
      ])
    },
    /**
     * #getter
     * `pileup.mismatches.encoding.opacity` as mismatch.slang's
     * `qualityFade` reads it.
     */
    get mismatchQualityOpacity(): QualityOpacity {
      return qualityOpacityOf({
        field: getConf(self, [
          'pileup',
          'mismatches',
          'encoding',
          'opacity',
          'field',
        ]),
        scale: {
          domainMin: getConf(self, [
            'pileup',
            'mismatches',
            'encoding',
            'opacity',
            'scale',
            'domainMin',
          ]),
          domainMax: getConf(self, [
            'pileup',
            'mismatches',
            'encoding',
            'opacity',
            'scale',
            'domainMax',
          ]),
          range: getConf(self, [
            'pileup',
            'mismatches',
            'encoding',
            'opacity',
            'scale',
            'range',
          ]),
          clamp: getConf(self, [
            'pileup',
            'mismatches',
            'encoding',
            'opacity',
            'scale',
            'clamp',
          ]),
        },
      })
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
     * The `filter` entries the display cannot apply, at the level jbrowse-img
     * fails an export on: an entry the reads ignore draws them unfiltered.
     */
    get configProblems() {
      return filterProblems(this.writtenFilter).map(message => ({
        level: 'error' as const,
        slot: 'filter',
        message,
      }))
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
      return strokeWidthScale(strokeWidthSettingOf(self))
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
     * `pileup.bases.filter` over its defaults, which the modifications and
     * bisulfite menus read while another layer draws.
     */
    get basesFilter(): BasesFilter {
      const conf = readsConfOf(self.configuration)
      return conf
        ? basesFilterOf(conf.pileup.bases.filter)
        : DEFAULT_BASES_FILTER
    },
    /**
     * #getter
     * The field the read fill paints by, undefined for the plain fill.
     */
    get colorField(): string | undefined {
      return readColorFieldOf(this.colorEncoding)
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
     * The per-base layer `pileup.bases` draws; undefined while none is.
     */
    get baseLayer(): BaseLayer | undefined {
      const conf = readsConfOf(self.configuration)
      return conf ? baseLayerOf(conf.pileup.bases, this.basesFilter) : undefined
    },
    /**
     * #getter
     * What the read body paints as: `colorField`'s kind, or the modification layer's
     * own pale strand tint while the fill is plain.
     */
    get bodyColorKind(): ColorFieldKind {
      return bodyColorKind(this.colorField, this.baseLayer)
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
     * Turns the coverage band's allele colors on or off, `coverage.alleles.show`
     */
    setShowCoverageAlleles(show: boolean) {
      setConf(self, ['coverage', 'alleles', 'show'], show)
    },

    /**
     * #action
     */
    setCoverageMinAlleleFraction(fraction: number) {
      setConf(
        self,
        ['coverage', 'alleles', 'filter'],
        withAlleleFloor(self.configuration.coverage.alleles.filter, fraction),
      )
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
     * Writes `field` alone, so a written domain and range survive the
     * fade being turned off and on.
     */
    setMismatchOpacityField(field?: MismatchOpacityField) {
      setConf(
        self,
        ['pileup', 'mismatches', 'encoding', 'opacity', 'field'],
        field,
      )
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
     * Stroke a one-read connection `width` px, keeping the written field,
     * scale type and range ratio, or a constant width; undefined returns to
     * the default 1 px.
     */
    setReadConnectionsLineWidth(width?: number) {
      setConf(
        self,
        ['readConnections', 'encoding', 'strokeWidth'],
        width === undefined
          ? {}
          : strokeWidthWithBase(strokeWidthSettingOf(self), width),
      )
    },

    /**
     * #action
     * Paint the connections by `field`; unset follows the reads.
     */
    setReadConnectionsColorField(field?: ArcColorField) {
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
