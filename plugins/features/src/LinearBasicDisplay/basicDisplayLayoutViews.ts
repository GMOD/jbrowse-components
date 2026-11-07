import { getConf } from '@jbrowse/core/configuration'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'

import { subfeatureLabelsOf } from '../RenderFeatureDataRPC/displayModes.ts'
import { labelFontSize } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { hiddenSectionFeatureIds } from './facet.ts'
import { resolvedGeneGlyphMode } from './geneGlyphMode.ts'
import { labelVisibility } from './showLabelsMode.ts'

import type {
  DisplayMode,
  SubfeatureLabels,
} from '../RenderFeatureDataRPC/displayModes.ts'
import type { SectionStamp } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LinearFeatureBaseDisplayConfigModel } from './baseConfigSchema.ts'
import type { LinearBasicDisplayConfig } from './configSchema.ts'
import type { FeatureFacet } from './facet.ts'
import type { GeneGlyphMode } from './geneGlyphMode.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * The settings a feature display reads off its config before anything is
 * fetched. The base model installs them as a `.views()` layer; the tables
 * export's static host composes them beside its config node.
 */
export function featureDisplayConfigViews(self: {
  configuration: Instance<LinearFeatureBaseDisplayConfigModel>
}) {
  return {
    /**
     * #getter
     * The `facet` object as written, or undefined while ungrouped.
     */
    get facet(): FeatureFacet | undefined {
      return facetSettingOf({
        field: getConf(self, ['facet', 'field']),
        sort: getConf(self, ['facet', 'sort']),
      })
    },

    /**
     * #getter
     */
    get displayMode(): DisplayMode {
      return getConf(self, 'displayMode')
    },

    /**
     * #getter
     * `HiddenGroupsMixin`'s hook: a section key means nothing outside the
     * field that issued it, so moving the field drops what was hidden.
     */
    get groupKeySpace(): string {
      return getConf(self, ['facet', 'field'])
    },

    /**
     * #getter
     */
    get labelFontSize() {
      return labelFontSize(this.displayMode)
    },

    /**
     * #getter
     * `labels.name.show`, the persisted intent before the density gate and
     * collapsed mode have a say, so the menu's checkbox reflects the choice.
     */
    get showNames(): boolean {
      return getConf(self, ['labels', 'name', 'show'])
    },

    /**
     * #getter
     * `labels.description.show`, the persisted intent, as `showNames` is.
     */
    get showDescriptions(): boolean {
      return getConf(self, ['labels', 'description', 'show'])
    },
  }
}

/**
 * The fetched features a hidden section holds. The base model installs it
 * as a `.views()` layer; the tables export's static host installs the same.
 */
export function hiddenSectionViews(self: {
  rpcDataMap: ReadonlyMap<
    number,
    { flatbushItems: readonly (SectionStamp & { featureId: string })[] }
  >
  facet: FeatureFacet | undefined
  hiddenGroups: ReadonlySet<string>
}) {
  return {
    /**
     * #getter
     * The features of the sections the user hid, which sit unplaced by
     * choice and so count as nothing the track failed to show.
     */
    get hiddenGroupFeatureIds() {
      return hiddenSectionFeatureIds(
        self.rpcDataMap.values(),
        self.facet,
        self.hiddenGroups,
      )
    },
  }
}

/**
 * What the glyph views read: a `LinearBasicDisplay`'s config, its resolved
 * `displayMode` and the zoom its view is at, or the zoom a static export
 * lays out at.
 */
export interface BasicDisplayGlyphHost {
  configuration: LinearBasicDisplayConfig
  displayMode: DisplayMode
  host: { bpPerPx: number }
}

/**
 * The glyph settings a `LinearBasicDisplay` reads off its config and the
 * modes it asks the worker for, as the display resolves them. The model
 * installs them as a `.views()` layer, so each is its own computed; the
 * tables export's static host installs the same layer.
 */
export function basicDisplayGlyphViews(self: BasicDisplayGlyphHost) {
  return {
    /**
     * #getter
     * `labels.subfeatures` as the one mode the worker reads.
     */
    get subfeatureLabels(): SubfeatureLabels {
      return subfeatureLabelsOf({
        show: getConf(self, ['labels', 'subfeatures', 'show']),
        placement: getConf(self, ['labels', 'subfeatures', 'placement']),
      })
    },

    /**
     * #getter
     * `chevrons.show`, over the base's hook.
     */
    get showChevrons(): boolean {
      return getConf(self, ['chevrons', 'show'])
    },

    /**
     * #getter
     */
    get geneGlyphMode(): GeneGlyphMode {
      return getConf(self, 'geneGlyphMode')
    },

    /**
     * #getter
     * The subfeature-label mode the worker bakes: `subfeatureLabels`, but
     * none while collapsed, since the label is baked in the worker.
     */
    get effectiveSubfeatureLabels(): SubfeatureLabels {
      return self.displayMode === 'collapsed' ? 'none' : this.subfeatureLabels
    },

    /**
     * #getter
     * The gene-glyph mode the worker collapses under, `auto` resolved off the
     * live zoom: off the debounced one, a region fetched in the mode the view
     * just left read as current for 500ms, and an export in that window drew
     * it.
     */
    get effectiveGeneGlyphMode(): GeneGlyphMode {
      return resolvedGeneGlyphMode(this.geneGlyphMode, self.host.bpPerPx)
    },

    /**
     * #getter
     * Whether the user picked "All transcripts", off the raw mode rather than
     * `effectiveGeneGlyphMode`: `auto` resolves to `all` under 100bp/px and
     * its job is to fit the track, so only the explicit pick withholds the
     * fit ladder's trim.
     */
    get showsEveryIsoform() {
      return this.geneGlyphMode === 'all'
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
  host: { coarseBpPerPx: number; namesFeatures?: boolean }
  rpcDataMap: ReadonlyMap<
    number,
    { flatbushItems: readonly { featureId: string; gene?: boolean }[] }
  >
  displayMode: DisplayMode
  showNames: boolean
  showDescriptions: boolean
  visibleFeatureDensityPerPx: number
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
 * export's static host installs the same layer.
 */
export function basicDisplayLayoutViews(self: BasicDisplayLayoutHost) {
  return {
    /**
     * #getter
     * Features per pixel of what is actually ON SCREEN — the density the
     * `auto` label modes gate on (ADR-093).
     */
    get labelDensityPerPx() {
      const ids = self.onScreenFeatureIds
      const widthPx = self.onScreenWidthPx
      return ids && widthPx > 0
        ? ids.size / widthPx
        : self.visibleFeatureDensityPerPx
    },

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
      const rowsCarryLabels = !self.host.namesFeatures
      return labelVisibility({
        name: self.showNames && rowsCarryLabels,
        description: self.showDescriptions && rowsCarryLabels,
        collapsed: self.displayMode === 'collapsed',
        density: this.labelDensityPerPx,
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
