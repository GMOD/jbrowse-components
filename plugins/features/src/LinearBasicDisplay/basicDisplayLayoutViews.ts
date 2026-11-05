import { resolvedGeneGlyphMode } from './geneGlyphMode.ts'
import { labelVisibility } from './showLabelsMode.ts'

import type {
  DisplayMode,
  SubfeatureLabels,
} from '../RenderFeatureDataRPC/displayModes.ts'
import type { FeatureFacet } from './facet.ts'
import type { GeneGlyphMode } from './geneGlyphMode.ts'

/**
 * What the glyph views read: the settings a `LinearBasicDisplay` reads off
 * its config and the zoom its view is at, or a config and a `bpPerPx` in a
 * static export.
 */
export interface BasicDisplayGlyphHost {
  displayMode: DisplayMode
  subfeatureLabels: SubfeatureLabels
  geneGlyphMode: GeneGlyphMode
  host: { bpPerPx: number }
}

/**
 * The glyph modes a `LinearBasicDisplay` asks the worker for, as the display
 * resolves its settings. The model installs them as a `.views()` layer, so
 * each is its own computed; the tables export runs the same getters over a
 * plain host.
 */
export function basicDisplayGlyphViews(self: BasicDisplayGlyphHost) {
  return {
    /**
     * #getter
     * The subfeature-label mode the worker bakes: `subfeatureLabels`, but
     * none while collapsed, since the label is baked in the worker.
     */
    get effectiveSubfeatureLabels(): SubfeatureLabels {
      return self.displayMode === 'collapsed' ? 'none' : self.subfeatureLabels
    },

    /**
     * #getter
     * The gene-glyph mode the worker collapses under, `auto` resolved off the
     * live zoom: off the debounced one, a region fetched in the mode the view
     * just left read as current for 500ms, and an export in that window drew
     * it.
     */
    get effectiveGeneGlyphMode(): GeneGlyphMode {
      return resolvedGeneGlyphMode(self.geneGlyphMode, self.host.bpPerPx)
    },

    /**
     * #getter
     * Whether the user picked "All transcripts", off the raw mode rather than
     * `effectiveGeneGlyphMode`: `auto` resolves to `all` under 100bp/px and
     * its job is to fit the track, so only the explicit pick withholds the
     * fit ladder's trim.
     */
    get showsEveryIsoform() {
      return self.geneGlyphMode === 'all'
    },
  }
}

/**
 * What the layout views read: a feature display's label settings, the
 * features on screen and the user's layout state, or a config and fetched
 * regions in a static export, where every fetched feature is on screen and
 * nothing is pinned or expanded.
 */
export interface BasicDisplayLayoutHost {
  host: { coarseBpPerPx: number }
  rpcDataMap: ReadonlyMap<
    number,
    { flatbushItems: readonly { featureId: string; gene?: boolean }[] }
  >
  displayMode: DisplayMode
  showNames: boolean
  showDescriptions: boolean
  labelDensityPerPx: number
  onScreenFeatureIds: ReadonlySet<string> | undefined
  onScreenWidthPx: number
  layoutPinnedFeatureIdSet: ReadonlySet<string>
  expandedGeneIdSet: ReadonlySet<string>
  facet: FeatureFacet | undefined
  hiddenGroups: ReadonlySet<string>
  autoHeight: boolean
  effectiveSubfeatureLabels: SubfeatureLabels
}

/**
 * The label and layout decisions a feature display hands its band
 * (`featureBandViews`): which labels draw at the on-screen density, the layout
 * inputs every fit rung shares, and what the ladder measures. The model
 * installs them as a `.views()` layer, so each is its own computed; the tables
 * export runs the same getters over a plain host.
 */
export function basicDisplayLayoutViews(self: BasicDisplayLayoutHost) {
  return {
    /**
     * #getter
     * On-screen gene features per pixel, which `auto` holds to the same
     * threshold so gene names outlast a crowd of other features. Undefined
     * with no gene on screen.
     */
    get geneLabelDensityPerPx() {
      const ids = self.onScreenFeatureIds
      const widthPx = self.onScreenWidthPx
      if (!ids || widthPx === 0) {
        return undefined
      }
      const geneIds = new Set<string>()
      for (const data of self.rpcDataMap.values()) {
        for (const item of data.flatbushItems) {
          if (item.gene && ids.has(item.featureId)) {
            geneIds.add(item.featureId)
          }
        }
      }
      return geneIds.size > 0 ? geneIds.size / widthPx : undefined
    },

    /**
     * #getter
     * Which of the shown labels draw at the on-screen feature density:
     * names, descriptions, and whether only gene names survive.
     */
    // Gated here rather than only at `renderedShowLabels`, so layout, hit
    // testing, the DOM overlay and the SVG export agree; otherwise rows
    // reserve label height nothing uses.
    get labelVisibility() {
      return labelVisibility({
        name: self.showNames,
        description: self.showDescriptions,
        collapsed: self.displayMode === 'collapsed',
        density: self.labelDensityPerPx,
        geneDensity: () => this.geneLabelDensityPerPx,
      })
    },

    /**
     * #getter
     */
    get showLabels() {
      return this.labelVisibility.showLabels
    },

    /**
     * #getter
     * Past the name threshold, with the gene features alone still under
     * it: gene names stay and every other name goes.
     */
    get geneNamesOnly() {
      return this.labelVisibility.geneNamesOnly
    },

    /**
     * #getter
     */
    get effectiveShowDescriptions() {
      return this.labelVisibility.showDescriptions
    },

    /**
     * #getter
     * Layout inputs shared by the base layout and every fit rung,
     * `expandedGeneIds` included: a rung inheriting them without the
     * exemption re-collapses the gene the user just opened.
     */
    get layoutInputs() {
      return {
        bpPerPx: self.host.coarseBpPerPx,
        displayMode: self.displayMode,
        pinnedFeatureIds: self.layoutPinnedFeatureIdSet,
        expandedGeneIds: self.expandedGeneIdSet,
        facet: self.facet,
        hiddenGroupKeys: self.hiddenGroups,
        geneNamesOnly: this.geneNamesOnly,
      }
    },

    /**
     * #getter
     * The features the ladder measures its rungs and its isoform solve
     * against: the on-screen set in `fit` and `fixed`, undefined in
     * `grow` (which measures the whole stack).
     */
    get fitMeasureFeatureIds(): ReadonlySet<string> | undefined {
      return self.autoHeight ? undefined : self.onScreenFeatureIds
    },

    /**
     * #getter
     * Whether the settings reserve `below` subfeature-label rows, which
     * the fit ladder's `bare` rung depends on — with nothing
     * reserved the rung would repack an identical stack.
     */
    get reservesBelowLabelRows() {
      return self.effectiveSubfeatureLabels === 'below'
    },
  }
}
