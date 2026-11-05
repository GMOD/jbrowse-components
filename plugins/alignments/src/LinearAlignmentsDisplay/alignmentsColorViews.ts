import {
  isBakedField,
  declaredReadLabels,
  writtenReadCategoryColors,
} from '../shared/alignmentsColor.ts'
import { paintsModifications } from '../shared/colorFieldDefs.ts'
import { keySectionOrder } from '../shared/keySectionOrder.ts'
import {
  colorRampScales,
  getReadDisplayLegendItems,
  insertSizeBandLabels,
  overlapLegendRows,
} from '../shared/legendUtils.ts'
import { getColorForModification } from '../util.ts'
import {
  bakedColorExtent,
  bakedColorScale,
  linearFieldExtent,
} from './bakedColorScale.ts'
import { buildColorPaletteFromPalette } from './components/alignmentComponentUtils.ts'
import { applyReadColorsByGroup } from './groupLayout.ts'
import {
  insertSizeBandInWindows,
  modificationTypesInWindows,
  overlapKindsInWindows,
  readCategoriesInWindows,
  readMapqsInWindows,
  readTagValuesInWindows,
} from './keyWindows.ts'
import { NO_QUALITY_SPAN, baseQualitySpanAcrossGroups } from './qualitySpans.ts'
import { shouldDrawOverlaps } from './renderers/rendererTypes.ts'

import type { GroupedAlignmentsResult } from '../RenderAlignmentDataRPC/types.ts'
import type { ColorPalette } from '../shaders/colors.ts'
import type {
  AlignmentsColorEncoding,
  AlignmentsColorSetting,
  DeclaredReadLabels,
} from '../shared/alignmentsColor.ts'
import type { OverlapLegendRow } from '../shared/legendUtils.ts'
import type { BaseLayer, ColorFieldKind, Facet } from '../shared/types.ts'
import type { NumericExtent } from './bakedColorScale.ts'
import type { RefNamePosition } from './colorTagUtils.ts'
import type { ReadColorCategory } from './colorUtils.ts'
import type { AlignmentsUnit } from './constants.ts'
import type { LaidOutByGroup } from './groupLayout.ts'
import type { QualitySpan } from './qualitySpans.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { KeyWindow } from '@jbrowse/display-kit/keyWindows'

/**
 * What the read color views read: the settings and laid-out reads an
 * alignments display has already resolved, from its config and layout on
 * screen, or from a config and fetched reads in a static export.
 */
export interface AlignmentsColorHost {
  colorEncoding: AlignmentsColorEncoding
  colorField: string | undefined
  colorLabels: readonly string[]
  colorKeyDescending: boolean | undefined
  bodyColorKind: ColorFieldKind
  baseLayer: BaseLayer | undefined
  unit: AlignmentsUnit
  effectiveFacet: Facet | undefined
  collapseSections: boolean
  featureHeight: number
  showLegend: boolean
  framesChainStrand: boolean
  laidOutByGroupFramed: LaidOutByGroup
  keyWindows: readonly KeyWindow[]
  paintedRefNamePosition: RefNamePosition | undefined
  detectedModifications: ReadonlyMap<string, string>
}

/** What {@link readPaletteViews} reads: the `encoding.color` setting. */
export interface ReadPaletteHost {
  colorSetting: AlignmentsColorSetting
  colorEncoding: AlignmentsColorEncoding
}

/** The read palette in a theme, under the colors `encoding.color` writes. */
export function readPaletteViews(self: ReadPaletteHost) {
  return {
    /**
     * #method
     * The read palette over `theme`, with the category colors
     * `encoding.color` sets: what the display paints its reads, arcs,
     * connectors and junctions from, in the session theme or the one an
     * export renders with.
     */
    colorsIn(theme: JBrowsePalette) {
      return buildColorPaletteFromPalette(theme, {
        declared: writtenReadCategoryColors(
          self.colorSetting,
          self.colorEncoding,
        ),
      })
    },
  }
}

/**
 * Modification type code -> painted color, for every type the fetched reads
 * declare, hidden sections included.
 */
export function detectedModificationsOf(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
) {
  const out = new Map<string, string>()
  for (const { groups } of rpcDataMap.values()) {
    for (const { data } of groups) {
      for (const type of data.detectedModifications) {
        if (!out.has(type)) {
          out.set(type, getColorForModification(type))
        }
      }
    }
  }
  return out
}

/**
 * The views that bake an alignments display's read colors and build the read
 * key beside them. The display installs them as a `.views()` layer, so each
 * is its own computed; a static export runs the same getters over a plain
 * host, so the export and the view cannot color or key reads differently.
 */
export function alignmentsColorViews(self: AlignmentsColorHost) {
  return {
    /**
     * #getter
     * The inputs to read classification beside the field, with the framing as
     * `framesChainStrand` answered it, so the bake frames exactly where
     * the consensus pass ran and the key words it.
     */
    get readColorOpts() {
      return {
        unit: self.unit,
        framesChainStrand: self.framesChainStrand,
      }
    },

    /**
     * #getter
     * The span of a linear color field over the loaded reads, which a
     * ramp's open ends stretch across: their extremes, or below a
     * `domainQuantile` of 1 that quantile of each sign. Undefined
     * while `domainMin` and `domainMax` both pin the ramp or another
     * scale paints, so a region arriving rebakes nothing then.
     */
    get bakedColorExtent(): NumericExtent | undefined {
      return bakedColorExtent(
        self.colorEncoding,
        self.colorField,
        self.laidOutByGroupFramed,
        () => this.linearFieldExtent,
      )
    },

    /**
     * #getter
     * The whole span of a linear color field, a tag or MAPQ, over the
     * loaded reads (`linearFieldExtent`).
     */
    get linearFieldExtent(): NumericExtent | undefined {
      return linearFieldExtent(
        self.colorEncoding,
        self.colorField,
        self.laidOutByGroupFramed,
      )
    },

    /**
     * #getter
     * The span of the base qualities drawn, and whether a base has
     * none. O(bases), so gated on showLegend like the category scan.
     */
    get baseQualitySpan(): QualitySpan {
      return self.showLegend && self.baseLayer?.field === 'baseQuality'
        ? baseQualitySpanAcrossGroups(self.laidOutByGroupFramed)
        : NO_QUALITY_SPAN
    },

    /**
     * #getter
     * The scale a tag, attribute or mate reference bakes through, read by
     * the per-read bake and the key alike. Undefined for the fields the
     * category table paints.
     */
    get bakedColorScale() {
      return isBakedField(self.colorField)
        ? bakedColorScale(
            self.colorField,
            self.colorEncoding,
            self.paintedRefNamePosition,
            this.bakedColorExtent,
          )
        : undefined
    },

    /**
     * #getter
     * The per-read color bake's inputs, kept out of `groupLayoutContext`
     * so a recolor never relays.
     */
    get readColorContext() {
      return {
        colorField: self.colorField,
        bodyColorKind: self.bodyColorKind,
        readColorOpts: this.readColorOpts,
        bakedScale: this.bakedColorScale,
      }
    },

    /**
     * #getter
     * Per-group laid-out data with the per-read color arrays baked on.
     * No input in `readColorContext` moves a read's row, so a recolor
     * keeps the layout memoized and `readYs` keeps its identity: the GPU
     * upload memo checks `readYs` to rewrite only the read pass. Tag
     * colors bake here, not in the worker, so tag coloring stays a
     * main-thread tier-2 setting.
     */
    get laidOutByGroupColored() {
      return applyReadColorsByGroup(
        self.laidOutByGroupFramed,
        this.readColorContext,
      )
    },

    /**
     * #getter
     * Read-color buckets present across the rendered reads, so the legend
     * lists only relevant swatches. Empty while the legend is hidden,
     * skipping the O(reads) scan.
     */
    get colorLegendCategories(): Set<ReadColorCategory> {
      // Baked categories off the laid-out groups, not a second
      // classification of `rpcDataMap`: `readFillColors` is empty until
      // the main thread bakes it.
      return self.showLegend
        ? readCategoriesInWindows(this.laidOutByGroupColored, self.keyWindows)
        : new Set()
    },

    /**
     * #getter
     * The per-read values the CPU-baked fields painted in the rendered
     * reads (tag values, or mate refNames under chromosome painting).
     * `undefined` for other fields, and the legend then does not filter;
     * the empty set means none are on screen. Gated on showLegend:
     * O(reads).
     */
    get presentTagValues(): ReadonlySet<string> | undefined {
      return !self.showLegend || !isBakedField(self.colorField)
        ? undefined
        : self.colorField === 'mapq'
          ? readMapqsInWindows(self.laidOutByGroupFramed, self.keyWindows)
          : readTagValuesInWindows(self.laidOutByGroupFramed, self.keyWindows)
    },

    /**
     * #getter
     * The modification types drawn in the rendered reads. Read from
     * `modificationTypes`, which the worker builds from the drawn marks;
     * `detectedModifications` includes hidden lanes. The legend's
     * bisulfite branch runs before this filter, since the two differ
     * there. `undefined` outside the modification fields.
     */
    get presentModifications(): ReadonlySet<string> | undefined {
      return self.showLegend && paintsModifications(self.baseLayer)
        ? modificationTypesInWindows(self.laidOutByGroupFramed, self.keyWindows)
        : undefined
    },

    /**
     * #getter
     * `encoding.color.scale.names` against the read buckets and values it names, which
     * every key row, hover and connection curve names a bucket by.
     */
    get declaredReadLabels(): DeclaredReadLabels {
      return declaredReadLabels(self.colorEncoding, self.colorLabels)
    },

    /**
     * #getter
     * The keys' row names: `declaredReadLabels` over the insert-size rows
     * named with the band they part at, where every region in view
     * classifies by one band.
     */
    get keyReadLabels(): DeclaredReadLabels {
      const declared = this.declaredReadLabels
      return {
        ...declared,
        categories: {
          ...insertSizeBandLabels(
            self.showLegend
              ? insertSizeBandInWindows(
                  self.laidOutByGroupFramed,
                  self.keyWindows,
                )
              : undefined,
          ),
          ...declared.categories,
        },
      }
    },

    /**
     * #getter
     * The overlap rows the legend names: a chain's split-segment and
     * mate overlaps, or the collapsed rows' tint. A row needs the pass to
     * be DRAWING (`shouldDrawOverlaps`, shared with both renderers) and
     * some region to hold an interval of its kind, so no row explains an
     * off-screen mark. O(regions).
     */
    get overlapLegendRows(): readonly OverlapLegendRow[] {
      return shouldDrawOverlaps({
        unit: self.unit,
        collapseSections: self.collapseSections,
        featureHeight: self.featureHeight,
      })
        ? overlapLegendRows(
            self.unit === 'chain',
            overlapKindsInWindows(self.laidOutByGroupFramed, self.keyWindows),
          )
        : []
    },

    /**
     * #getter
     * The sections' order, where the facet field is the one the reads are
     * colored by: a key over one field lists the values as the sections
     * stack.
     * Not over `mapq`, whose sections are bins and whose key is its bins
     * or its raw values.
     */
    get keySectionOrder() {
      return keySectionOrder(self.effectiveFacet, self.colorField)
    },

    /**
     * #getter
     * The color bars beside the read rows: the per-base layer's, then the
     * read fill's while it paints through a ramp (`colorRampScales`).
     */
    get colorRamps() {
      return colorRampScales({
        colorField: self.colorField,
        baseLayer: self.baseLayer,
        bakedScale: this.bakedColorScale,
        linearFieldExtent: this.linearFieldExtent,
        baseQualityExtent: this.baseQualitySpan.extent,
      })
    },

    /**
     * #method
     */
    legendItems(palette: ColorPalette) {
      return getReadDisplayLegendItems({
        overlaps: this.overlapLegendRows,
        colorField: self.colorField,
        baseLayer: self.baseLayer,
        presentCategories: this.colorLegendCategories,
        palette,
        detectedModifications: self.detectedModifications,
        presentTagValues: this.presentTagValues,
        presentModifications: this.presentModifications,
        refNamePosition: self.paintedRefNamePosition,
        bakedScale: this.bakedColorScale,
        sectionOrder: this.keySectionOrder,
        baseQualityUnavailable: this.baseQualitySpan.unavailable,
        labels: this.keyReadLabels,
        descending: self.colorKeyDescending,
      })
    },
  }
}
