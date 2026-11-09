import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { rampDomain } from '@jbrowse/core/util/colorRamp'
import { FIT_ROWS, resolveRowHeight } from '@jbrowse/core/util/resolveRowHeight'
import { keyWindowsOf } from '@jbrowse/display-kit/keyWindows'
import {
  sameAsLast,
  stableIdentityComputed,
} from '@jbrowse/display-kit/stableIdentityComputed'
import { viewRegionTable } from '@jbrowse/display-kit/viewRegionTable'
import {
  YSCALEBAR_LABEL_OFFSET,
  leftAxisGutterWidth,
} from '@jbrowse/display-ui'
import { createEncodeMemo } from '@jbrowse/render-core/encodeMemo'
import { RowKeys, pointInsetPx } from '@jbrowse/render-core/marks'
import { sidebarPanelWidth } from '@jbrowse/tree-sidebar'
import {
  autoscaleDomainFromSpans,
  axisPlotBox,
  computeSpanStats,
  resolveRenderState,
  resolveSymlogConstant,
  visibleStats,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'

import {
  facetLayout,
  rowsLayout,
  sectionsInWindow,
  sectionsOn,
  unsplitRegion,
} from './facet.ts'
import { saysColor } from './inheritedColor.ts'
import { regionsKeyOnScreen } from './keyOnScreen.ts'
import {
  buildMarkLegend,
  colorSection,
  keySettingOf,
  markColorScales,
  paintScaleOf,
} from './legend.ts'
import { createLinkOwners, withMateRegions } from './linkOwners.ts'
import { baselineReached, layerSpans } from './markAutoscale.ts'
import { withMarkColors } from './markColor.ts'
import { MIN_MARK_WIDTH_PX, highestRow, markRowHeightPx } from './markList.ts'
import { withRowColors } from './rowColors.ts'
import {
  drawnKeysOf,
  drawnRegion,
  facetRowName,
  facetRowTable,
  keyRegion,
  listingNamesRows,
  markRowTable,
  sectionRowName,
} from './rowTable.ts'

import type { FacetLayout } from './facet.ts'
import type { MarkLegendSection } from './legend.ts'
import type { MateRegion } from './linkOwners.ts'
import type { RegionLayer } from './markAutoscale.ts'
import type { ColorSource } from './markColor.ts'
import type { MarkRowsHost } from './markConfigViews.ts'
import type { MarkRegionData, MarkRenderState } from './markList.ts'
import type { RowColors } from './rowColors.ts'
import type { RowKeySpace } from './rowTable.ts'
import type {
  ListedRowSource,
  RowSourceListing,
} from '@jbrowse/core/data_adapters/BaseAdapter/rowSources'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { SizeScaleTable } from '@jbrowse/core/util/markEncoding'
import type { RegionHost } from '@jbrowse/display-kit/regionHost'
import type {
  LinkRegion,
  LinkSizeScale,
  MarkColorScale,
  RowTable,
} from '@jbrowse/render-core/marks'
import type { RowSource, SvgSidebarProps } from '@jbrowse/tree-sidebar'
import type {
  ScaleType,
  ValueScale,
  ValueScaleRule,
  YAxis,
} from '@jbrowse/wiggle-core'

const NO_REGIONS: ReadonlyMap<number, MarkRegionData> = new Map()
const NO_LINK_REGIONS: readonly LinkRegion[] = []

/**
 * What a mark host reads off the view it is drawn in: a linear genome view,
 * or a static frame built from a region list and a width.
 */
export type MarkViewFrame = Pick<
  RegionHost,
  | 'initialized'
  | 'bpPerPx'
  | 'offsetPx'
  | 'displayedRegions'
  | 'settledDynamicBlocks'
  | 'displayedRegionOffsetsPx'
>

/** What {@link markRowListingViews} reads beside the request. */
export type MarkListingHost = MarkRowsHost & {
  adapterListing: RowSourceListing | undefined
}

/** Whether the adapter's row listing names the rows drawn. */
export function markRowListingViews(self: MarkListingHost) {
  return {
    /**
     * #getter
     * The adapter's row listing where it names the rows drawn: its field
     * is `rows.field`, or the key a `flatten` in the shared steps wrote
     * over its field. Undefined for an adapter that lists no rows, for one
     * that lists another field, and until the listing for the current
     * adapter config arrives.
     */
    get rowListing(): RowSourceListing | undefined {
      const listing = self.adapterListing
      return listing &&
        listingNamesRows(self.rowsField, listing.field, self.sharedSteps)
        ? listing
        : undefined
    },
  }
}

/** The sources and the guide tree the adapter's row listing names. */
export function markListedSourceViews(self: {
  rowListing: RowSourceListing | undefined
}) {
  return {
    /**
     * #getter
     * The sources the adapter lists whatever a region holds, a
     * multi-BigWig's files or a MAF's species, in the adapter's order.
     */
    get adapterSources(): ListedRowSource[] | undefined {
      return self.rowListing?.sources
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: the guide tree the adapter lists over
     * the rows, a MAF's species tree.
     */
    get guideTreeNewick(): string | undefined {
      return self.rowListing?.tree
    },
  }
}

/**
 * What the regions are resolved from: the fetched layers, the rows the
 * adapter lists, the view's frame and what the rows views say.
 */
export type MarkRegionsHost = MarkRowsHost & {
  host: MarkViewFrame
  featurePayloads: ReadonlyMap<number, MarkRegionData>
  adapterSources: ListedRowSource[] | undefined
  trackVisibleRegions: readonly {
    displayedRegionIndex: number
    start: number
    end: number
  }[]
}

/** The rows the loaded regions name. */
export function markDiscoveredRowViews(self: MarkRegionsHost) {
  // Identity-stable, since the layout below keys the upload on it and a
  // region arriving with the same values discovers nothing new.
  const discoveredRows = stableIdentityComputed(() => {
    if (!self.drawsRows) {
      return []
    }
    const field = categoricalField(self.rowsField)
    const listed = new Map(
      self.adapterSources?.map(source => [source.name, source]),
    )
    const found = new Set<string>()
    const shown = self.trackVisibleRegions
    for (const [index, region] of self.featurePayloads) {
      const spans = shown.filter(b => b.displayedRegionIndex === index)
      const sections =
        shown.length === 0
          ? (sectionsOn(region, self.rowsField) ?? [])
          : sectionsInWindow(region, self.rowsField, spans)
      for (const { key } of sections) {
        if (!listed.has(key)) {
          found.add(key)
        }
      }
    }
    return [...listed.keys(), ...[...found].sort(field.compare)].map(
      (name): RowSource => {
        const own = listed.get(name)
        const label = own?.label ?? field.label(name)
        return {
          name,
          ...(label === name ? {} : { label }),
          ...(own?.color ? { color: own.color } : {}),
        }
      },
    )
  })
  return {
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: every row the adapter lists over the
     * rows' field, in its order and with its label and color, so a
     * source with nothing in the loaded regions keeps its row; then the
     * other values the worker split the loaded regions on that have an
     * instance on screen, in the order the field's sections stack. The
     * fetch reaches past the screen on each side, and a row it met only
     * there would stand empty.
     */
    get discoveredRows(): RowSource[] {
      return discoveredRows.get()
    },
  }
}

/** The key space every row is keyed in. */
export function markRowKeySpaceViews(self: MarkRegionsHost) {
  let keySpace: RowKeySpace & { space: string } = {
    space: '',
    rowKeys: new RowKeys(),
    rowName: sectionRowName,
  }
  return {
    /**
     * #getter
     * The key each row holds across every loaded region, assigned at
     * its first arrival and never moved, and the name it is keyed by:
     * under `rows` its section's value, under a facet that value and
     * the row's depth in it. A new split field, or a switch between
     * `rows` and a facet, is a new key space.
     */
    get rowKeySpace(): RowKeySpace {
      const rows = self.drawsRows
      const space = `${rows ? 'rows' : 'facet'}:${self.splitField ?? ''}`
      if (keySpace.space !== space) {
        keySpace = {
          space,
          rowKeys: new RowKeys(),
          rowName: rows ? sectionRowName : facetRowName,
        }
      }
      return keySpace
    },
  }
}

/** What {@link markRegionViews} reads beside the key space. */
export type MarkKeySpaceHost = MarkRegionsHost &
  ReturnType<typeof markRowKeySpaceViews> & {
    sources: RowSource[]
    hiddenGroups: ReadonlySet<string>
    rowColorPaintsMarks: boolean
    resolvedRowColors: ReadonlyMap<string, string>
    canonicalRefName: (assemblyName: string, refName: string) => string
  }

/**
 * The layout of the sections and the layers as drawn: colored, keyed by
 * row, painted in the rows' colors and, for a link, owned by one region.
 */
export function markRegionViews(self: MarkKeySpaceHost) {
  const layout = stableIdentityComputed(() => {
    if (self.drawsRows) {
      return rowsLayout(self.sources, categoricalField(self.rowsField))
    }
    const { field = '', sort: domain = [] } = self.facet ?? {}
    return facetLayout(
      self.featurePayloads.values(),
      categoricalField(field, { domain }),
      self.hiddenGroups,
      self.markView.visible,
    )
  })
  // A fresh array per read would recolor every region on each read
  // nothing observes, so an equal one keeps the last one's identity.
  const sameColors = sameAsLast<ColorSource[]>()
  // Each region is colored here, first, so the rows, the sections, the
  // legend and the painters all read its colors as if the worker had
  // sent them.
  const colored = createEncodeMemo(
    () => self.featurePayloads,
    () => sameColors(self.markColors),
    withMarkColors,
  )
  const keyed = createEncodeMemo(
    () => (self.splitField === undefined ? NO_REGIONS : colored()),
    () => self.rowKeySpace,
    (region, { rowKeys, rowName }) =>
      keyRegion(region, rowKeys, self.splitField ?? '', rowName),
  )
  const unsplit = createEncodeMemo(
    () => (self.splitField === undefined ? colored() : NO_REGIONS),
    undefined,
    unsplitRegion,
  )
  // A mark naming no color, under a display naming none, paints each
  // row in the row's color where the row has one, and so does a
  // categorical color over the rows' own field (ADR-251).
  const rowColorPaint = stableIdentityComputed((): RowColors | undefined => {
    if (!self.drawsRows || !self.rowColorPaintsMarks) {
      return undefined
    }
    const field = self.rowsField
    const { marks, encoding } = self.configuration
    const declared = saysColor(encoding.color)
    const painted = marks.map((m, i) => {
      const source = self.markColors[i]
      return (
        (!declared && !saysColor(m.encoding.color)) ||
        (source?.kind === 'categories' && source.encoding.field === field)
      )
    })
    const colors = self.resolvedRowColors
    return painted.includes(true) && colors.size > 0
      ? { marks: painted, colors, field }
      : undefined
  })
  const rowColored = createEncodeMemo(
    () => keyed(),
    () => rowColorPaint.get(),
    (region, colors) =>
      colors
        ? withRowColors(region, colors, self.rowKeySpace.rowKeys.names)
        : region,
  )
  const drawn = () => (self.splitField === undefined ? unsplit() : rowColored())
  const mateRegions = stableIdentityComputed((): MateRegion[] =>
    self.host.displayedRegions.map((r, index) => ({
      index,
      refName: r.refName,
      start: r.start,
      end: r.end,
      assemblyName: r.assemblyName,
    })),
  )
  const canonical = (assemblyName: string, refName: string) =>
    self.canonicalRefName(assemblyName, refName)
  const mated = createEncodeMemo(
    () => (self.hasLinkMark ? drawn() : NO_REGIONS),
    () => mateRegions.get(),
    (data, regions, index) => withMateRegions(data, regions, canonical, index),
  )
  const owners = createLinkOwners()
  return {
    /**
     * #getter
     * The sections drawn over every loaded region, in the domain's order
     * and less the hidden ones, and where each key's rows start; under
     * `rows`, one row per value in the rows' order, which no chip names.
     */
    get facetLayout(): FacetLayout {
      return layout.get()
    },
    /**
     * #getter
     * The layers the display draws. Under a facet or `rows` every row
     * is a key the row table places, so a chip and the band beside it
     * agree whichever region a span came from, and a reorder, a focus,
     * a hidden section or a deeper section moves no instance. A region
     * is keyed again only when it or the key space moves, which is what
     * the upload re-packs.
     */
    get rpcDataMap(): ReadonlyMap<number, MarkRegionData> {
      return self.hasLinkMark
        ? owners(mated(), mateRegions.get(), canonical)
        : drawn()
    },
  }
}

type MarkLaidOutHost = MarkKeySpaceHost & ReturnType<typeof markRegionViews>

/** The table every mark places a key through. */
export function markRowTableViews(self: MarkLaidOutHost) {
  const keyNames = stableIdentityComputed(() => {
    void self.rpcDataMap
    return self.rowKeySpace.rowKeys.names.slice()
  })
  const order = stableIdentityComputed(() => self.sources.map(row => row.name))
  return {
    /**
     * #getter
     * `rowKeySpace`'s keys.
     */
    get rowKeys(): RowKeys {
      return self.rowKeySpace.rowKeys
    },
    /**
     * #getter
     * The table every mark places a key through: under `rows` its slot
     * in the rows' order, hidden where the focus leaves it out; under a
     * facet its section's first row plus its depth, hidden with its
     * section. Rebuilt on a reorder, a focus, a hidden or deeper section
     * or a new row, which uploads one small texture and no instance
     * bytes. Undefined while nothing splits the features.
     */
    get rowTable(): RowTable | undefined {
      return self.drawsRows
        ? markRowTable(keyNames.get(), order.get())
        : self.facet
          ? facetRowTable(keyNames.get(), self.facetLayout)
          : undefined
    },
  }
}

type MarkRowTableHost = MarkLaidOutHost & ReturnType<typeof markRowTableViews>

/** The keys the row table draws, and the layers over them. */
export function markDrawnKeyViews(self: MarkRowTableHost) {
  const drawnKeys = stableIdentityComputed(() => {
    const table = self.rowTable
    const { rowKeys, rowName } = self.rowKeySpace
    return (
      table &&
      drawnKeysOf(
        table,
        self.rpcDataMap.values(),
        rowKeys,
        self.splitField ?? '',
        rowName,
      )
    )
  })
  const scaled = createEncodeMemo(
    () => self.rpcDataMap,
    () => drawnKeys.get(),
    (data, drawn) => (drawn ? drawnRegion(data, drawn) : data),
  )
  return {
    /**
     * #getter
     * 1 at each key the row table draws, undefined while every key a
     * loaded region has is drawn: a focus or a hidden section moves it,
     * a reorder does not.
     */
    get drawnKeys(): Uint8Array | undefined {
      return drawnKeys.get()
    },
    /**
     * #getter
     * `rpcDataMap` with each layer's key and extents over the instances
     * the row table draws, its lanes shared: what the legend, the axis
     * and the size scales read, so a row the focus or a hidden section
     * hides leaves them as it leaves the plot.
     */
    get scaleDataMap(): ReadonlyMap<number, MarkRegionData> {
      return drawnKeys.get() ? scaled() : self.rpcDataMap
    },
  }
}

/** What {@link markStatsViews} reads beside the drawn layers. */
export type MarkDrawnHost = MarkRowTableHost &
  ReturnType<typeof markDrawnKeyViews> & {
    height: number
    rowsTopOffset: number
    rowFocusLineHeight: number
  }

/**
 * The `y` stats in view, the windows the key lists, the plot's inset and
 * box, the row count, and the link marks' sizes and regions.
 */
export function markStatsViews(self: MarkDrawnHost) {
  const keyWindows = stableIdentityComputed(() =>
    self.host.initialized ? keyWindowsOf(self.host.settledDynamicBlocks) : [],
  )
  return {
    /**
     * #getter
     * The `y` stats of every mark drawing at this zoom, or undefined
     * before any valued mark loads
     */
    get statsInView() {
      const indices = self.drawingMarkIndices
      const folded = new Set(indices)
      const { drawnKeys } = self
      return visibleStats({
        active: indices.some(i => self.markEntries[i]!.valued),
        view: self.host,
        payloadFor: index => {
          const data = self.scaleDataMap.get(index)
          return data && { index, data }
        },
        itemsFor: ({ index, data }) =>
          data.layers
            .filter(
              (l, i) => folded.has(i) && l.count > 0 && Number.isFinite(l.yMin),
            )
            .map((layer): RegionLayer => ({ index, layer })),
        accumulate: entries => computeSpanStats(layerSpans(entries, drawnKeys)),
      })
    },
    /**
     * #getter
     * The bp each displayed region shows once a pan settles, which the
     * key lists what is present in. Compared by value, so a pan that
     * settles where it was rebuilds no key.
     */
    get keyWindows() {
      return keyWindows.get()
    },
    /**
     * #getter
     * The px the y scale stands in from both ends of its band, one number
     * for the axis and every mark: room for the largest glyph or half the
     * thickest rule where only those draw, and none beside a bar, whose
     * top edge is its datum and wants the plot box itself. A text mark
     * labels what is drawn and moves nothing.
     */
    get valueInsetPx(): number {
      let inset = 0
      for (const i of self.drawingMarkIndices) {
        const type = self.markTypes[i]
        const size = self.markSizes[i]!
        if (type === 'point') {
          inset = Math.max(inset, pointInsetPx(size))
        } else if (type === 'rule') {
          inset = Math.max(inset, size / 2)
        } else if (type !== 'text') {
          return 0
        }
      }
      return inset
    },
    /**
     * #getter
     * bands a span stacks into: the facet's rows, one per row drawn under
     * `rows`, or else the highest `row` any loaded layer has, plus one
     */
    get rowCount(): number {
      const { rowCount } = self.facetLayout
      if (rowCount > 0 || self.rowTable) {
        return Math.max(1, rowCount)
      }
      const { visible } = self.markView
      let highest = 0
      for (const data of self.rpcDataMap.values()) {
        highest = Math.max(highest, highestRow(data.layers, visible))
      }
      return highest + 1
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: the plot's top inset.
     */
    get rowsHeaderHeight(): number {
      return axisPlotBox(self.height).yTop
    },
    /**
     * #getter
     * The plot canvas's box: the axis inset, less the focus chip's line
     * at its top, so the canvas starts where the rows do.
     */
    get plotBox(): { yTop: number; plotHeight: number } {
      return {
        yTop: self.rowsTopOffset,
        plotHeight: Math.max(
          0,
          axisPlotBox(self.height).plotHeight - self.rowFocusLineHeight,
        ),
      }
    },
    /**
     * #getter
     * Each link mark's size scale: its declared ends, the open ones the
     * least and greatest the regions draw, so a value strokes at one width
     * in every region; undefined for a mark whose size names no field.
     * Over the drawn layers, as the color ramp's domain is, so a hidden
     * section leaves the stroke widths the way it leaves the key.
     */
    get sizeScales(): (LinkSizeScale | undefined)[] {
      const payloads = [...self.scaleDataMap.values()]
      return self.configuration.marks.map((_, i) => {
        let table: SizeScaleTable | undefined
        let lo = Infinity
        let hi = -Infinity
        for (const { layers } of payloads) {
          const next = layers[i]?.sizeScale
          if (next) {
            table ??= next
            lo = Math.min(lo, next.extent[0])
            hi = Math.max(hi, next.extent[1])
          }
        }
        const { domain, pinned, scale, range } = table ?? {}
        return domain && pinned && scale && range
          ? {
              // The open ends follow the union, the pinned ones the
              // config, as a color ramp's domain does.
              domain: rampDomain(
                pinned[0] ? domain[0] : undefined,
                pinned[1] ? domain[1] : undefined,
                [lo, hi],
              ),
              scale,
              range,
            }
          : undefined
      })
    },
    /**
     * #getter
     * The view's displayed regions as a link's feet place through them
     * (`viewRegionTable`). Empty where no mark is a link, reading nothing
     * per frame.
     */
    get linkRegions(): readonly LinkRegion[] {
      return self.hasLinkMark ? viewRegionTable(self.host) : NO_LINK_REGIONS
    },
  }
}

/** What {@link markAutoscaleViews} reads beside the stats. */
export type MarkStatsHost = MarkDrawnHost &
  ReturnType<typeof markStatsViews> & {
    fenceQuantile: number
    scaleType: ScaleType
    scoreRules: ValueScaleRule[]
    axisReachesZero: boolean
  }

/** The y range in view, the rows' height to fit, and the key. */
export function markAutoscaleViews(self: MarkStatsHost) {
  return {
    /**
     * #getter
     * [min, max] over the `y` of every mark drawing at this zoom, through
     * the fence `encoding.y.scale` names, widened to every rule the scale
     * declares and to the origin whenever a bar mark draws, or undefined
     * before any valued mark loads
     */
    get autoscaleRange(): [number, number] | undefined {
      const walked = self.statsInView
      const types = self.drawingMarkIndices.map(i => self.markTypes[i]!)
      const { origin, fenceQuantile, drawnKeys, scaleType } = self
      const reached = [
        ...self.scoreRules.map(rule => rule.value),
        ...(types.includes('bar') ? [origin] : []),
      ].filter(value => baselineReached(value, scaleType))
      return walked
        ? widenRangeToRules(
            autoscaleDomainFromSpans({
              stats: walked.stats,
              quantile: fenceQuantile,
              zero: self.axisReachesZero,
              spans: layerSpans(walked.entries, drawnKeys),
            }),
            reached,
          )
        : undefined
    },
    /**
     * #getter
     * The least and greatest `y` drawing in view, unfenced.
     */
    get valuesInView(): [number, number] | undefined {
      const walked = self.statsInView
      return walked ? [walked.stats.scoreMin, walked.stats.scoreMax] : undefined
    },
    /**
     * #getter
     * `rowCount`, under the name `useRowVirtualScroll`'s shift+wheel
     * resize divides the plot by.
     */
    get nrow(): number {
      return self.rowCount
    },
    /**
     * #getter
     * `RowHeightMixin`'s hook: the plot split between the rows. Rows under
     * `rows` fill the plot, a fraction of a px each where they must, as
     * every row display's do; a facet's packed rows keep whole px while
     * each can have one.
     */
    get autoRowHeight(): number {
      const { plotHeight } = self.plotBox
      return self.drawsRows
        ? plotHeight / Math.max(1, self.rowCount)
        : markRowHeightPx(plotHeight, self.rowCount)
    },
    /**
     * #getter
     * the color keys for the loaded regions, one per scale the marks
     * drawing at the view's zoom resolve through, each headed with its
     * channel's `title`; a categorical or shape key lists the values on
     * screen, a ramp's domain stays over every loaded region
     */
    get legendSections(): MarkLegendSection[] {
      const { visible } = self.markView
      const { marks, encoding } = self.configuration
      return buildMarkLegend(
        regionsKeyOnScreen(self.scaleDataMap, self.keyWindows),
        i => !!visible[i],
        (i, channel) =>
          keySettingOf(
            marks[i],
            channel,
            self.hiddenCategories,
            encoding.color,
          ),
      )
    },
  }
}

/** What {@link markDomainViews} reads beside the range and the key. */
export type MarkAutoscaleHost = MarkStatsHost &
  ReturnType<typeof markAutoscaleViews> & {
    autoscaledDomain: [number, number] | undefined
    editableSources: RowSource[]
    rowColorScales: ColorScale[]
  }

/** The domain drawn, the resolved row height and the color scales. */
export function markDomainViews(self: MarkAutoscaleHost) {
  return {
    /**
     * #getter
     */
    get domain() {
      return self.autoscaledDomain
    },
    /**
     * #getter
     * The px each row is drawn in, the band every shape gets:
     * `drawnRowStep` resolved, pinned or fit.
     */
    get effectiveRowHeight(): number {
      return resolveRowHeight(self.drawnRowStep, self.autoRowHeight)
    },
    /**
     * #getter
     * The color scale each mark paints through where its color is
     * quantitative: a ramp over the domain the legend already unioned
     * across the regions, its middle stop a value, or a threshold's cuts
     * and the packed color of each interval. Both ride uniforms, so a pan
     * that widens a domain or an edit that moves a cut uploads no instance
     * bytes and no table.
     */
    get paintScales(): (MarkColorScale | undefined)[] {
      const sections = self.legendSections
      return self.configuration.marks.map((_, i) =>
        paintScaleOf(colorSection(sections, i)?.scale),
      )
    },
    /**
     * #getter
     * `LegendMixin`'s hook: the keys as color scales, so the chrome and the
     * export draw the legend off the tables the worker resolved, then the
     * row color key
     */
    get colorScales(): ColorScale[] {
      return [
        ...markColorScales(
          self.legendSections,
          self.facet
            ? categoricalField(self.facet.field, { domain: self.facet.sort })
            : self.drawsRows
              ? categoricalField(self.rowsField, {
                  domain: self.editableSources.map(row => row.name),
                })
              : undefined,
        ),
        ...self.rowColorScales,
      ]
    },
  }
}

/** What {@link markSidebarViews} reads beside the domain. */
export type MarkDomainHost = MarkAutoscaleHost &
  ReturnType<typeof markDomainViews> & {
    rowSidebarProps: SvgSidebarProps
  }

/** The rows' sidebar. */
export function markSidebarViews(self: MarkDomainHost) {
  return {
    /**
     * #getter
     * The dendrogram, band strip and row labels at the display's left,
     * which the axis sits past on screen and the export parks left of the
     * figure; none while the rows are not drawn.
     */
    get sidebarPanel(): SvgSidebarProps | undefined {
      return self.drawsRows ? self.rowSidebarProps : undefined
    },
  }
}

/** What {@link markScaleViews} reads beside the sidebar. */
export type MarkSidebarHost = MarkDomainHost &
  ReturnType<typeof markSidebarViews> & {
    scrollTop: number
    symlogConstant: number
    canvasWidthPx: number
    axisGuide: Pick<ValueScale, 'caption' | 'rules' | 'grid' | 'showAxis'>
  }

/** The y scale the axis is drawn from, and the plot canvas's render state. */
export function markScaleViews(self: MarkSidebarHost) {
  return {
    /**
     * #getter
     * The one y scale the chrome draws the axis from — `encoding.y` resolved:
     * its type, its domain autoscaled where it pins nothing, its title as
     * the caption and its rules. Every mark reads the same pair.
     */
    get valueScales(): ValueScale[] {
      const { height, rowCount } = self
      const pointInset = self.valueInsetPx
      // One band per row where the marks stand in rows or a pinned
      // `rows.step` sizes them, the scale ruling each on its own the way
      // the multi-wiggle display's does; the whole plot box otherwise.
      const rowHeight = self.effectiveRowHeight
      const rowsTop = self.rowsTopOffset - self.scrollTop
      const band =
        rowCount > 1 || self.drawnRowStep !== FIT_ROWS
          ? {
              height: rowHeight,
              offset: pointInset,
              bandTops: Array.from(
                { length: rowCount },
                (_, row) => rowsTop + row * rowHeight,
              ),
            }
          : self.rowFocusLineHeight
            ? {
                height: height - self.rowFocusLineHeight,
                offset: YSCALEBAR_LABEL_OFFSET + pointInset,
                bandTops: [self.rowFocusLineHeight],
              }
            : {
                height,
                offset: YSCALEBAR_LABEL_OFFSET + pointInset,
              }
      return [
        {
          domain: self.domain,
          scaleType: self.scaleType,
          symlogConstant: self.symlogConstant,
          ...band,
          left: self.sidebarPanel ? sidebarPanelWidth(self.sidebarPanel) : 0,
          ...self.axisGuide,
        },
      ]
    },
    /**
     * #getter
     * geometry and scale for the plot canvas, the same box the hit test
     * measures in
     */
    get renderState(): MarkRenderState {
      const canvasWidth = self.canvasWidthPx
      const canvasHeight = self.plotBox.plotHeight
      const { scaleType, paintScales: colorScales } = self
      return resolveRenderState(self.domain, domainY => ({
        domainY,
        scaleTypeY: scaleType,
        symlogConstantY: resolveSymlogConstant(
          domainY[0],
          domainY[1],
          self.symlogConstant,
        ),
        colorScales,
        colorsFromY: self.markColors.map(
          color => color.kind === 'numbers' && color.fromY,
        ),
        canvasWidth,
        canvasHeight,
        bpPerPx: self.host.bpPerPx,
        origin: self.origin,
        minWidthPx: MIN_MARK_WIDTH_PX,
        markSizes: self.markSizes,
        sizeScales: self.sizeScales,
        linkRegions: self.linkRegions,
        valueInsetPx: self.valueInsetPx,
        rowHeight: self.effectiveRowHeight,
        rowProportions: self.markRowProportions,
        scrollTop: self.scrollTop,
        rowTable: self.rowTable,
      }))
    },
  }
}

/** The sidebar the export parks left of the axis. */
export function markSvgSidebarViews(self: {
  sidebarPanel: SvgSidebarProps | undefined
  axes: YAxis[]
}) {
  return {
    /**
     * #getter
     */
    get svgSidebar(): SvgSidebarProps | undefined {
      const { sidebarPanel } = self
      return sidebarPanel
        ? { ...sidebarPanel, leftInset: leftAxisGutterWidth(self.axes) }
        : undefined
    },
  }
}
