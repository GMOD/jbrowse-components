import { getConf } from '@jbrowse/core/configuration'
import { IDENTITY_SCALE } from '@jbrowse/core/util/colorScale'
import {
  isExpressionEntry,
  predicatesOf,
} from '@jbrowse/core/util/fieldPredicate'
import { groupKeySpaceOf } from '@jbrowse/core/util/groupKeys'
import { FIT_ROWS } from '@jbrowse/core/util/resolveRowHeight'
import {
  colorSettingOf,
  featureColorEncoding,
} from '@jbrowse/display-kit/colorConfigSchema'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  ROW_GROUP_FIELD,
  compileRowGroups,
  tagRowGroups,
} from '@jbrowse/tree-sidebar/rowGroups'

import { paintedColorNode } from './inheritedColor.ts'
import { markColorsOf } from './markColor.ts'
import { buildMarkList, markDrawsAt } from './markList.ts'
import {
  lastBinEdges,
  layerRequestsOf,
  markChannelsOf,
  markEntryOf,
  markStepListsOf,
  stepsOf,
  withRootLane,
} from './markRequest.ts'
import { markSizePx, pxChannelOf } from './markSpecs.ts'
import { DEFAULT_POINT_DIAMETER_PX } from './markVocabulary.ts'

import type {
  LinearMarkDisplayConfig,
  MarkConfig,
  MarkTransformStepConfig,
  MarkType,
} from './configSchema.ts'
import type { ColorSource, HiddenCategory } from './markColor.ts'
import type { MarkEntry, TextMarkEntry } from './markList.ts'
import type { StepChannels } from './stepChannels.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  FacetSpec,
  LayerRequest,
  MarkEncoding,
  TransformStep,
} from '@jbrowse/core/util/markEncoding'
import type { RowStep } from '@jbrowse/core/util/resolveRowHeight'
import type { FacetSetting } from '@jbrowse/display-kit/facetConfigSchema'
import type { RowBanding, RowSource } from '@jbrowse/tree-sidebar'
import type { RowGroup } from '@jbrowse/tree-sidebar/rowGroups'

/**
 * The row attributes a config gives its rows: `group` where `rows.groups`
 * declares any.
 */
export function rowAttributesOf(
  conf: AnyConfigurationModel,
): readonly string[] {
  const { rows } = getSnapshot<{ rows?: { groups?: unknown[] } }>(conf)
  return rows?.groups?.length ? [ROW_GROUP_FIELD] : []
}

// A mark's px, its `encoding.size` or `encoding.strokeWidth` number by its
// type, or its type's default where none is written.
function markSizeOf({ mark, encoding }: Pick<MarkConfig, 'mark' | 'encoding'>) {
  const px = pxChannelOf(mark.type)
  return markSizePx(mark.type, px && encoding[px].value)
}

/**
 * A span with a height: one at band 0 draws a line, as a spliced feature's
 * does under its blocks, and Row height leaves it a line.
 */
export function isSizedRect({ mark }: Pick<MarkConfig, 'mark'>) {
  return mark.type === 'rect' && mark.height.band > 0
}

/** The marks at the view's zoom: which draw. */
export interface MarkView {
  visible: boolean[]
}

/** What every mark views function reads first: the display's config. */
export interface MarkConfHost {
  configuration: LinearMarkDisplayConfig
}

/** What a mark host reads off its view: the zoom. */
export interface MarkZoomHost {
  host: { bpPerPx: number }
}

/** The mark display's reads of its config alone. */
export function markConfigViews(self: MarkConfHost) {
  return {
    /**
     * #getter
     * The declared marks' types, in draw order.
     */
    get markTypes(): MarkType[] {
      return self.configuration.marks.map(m => m.mark.type)
    },
    /**
     * #getter
     * The `facet` object as written, or undefined while unfaceted.
     */
    get declaredFacet(): FacetSetting | undefined {
      return facetSettingOf({
        field: getConf(self, ['facet', 'field']),
        sort: getConf(self, ['facet', 'sort']),
      })
    },
    /**
     * #getter
     * The `rows.groups` entries, each slot filled in.
     */
    get rowGroups(): RowGroup[] {
      return getSnapshot<Partial<RowGroup>[]>(
        self.configuration.rows.groups,
      ).map(({ match = '', group = '' }) => ({ match, group }))
    },
    /**
     * #getter
     * The fields a row carries beside its name, which a facet bands the
     * rows by: `group` where `rows.groups` declares groups. Config alone, so
     * whether a facet bands or splits is known before a feature loads.
     */
    get rowAttributeFields(): readonly string[] {
      return rowAttributesOf(self.configuration)
    },
    /**
     * #getter
     * Each mark's px, a point's `encoding.size` or a stroked mark's
     * `encoding.strokeWidth` number, its type's default where none is
     * written, and 0 for a bar, span or text, which draw none.
     */
    get markSizes(): number[] {
      return self.configuration.marks.map(markSizeOf)
    },
    /**
     * #getter
     * Each mark's `mark.height.band`, which a span alone reads.
     */
    get markRowProportions(): number[] {
      return self.configuration.marks.map(m => m.mark.height.band)
    },
    /**
     * #getter
     * The proportion the Row height dialog shows: the first sized span's,
     * or undefined where no span has a height, so the dialog asks for none.
     */
    get rowProportion(): number | undefined {
      return self.configuration.marks.find(isSizedRect)?.mark.height.band
    },
    /**
     * #getter
     * Whether any mark is a link, whose feet place through the view's
     * regions rather than the block's own range.
     */
    get hasLinkMark(): boolean {
      return self.configuration.marks.some(m => m.mark.type === 'link')
    },
    /**
     * #getter
     * The size the Point size menu shows: the first point mark's, or the
     * default where no mark is a point.
     */
    get pointSize(): number {
      const first = self.configuration.marks.find(m => m.mark.type === 'point')
      return first ? markSizeOf(first) : DEFAULT_POINT_DIAMETER_PX
    },
    /**
     * #getter
     * The steps every mark runs before its own `transform`: the
     * display's, then the facet's.
     */
    get sharedSteps(): MarkTransformStepConfig[] {
      return [
        ...self.configuration.transform,
        ...self.configuration.facet.transform,
      ]
    },
    /**
     * #getter
     */
    get origin(): number {
      return getConf(self, 'origin')
    },
    /**
     * #getter
     * The `filter` list as the worker's steps: each expression its own
     * step, and the field tests one step of predicates.
     */
    get filterSteps(): TransformStep[] {
      const entries = predicatesOf(self.configuration.filter)
      const predicates = entries.filter(p => !isExpressionEntry(p))
      return [
        ...entries
          .filter(isExpressionEntry)
          .map(p => ({ type: 'filter' as const, expr: p.field })),
        ...(predicates.length > 0
          ? [{ type: 'filter' as const, predicates }]
          : []),
      ]
    },
    /**
     * #getter
     * `rows.field` as written: the field each value of which takes a row.
     */
    get rowsField(): string {
      return getConf(self, ['rows', 'field'])
    },
    /**
     * #getter
     * Whether a line runs between rows, `rows.axis.grid`.
     */
    get showRowSeparators(): boolean {
      return getConf(self, ['rows', 'axis', 'grid'])
    },
  }
}

type MarkConfigHost = MarkConfHost & ReturnType<typeof markConfigViews>

/** Whether the facet bands the rows, and each mark's steps and channels. */
export function markChannelViews(self: MarkConfigHost) {
  return {
    /**
     * #getter
     * Whether the facet stacks the rows in bands: `rows` drawn and the
     * facet on a row attribute.
     */
    get bandsRows(): boolean {
      const facet = self.declaredFacet
      return (
        !!facet &&
        self.rowsField !== '' &&
        self.rowAttributeFields.includes(facet.field)
      )
    },
    /**
     * #getter
     * The steps that run before each mark's encode, in order: the
     * display's, the facet's, then the mark's own.
     */
    get markStepLists(): MarkTransformStepConfig[][] {
      return markStepListsOf(self.configuration.marks, self.sharedSteps)
    },
    /**
     * #getter
     * The channels each mark's steps fill where its encoding leaves them
     * unwritten.
     */
    get markChannels(): StepChannels[] {
      return markChannelsOf(self.configuration.marks, self.sharedSteps)
    },
  }
}

/** What {@link markFacetViews} reads beside the config. */
export type MarkChannelHost = MarkConfigHost &
  ReturnType<typeof markChannelViews> &
  MarkZoomHost & {
    hiddenCategories: readonly HiddenCategory[] | undefined
  }

/**
 * The facet the worker splits by, each mark's entry and color, and the
 * worker's layer requests.
 */
export function markFacetViews(self: MarkChannelHost) {
  return {
    /**
     * #getter
     * The facet the worker splits the features into sections by:
     * `declaredFacet`, unless it bands the rows, which are split by
     * `rows` alone and banded here.
     */
    get facet(): FacetSetting | undefined {
      return self.bandsRows ? undefined : self.declaredFacet
    },
    /**
     * #getter
     * Each mark's type and zoom range, what the mark list is built from.
     */
    get markEntries(): MarkEntry[] {
      const { markChannels } = self
      return self.configuration.marks.map((m, i) =>
        markEntryOf(m, markChannels[i]!),
      )
    },
    /**
     * #getter
     * Where each mark's color comes from (`markColor.ts`), read from the
     * config alone, so editing a color recolors the loaded regions
     * rather than fetching them again.
     */
    get markColors(): ColorSource[] {
      return markColorsOf(
        self.configuration.marks,
        self.markChannels,
        self,
        self.hiddenCategories,
        self.configuration.encoding.color,
      )
    },
    /**
     * #getter
     * The facet's own steps as the worker takes them, run over each section
     * before any mark's; with no field to split on they run over the one
     * section there is, after the display's own steps.
     */
    get facetSteps(): TransformStep[] {
      return stepsOf(
        self.configuration.facet.transform,
        self.host.bpPerPx,
        lastBinEdges(self.configuration.transform),
      )
    },
    /**
     * #getter
     * The worker request, one layer per mark: its encoding and the lanes
     * its type reads. Every mark is sent, the one outside its zoom range
     * included, so the worker encodes a layer the view will not draw:
     * measured at 280 ns a feature, 28 ms per 100,000, for the excluded
     * half of the default multiscale pair (`encodeFeatures.bench.ts`, the
     * pair table), against a parse in the hundreds of milliseconds. An
     * empty slot for it would make the zoom a fetch input and refetch the
     * pair on every crossing, so there is none (ADR-112). Its `auto` bin
     * resolves at the bound it next draws at, so a zoom outside its range
     * refetches nothing.
     */
    get layerRequests(): LayerRequest[] {
      return layerRequestsOf(
        self.configuration.marks,
        self.markChannels,
        self.host.bpPerPx,
        self.sharedSteps,
        self.configuration.encoding.color,
      )
    },
  }
}

type MarkFacetHost = MarkChannelHost & ReturnType<typeof markFacetViews>

/**
 * What the facet and the mark entries decide: the hidden sections' key
 * space, the text layer's entries, which marks draw at this zoom, and
 * whether the display draws rows.
 */
export function markEntryViews(self: MarkFacetHost) {
  return {
    /**
     * #getter
     * `HiddenGroupsMixin`'s hook: a section key means nothing outside the
     * facet that issued it, so moving the field drops what was hidden.
     */
    get groupKeySpace(): string {
      return groupKeySpaceOf(self.facet)
    },
    /**
     * #getter
     * Each mark as the text layer places it: the entry with whether it
     * names a `y` and whether its color is written, a constant or a
     * scale. Its own getter so a slot only a label reads never remakes
     * the mark list.
     */
    get textMarkEntries(): TextMarkEntry[] {
      const { marks, encoding } = self.configuration
      return self.markEntries.map((entry, i) => {
        const color = colorSettingOf(
          paintedColorNode(marks[i]!, encoding.color),
        )
        return {
          ...entry,
          ownColor:
            featureColorEncoding(color) !== undefined ||
            color.scale.type === IDENTITY_SCALE,
        }
      })
    },
    /**
     * #getter
     * The marks at the view's zoom: whether each draws, inside its
     * `minBpPerPx`..`maxBpPerPx` range where 0 is no bound.
     */
    get markView(): MarkView {
      const { bpPerPx } = self.host
      return {
        visible: self.markEntries.map(entry => markDrawsAt(entry, bpPerPx)),
      }
    },
    /**
     * #getter
     * The declared marks' encodings, as the worker takes them.
     */
    get encodings(): MarkEncoding[] {
      return self.layerRequests.map(request => request.encoding)
    },
    /**
     * #getter
     * The mark list the marks declare — one `defineMark` per config entry
     * with a shape, reading `layers[markIndex]`, off outside its zoom range.
     * A text mark has no shape and is the text layer's, so the list is
     * shorter than `marks` where one is declared. Recomputed only when the
     * entries move, so the component can key its backend factory on it.
     */
    get markList() {
      return buildMarkList(self.markEntries)
    },
    /**
     * #getter
     * Whether the display draws one row per value: a `rows` field and no
     * `facet` splitting the features, which draws in the rows' place.
     */
    get drawsRows(): boolean {
      return self.rowsField !== '' && !self.facet
    },
    /**
     * #getter
     * The `rows.groups` entries whose `match` compiles.
     */
    get rowGroupMatchers() {
      return compileRowGroups(self.rowGroups)
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: the facet's bands where it bands the
     * rows, its `sort` first and then the `rows.groups` groups in the order
     * they are declared.
     */
    get rowBanding(): RowBanding | undefined {
      const facet = self.declaredFacet
      return self.bandsRows && facet
        ? {
            field: facet.field,
            sort: [...facet.sort, ...self.rowGroups.map(g => g.group)],
          }
        : undefined
    },
  }
}

/** What {@link markRowsViews} reads beside the entries. */
export type MarkEntryHost = MarkFacetHost &
  ReturnType<typeof markEntryViews> & { rowStep: RowStep }

/**
 * The row step drawn, the field the worker splits on, the rows tagged with
 * their groups, the marks drawing at this zoom and the worker's request.
 */
export function markRowsViews(self: MarkEntryHost) {
  return {
    /**
     * #getter
     * The `rows.step` the drawn rows take: `rows.step` while the display
     * draws rows, else fit, since a facet's bands have no scroll to reach
     * past the plot's foot.
     */
    get drawnRowStep(): RowStep {
      return self.drawsRows ? self.rowStep : FIT_ROWS
    },
    /**
     * #getter
     * The field the worker splits the features on: the facet's, else the
     * rows'. One split serves both, so `rows` sends it as `facet`.
     */
    get splitField(): string | undefined {
      return self.facet?.field ?? (self.drawsRows ? self.rowsField : undefined)
    },
    /**
     * #method
     * `TreeSidebarMixin`'s hook: each row tagged with the group of the
     * first `rows.groups` entry its name matches.
     */
    expandRows(rows: RowSource[]): RowSource[] {
      return tagRowGroups(rows, self.rowGroupMatchers)
    },
    /**
     * #getter
     * Every mark drawing at this zoom, in list order: what folds into the y
     * domain and what the plot's inset and row count are read from.
     */
    get drawingMarkIndices(): number[] {
      const { visible } = self.markView
      return self.markTypes.flatMap((_, i) => (visible[i] ? [i] : []))
    },
  }
}

/** What {@link markRequestViews} reads. */
export type MarkRowsHost = MarkEntryHost & ReturnType<typeof markRowsViews>

/** The plot as the worker reads it. */
export function markRequestViews(self: MarkRowsHost) {
  return {
    /**
     * #method
     * The plot as the worker reads it: each mark's encoding and lanes, and
     * the filters as transform steps. Every field and expression the plot
     * names is in it, and `adapterOptions` is not, so a display may
     * derive its options from what the plot reads.
     */
    plotRequest(): {
      layers: LayerRequest[]
      transform: TransformStep[]
      facet?: FacetSpec
    } {
      const field = self.splitField
      return withRootLane({
        layers: self.layerRequests,
        transform: [
          ...self.filterSteps,
          ...stepsOf(self.configuration.transform, self.host.bpPerPx),
          ...(self.facet ? [] : self.facetSteps),
        ],
        ...(field === undefined
          ? {}
          : {
              facet: {
                field,
                ...(self.facet && self.facetSteps.length > 0
                  ? { transform: self.facetSteps }
                  : {}),
              },
            }),
      })
    },
  }
}
