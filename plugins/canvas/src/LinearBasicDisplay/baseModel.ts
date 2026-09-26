import { lazy } from 'react'

import {
  ConfigurationReference,
  fullConfSnapshot,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { Highlighter } from '@jbrowse/core/ui/Icons'
import { colorScaleIsEmpty } from '@jbrowse/core/ui/colorScale'
import {
  getDialogHost,
  getPaletteHost,
  getSession,
  isFeature,
  pluralize,
} from '@jbrowse/core/util'
import { createAdapterMetadataFetch } from '@jbrowse/core/util/adapterMetadata'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import {
  activeJexlFilters,
  configuredJexlFilters,
  jexlFilterNarrowing,
} from '@jbrowse/core/util/jexlFilters'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import HeightModeMixin from '@jbrowse/display-kit/HeightModeMixin'
import HiddenGroupsMixin from '@jbrowse/display-kit/HiddenGroupsMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { colorSpecOf } from '@jbrowse/display-kit/channelSpec'
import {
  colorForField,
  colorForValue,
} from '@jbrowse/display-kit/colorConfigSchema'
import { densityTierMenuItems } from '@jbrowse/display-kit/densityTierMenu'
import {
  autorunOnReadyView,
  onDisplayedRegionsChange,
} from '@jbrowse/display-kit/displayAutoruns'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { cast, getEnv, isAlive, types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { installUpload } from '@jbrowse/render-core/installUpload'
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { toJS } from 'mobx'

import { themedColorTable } from '../RenderFeatureDataRPC/colorClasses.ts'
import { labelFontSize } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import {
  THEME_DERIVED_COLOR,
  pickDisplayConfig,
} from '../RenderFeatureDataRPC/renderConfig.ts'
import { shouldRenderPeptideBackground } from '../RenderFeatureDataRPC/zoomThresholds.ts'
import CanvasFeatureGateMixin from '../shared/CanvasFeatureGateMixin.ts'
import DensityBandMixin from '../shared/DensityBandMixin.ts'
import { featureColorViews } from '../shared/featureColorViews.ts'
import {
  featureSpanRegion,
  fetchCanvasFeatureDetails,
} from '../shared/fetchCanvasFeatureDetails.ts'
import { fetchGatedRegions } from '../shared/fetchGatedRegions.ts'
import { createCanvasFeatureDetailsOpener } from '../shared/openCanvasFeatureDetails.ts'
import { scaleLaidOutData } from './applyLayout.ts'
import { findSubfeatureById, indexById } from './baseModelHelpers.ts'
import {
  CHANNEL_SPEC_EXAMPLES,
  channelSpecProblems,
  facetOf,
  filterOf,
} from './channelSpec.ts'
import { colorViews } from './colorViews.ts'
import {
  buildFeatureFlatbushIndex,
  buildSubfeatureFlatbushIndex,
} from './components/hitTesting.ts'
import { labelScrollBucket } from './components/labelPositioning.ts'
import {
  resolveOutlineColor,
  resolveRegionColors,
} from './components/resolveRegionColors.ts'
import { derivedColorKey } from './derivedColorKey.ts'
import { facetField, featureGroupSections, sectionIdsOf } from './facet.ts'
import { featureContextMenuItems } from './featureContextMenu.ts'
import { FeatureHighlightModel } from './featureHighlight.ts'
import {
  buildRegionInstanceIndex,
  featureHighlightInk,
} from './featureHighlightInk.ts'
import {
  featureHighlightActions,
  featureHighlightViews,
} from './featureHighlightViews.ts'
import { featureSetActions, featureSetViews } from './featureSetViews.ts'
import {
  EMPTY_LAID_OUT_DATA,
  fitLadderViews,
  fitLadderVolatiles,
} from './fitLadderViews.ts'
import { fitDrops, fitLadderNote, labelsFitHint } from './fitNotes.ts'
import { heightViews } from './heightViews.ts'
import { layoutRegionKey } from './layoutInputs.ts'
import { featureIdsTouchingBlocks } from './layoutQueries.ts'
import { scanGroupByCandidates } from './scanGroupByCandidates.ts'
import { modeCanShowDescription, modeCanShowName } from './showLabelsMode.ts'
import {
  canvasTrackMenuItems,
  colorBySubMenuItems,
  colorMenuItems,
  featureHeightMenuItems,
  showSubmenuCheckboxItems,
  showSubmenuRadioGroups,
} from './trackMenus.ts'
import {
  installYMorphAutorun,
  yMorphActions,
  yMorphViews,
  yMorphVolatiles,
} from './yMorphViews.ts'

import type { IsoformPicks } from '../RenderFeatureDataRPC/isoformPicks.ts'
import type {
  DisplayMode,
  SubfeatureLabels,
} from '../RenderFeatureDataRPC/renderConfig.ts'
// Importing any type from rpcTypes.ts pulls in its RpcRegistry augmentation,
// which types `rpcManager.call()`.
import type {
  FeatureDataResult,
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LinearCanvasBaseDisplayConfigModel } from './baseConfigSchema.ts'
import type { CanvasFeatureRenderingBackend } from './components/canvasFeatureRenderingBackendTypes.ts'
import type {
  FeatureItemEntry,
  FlatbushRegionIndexes,
} from './components/hitTesting.ts'
import type { FeatureFacet, FeatureGroupSection } from './facet.ts'
import type { FeatureContextMenuInfo } from './featureContextMenu.ts'
import type { RegionInstanceIndex } from './featureHighlightInk.ts'
import type { GeneGlyphMode } from './geneGlyphMode.ts'
import type { GroupByScanOptions } from './scanGroupByCandidates.ts'
import type { ShowLabelsMode } from './showLabelsMode.ts'
import type { SequenceHoverPosition } from '@jbrowse/core/BaseFeatureWidget'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Reversibles } from '@jbrowse/core/ui/filterMenuItems'
import type {
  Feature,
  ParentFeatureSummary,
  Region,
  StatusCallback,
} from '@jbrowse/core/util'
import type { ChannelSpec } from '@jbrowse/display-kit/channelSpec'
import type { HighlightRect } from '@jbrowse/display-kit/highlightHost'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

// Region identity rides in the stored payload: the layout groups by ref, and
// a canonical refName is not what `Region.refName` carries.
type LoadedFeatureData = FeatureDataResult & {
  regionKey: string
  assemblyName: string
  refName: string
  reversed: boolean
}

function loadedFeatureData(
  data: FeatureDataResult,
  region: Region,
): LoadedFeatureData {
  return {
    ...data,
    regionKey: layoutRegionKey(region),
    assemblyName: region.assemblyName,
    refName: region.refName,
    reversed: !!region.reversed,
  }
}

export interface GeneGlyphNotice {
  collapsed: boolean
  maxIsoforms?: number
  picks?: IsoformPicks
  dismissed: boolean
  mode: GeneGlyphMode
  setMode: (mode: GeneGlyphMode) => void
  dismiss: () => void
}

export type { Region } from '@jbrowse/core/util'
// Views return these, and a subclass in another package needs a path to them to
// emit its own declarations.
export type { LabelReservation } from './fitLadder.ts'
export type { RegionInstanceIndex } from './featureHighlightInk.ts'
export type { FeatureFacet, FeatureGroupSection } from './facet.ts'
export type { GroupByCandidate } from '../RenderFeatureDataRPC/groupByCandidates.ts'
export type { GroupByScanOptions } from './scanGroupByCandidates.ts'
export type { WorkerColor } from '../RenderFeatureDataRPC/renderConfig.ts'
// Off this subpath rather than the barrel, so a subclass composing its own
// "Color by..." presets holds no value edge into the eager entry.
export { defaultColorItem } from './trackMenus.ts'

const ColorByAttributeDialog = lazy(
  () => import('./components/ColorByAttributeDialog.tsx'),
)
const GroupByDialog = lazy(() => import('./components/GroupByDialog.tsx'))
const ChannelSpecDialog = lazy(
  () => import('@jbrowse/display-kit/ChannelSpecDialog'),
)
const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))
const JexlFilterDialog = lazy(() => import('@jbrowse/core/ui/JexlFilterDialog'))

/**
 * #stateModel LinearCanvasBaseDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * #category display
 * Shared GPU-accelerated feature display base for canvas-rendered tracks.
 */
export default function baseStateModelFactory(
  configSchema: LinearCanvasBaseDisplayConfigModel,
) {
  return types
    .compose(
      'LinearCanvasBaseDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      HeightModeMixin(),
      MultiRegionDisplayMixin(),
      LegendMixin(),
      CanvasFeatureGateMixin(),
      // After both gate mixins, since it keys off their verdict.
      DensityBandMixin(),
      ContextMenuMixin<FeatureContextMenuInfo>(),
      HiddenGroupsMixin(),
      types.model({
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * Runtime "Filter by..." override.
         */
        jexlFiltersSetting: types.maybe(types.array(types.string)),
        /**
         * #property
         * Feature ids the user pinned to the top of the layout via the
         * feature right-click menu.
         */
        pinnedFeatureIds: types.stripDefault(types.array(types.string), []),
        /**
         * #property
         * "Show only these features": the collected set the user builds by
         * ctrl+clicking features (or via the right-click menu).
         */
        soloFeatureIds: types.stripDefault(types.array(types.string), []),
        /**
         * #property
         * Whether the collected soloFeatureIds set is actually isolating
         * the view (worker drops non-members).
         */
        soloApplied: types.stripDefault(types.boolean, false),
        /**
         * #property
         * "Hide this feature" exclusion set (inverse of solo): the worker
         * drops these from layout/drawing.
         */
        hiddenFeatureIds: types.stripDefault(types.array(types.string), []),
        /**
         * #property
         * Genes the user opened from the isoform badge on their own label:
         * these draw every isoform whatever `geneGlyphMode` or the fit
         * ladder's isoform rung would otherwise collapse them to.
         */
        expandedGeneIds: types.stripDefault(types.array(types.string), []),
        /**
         * #property
         * Declarative feature highlights, typically seeded by a text search
         * (highlight the gene you searched for).
         */
        featureHighlights: types.stripDefault(
          types.array(FeatureHighlightModel),
          [],
        ),
      }),
    )
    .volatile(() => ({
      // #region volatile
      /**
       * #volatile
       */
      featureIdUnderMouse: undefined as string | undefined,
      /**
       * #volatile
       */
      subfeatureIdUnderMouse: undefined as string | undefined,
      /**
       * #volatile
       * the hover tooltip's rows, each rendered as its own element — see
       * hoverTooltipRows for why this is a list and not one HTML string
       */
      mouseoverExtraInformation: undefined as string[] | undefined,
      /**
       * #volatile
       * genomic base currently hovered in a feature sequence dialog opened
       * from this display, read by the LGV crosshair overlay
       */
      sequenceHoverPosition: undefined as SequenceHoverPosition | undefined,
      // #endregion
    }))
    .volatile(fitLadderVolatiles)
    .volatile(yMorphVolatiles)
    .views(self => ({
      /**
       * #getter
       * The fetched features, keyed by displayedRegionIndex — the
       * foundation's per-region store, narrowed.
       */
      get rpcDataMap(): ReadonlyMap<number, LoadedFeatureData> {
        return self.regionPayloads as ReadonlyMap<number, LoadedFeatureData>
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the config typed off the concrete schema; `ConfigurationReference`
       * erases `self.configuration` to `any`, so direct reads route through
       * this to stay typed (same move as `BaseAdapter<CONF>`).
       */
      get conf(): Instance<LinearCanvasBaseDisplayConfigModel> {
        return self.configuration
      },

      /**
       * #method
       * What the `jexlFilters` config slot alone declares,
       * `jexl:`-prefixed.
       */
      configuredFilters(): string[] {
        return configuredJexlFilters(self)
      },
    }))
    .views(featureColorViews)
    .views(colorViews)
    .views(() => ({
      /**
       * #getter
       * Overridable hook (default absent): the isoform-collapse control the
       * shared canvas body draws in its bottom-right chip stack, or nothing
       * when the display has no gene glyphs.
       */
      get geneGlyphNotice(): GeneGlyphNotice | undefined {
        return undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether features can be laid out: data is fetched, in-bounds, and
       * the view is measured.
       */
      get layoutReady() {
        return (
          !self.regionTooLarge &&
          containingLgv(self).initialized &&
          self.rpcDataMap.size > 0
        )
      },
      /**
       * #getter
       * The features whose bp span touches the viewport.
       */
      get onScreenFeatureIds(): ReadonlySet<string> | undefined {
        if (!self.layoutReady) {
          return undefined
        }
        const blocks = containingLgv(self).coarseDynamicBlocks
        return blocks.length === 0
          ? undefined
          : featureIdsTouchingBlocks(self.rpcDataMap.values(), blocks)
      },
      /**
       * #getter
       * Features per pixel of what is actually ON SCREEN — the density the
       * `auto` label modes gate on (ADR-093).
       */
      get labelDensityPerPx() {
        const ids = this.onScreenFeatureIds
        if (!ids) {
          return self.visibleFeatureDensityPerPx
        }
        let widthPx = 0
        for (const block of containingLgv(self).coarseDynamicBlocks) {
          widthPx += block.widthPx
        }
        return widthPx > 0
          ? ids.size / widthPx
          : self.visibleFeatureDensityPerPx
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get renderState() {
        return {
          scrollY: self.scrollTop,
          canvasWidth: self.canvasWidthPx,
          canvasHeight: self.height,
          outlineColor: resolveOutlineColor(
            self.outlineColorSlot,
            getPaletteHost(self).palette,
          ),
          hideChevrons: !this.displayDirectionalChevrons,
        }
      },

      /**
       * #getter
       * Overridable hook (default on): whether intron lines carry chevrons.
       * Drawn from the render state, not baked by the worker, so the toggle
       * refetches nothing.
       */
      get displayDirectionalChevrons(): boolean {
        return true
      },

      /**
       * #getter
       */
      // A coarse bucket, not raw scrollTop, so the label overlay only
      // rebuilds once the user scrolls a full bucket.
      get labelScrollBucket() {
        return labelScrollBucket(self.scrollTop)
      },

      /**
       * #getter
       */
      get displayMode(): DisplayMode {
        return getConf(self, 'displayMode')
      },

      /**
       * #getter
       * The `facet` object as written, or undefined while ungrouped.
       */
      get facet(): FeatureFacet | undefined {
        return facetSettingOf({
          field: getConf(self, ['facet', 'field']),
          domain: getConf(self, ['facet', 'domain']),
        })
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
       * Overridable hook (default none): the subfeature-label mode the worker
       * bakes.
       */
      get effectiveSubfeatureLabels(): SubfeatureLabels {
        return 'none'
      },

      /**
       * #getter
       */
      get labelFontSize() {
        return labelFontSize(this.displayMode)
      },

      /**
       * #getter
       */
      get showLabelsMode() {
        return getConf(self, 'showLabels')
      },

      /**
       * #getter
       */
      // Gated here rather than only at `renderedShowLabels`, so layout, hit
      // testing, the DOM overlay and the SVG export agree; otherwise rows
      // reserve label height nothing uses.
      get showLabels() {
        const mode = this.showLabelsMode
        return (
          this.displayMode !== 'collapsed' &&
          modeCanShowName(mode) &&
          (mode !== 'auto' ||
            self.labelDensityPerPx <= getConf(self, 'maxLabelFeatureDensity'))
        )
      },

      /**
       * #getter
       */
      // The persisted intent, before the density gate and collapsed mode
      // have a say, so the track menu's radio reflects the user's choice.
      get showDescriptions() {
        return modeCanShowDescription(this.showLabelsMode)
      },

      /**
       * #getter
       */
      get effectiveShowDescriptions() {
        // Anded with `showLabels` so a config that inverts the two
        // thresholds cannot leave descriptions painting after names are
        // gone; the pinned modes skip the density gate, `description`
        // included.
        return (
          this.displayMode !== 'collapsed' &&
          this.showDescriptions &&
          (this.showLabelsMode !== 'auto' ||
            (this.showLabels &&
              self.labelDensityPerPx <=
                getConf(self, 'maxDescriptionFeatureDensity')))
        )
      },

      /**
       * #getter
       */
      get selectedFeatureId() {
        const selection = isAlive(self) ? getSession(self).selection : undefined
        return isFeature(selection) ? selection.id() : undefined
      },

      /**
       * #getter
       */
      get colorByCDS() {
        const view = containingLgv(self)
        return view.colorByCDS
      },

      /**
       * #getter
       */
      get showAminoAcids() {
        const view = containingLgv(self)
        return view.showAminoAcids
      },

      /**
       * #method
       * The filters actually applied, as `jexl:`-prefixed expressions — see
       * `activeJexlFilters`, which is the shared two-tier resolution.
       */
      activeFilters(): string[] {
        return activeJexlFilters(self)
      },

      /**
       * #getter
       */
      get reversedRegions() {
        const set = new Set<number>()
        for (const [num, data] of self.rpcDataMap) {
          if (data.reversed) {
            set.add(num)
          }
        }
        return set
      },
    }))
    .views(featureSetViews)
    .views(featureHighlightViews)
    .views(self => ({
      /**
       * #method
       */
      // Every field read here is an RPC cache key: the settings autorun
      // clears data when any of them changes.
      rpcProps() {
        // Picked rather than filtered: the snapshot carries every slot the
        // schema and its bases declare, and the subtractive spelling made
        // every slot nobody excluded a silent refetch trigger. The gate
        // budgets are not cache keys; as one, `maxFeatureDensity` made
        // zooming across the 20 kb floor a full clear and refetch, and a
        // raised budget already reaches the verdict through the tracked
        // `regionTooLarge`.
        const snapshot = fullConfSnapshot(self.configuration)
        const workerConfig = pickDisplayConfig(snapshot)
        return {
          // Reading `activeFilters()` here makes it a cache key, so
          // toggling filters refetches.
          displayConfig: {
            ...workerConfig,
            subfeatureLabels: self.effectiveSubfeatureLabels,
            jexlFilters: self.activeFilters(),
            // A facet other than strand needs a stamp per feature, so only
            // it joins the cache key: a strand facet never refetches.
            ...(self.facet === undefined || self.facet.field === STRAND_FIELD
              ? {}
              : { facetField: self.facet.field }),
          },
          colorByCDS: self.colorByCDS,
          // Undefined while collecting, so building the set neither
          // refetches nor hides anything.
          soloFeatureIds:
            self.soloApplied && self.soloFeatureIds.length > 0
              ? toJS(self.soloFeatureIds)
              : undefined,
          hiddenFeatureIds:
            self.hiddenFeatureIds.length > 0
              ? toJS(self.hiddenFeatureIds)
              : undefined,
        }
      },

      /**
       * #method
       * What the main-thread encode needs beyond a region's own data: the
       * packed color for every theme class the worker emitted, off
       * `session.palette`, and the color field's scale, so a theme toggle or
       * a recolor re-encodes what is loaded instead of refetching it.
       */
      gpuProps() {
        return {
          colorTable: themedColorTable(getPaletteHost(self).palette),
          fieldPalette: self.fieldPalette,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Layout inputs shared by the base layout and every fit rung,
       * `expandedGeneIds` included: a rung inheriting them without the
       * exemption re-collapses the gene the user just opened.
       */
      get layoutInputs() {
        const view = containingLgv(self)
        return {
          bpPerPx: view.coarseBpPerPx,
          reversedRegions: self.reversedRegions,
          displayMode: self.displayMode,
          pinnedFeatureIds: self.layoutPinnedFeatureIdSet,
          expandedGeneIds: self.expandedGeneIdSet,
          facet: self.facet,
          hiddenGroupKeys: self.hiddenGroupKeys,
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
       * Overridable hook (default false): the display's transcript setting
       * names every isoform, so the fit ladder's `isoforms` rung may not
       * trim — the surplus scrolls instead.
       */
      get showsEveryIsoform() {
        return false
      },
      /**
       * #getter
       * Overridable hook (default all): the gene-glyph mode the worker
       * collapses under.
       */
      get effectiveGeneGlyphMode(): GeneGlyphMode {
        return 'all'
      },
      /**
       * #getter
       * Whether the settings reserve `below` subfeature-label rows, which
       * is what earns the fit ladder its `bare` rung — with nothing
       * reserved the rung would repack an identical stack.
       */
      get reservesBelowLabelRows() {
        return self.effectiveSubfeatureLabels === 'below'
      },
    }))
    .views(fitLadderViews)
    .views(self => ({
      /**
       * #getter
       * Uniform vertical scale for fit mode; below 1 only while the stack is
       * squeezed to fit.
       */
      get fitScale() {
        return self.fitStage.scale
      },
      /**
       * #getter
       * What every consumer (hit test, GPU upload, React render) reads: the
       * resolved fit layout, cloned and scaled only when squeezed.
       */
      get laidOutDataMap(): ReadonlyMap<number, FeatureDataResult> {
        const { layout, scale } = self.fitStage
        const { facet } = self
        return self.coarseTierStandsIn
          ? EMPTY_LAID_OUT_DATA
          : scale === 1
            ? layout
            : scaleLaidOutData(
                layout,
                scale,
                facet && { facet, chipPx: GROUP_LABEL_HEIGHT },
              )
      },
      /**
       * #getter
       * The stacked sections in stacking order, each with the chip row
       * the packer reserved above it, read off the same rows the glyphs
       * paint; empty while ungrouped.
       */
      get groupSections(): FeatureGroupSection[] {
        const { facet } = self
        return facet
          ? featureGroupSections(this.laidOutDataMap, facet, GROUP_LABEL_HEIGHT)
          : []
      },
      /**
       * #getter
       * The features of the sections the user hid, which sit unplaced by
       * choice and so count as nothing the track failed to show.
       */
      get hiddenGroupFeatureIds(): ReadonlySet<string> | undefined {
        const { facet, hiddenGroupKeys } = self
        if (!facet || hiddenGroupKeys.size === 0) {
          return undefined
        }
        const sectionOf = sectionIdsOf(this.laidOutDataMap, facet)
        const ids = new Set<string>()
        for (const data of this.laidOutDataMap.values()) {
          for (const item of data.flatbushItems) {
            if (hiddenGroupKeys.has(sectionOf(item).key)) {
              ids.add(item.featureId)
            }
          }
        }
        return ids
      },
      /**
       * #getter
       * Whether the section chips and dividers draw: a grouping is set and
       * the layout produced a section for it.
       */
      get showsGroupLabels() {
        return this.groupSections.length > 0
      },
      /**
       * #getter
       * A grouped track puts its track label above the plot, where it
       * cannot cover the first section's chip. Reads the setting, not the
       * sections, so the label does not jump when data lands.
       */
      get prefersOffset() {
        return self.facet !== undefined
      },
      /**
       * #getter
       * Descriptions are painted where the kept rung reserved room for
       * them.
       */
      get renderedShowDescriptions() {
        return self.fitStage.showDescriptions
      },
      /**
       * #getter
       * Names are painted where the kept rung reserved row height +
       * overhang for them.
       */
      get renderedShowLabels() {
        return self.fitStage.showLabels
      },
      /**
       * #getter
       * A subfeature label (a transcript name under its gene) is
       * worker-baked and its row is reserved in the pack, so it survives
       * every rung that kept those rows and goes only where the kept rung
       * spent them at zero.
       */
      get renderedShowSubfeatureLabels() {
        const { scale, dropBelowLabelRows } = self.fitStage
        return scale === 1 && !dropBelowLabelRows
      },
      /**
       * #getter
       * The size the kept rung priced its labels at, and so the size they
       * draw at.
       */
      // Zero at the `bare` rung, which spends the below-label rows at no
      // height and so reserves no label width; a hit box or highlight
      // measuring at the mode's size overhangs its neighbour by an ungated
      // subfeature label nothing drew.
      get renderedLabelFontSize() {
        return self.fitStage.dropBelowLabelRows ? 0 : self.labelFontSize
      },
      /**
       * #getter
       * What the ladder took from the labels the settings reserved, and how
       * far it squeezed — the one derivation both user-facing notes read.
       */
      get fitDrops() {
        return fitDrops(
          self.fitStage,
          self.showLabels,
          self.effectiveShowDescriptions,
          // Solving for one costs a bisection, and only this rung reports
          // it.
          self.fitStage.level === 'decimated'
            ? self.fitDecimatedFactor
            : undefined,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The track-sizing control's account of what fit mode gave up, or
       * undefined when nothing.
       */
      get fitNote() {
        return fitLadderNote(self.fitDrops)
      },
      /**
       * #getter
       * The note on the selected "Labels" radio while the ladder is not
       * honouring it (see `inertLabelHint`).
       */
      get labelsFitHint() {
        return labelsFitHint(self.fitDrops)
      },
    }))
    .views(yMorphViews)
    .actions(yMorphActions)
    .views(heightViews)
    .views(self => ({
      /**
       * #getter
       */
      get featureIdIndex() {
        return indexById(self.laidOutDataMap, d => d.flatbushItems)
      },

      /**
       * #getter
       */
      get subfeatureIdIndex() {
        return indexById(self.laidOutDataMap, d => d.subfeatureInfos)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get hoveredFeature() {
        const id = self.featureIdUnderMouse
        return id === undefined ? undefined : self.featureIdIndex.get(id)
      },

      /**
       * #getter
       */
      get hoveredSubfeature() {
        const id = self.subfeatureIdUnderMouse
        return id === undefined ? undefined : self.subfeatureIdIndex.get(id)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The feature the hover box frames: the open context menu's target
       * while one is open, so the box always agrees with what the menu acts
       * on, else the feature under the cursor.
       */
      get hoverBoxFeature() {
        const info = self.contextMenuInfo
        return info ? info.item : self.hoveredFeature
      },
      /**
       * #getter
       * The transcript the hover box frames instead of its gene, by the
       * rule of `hoverBoxFeature`.
       */
      get hoverBoxSubfeature() {
        const info = self.contextMenuInfo
        return info ? info.subfeature : self.hoveredSubfeature
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Feature and subfeature ids to the primitives they painted, per
       * laid-out region. Deliberately held by no autorun: nothing builds it
       * until a hover or a selection asks which instances to light.
       */
      get regionInstanceIndexes(): ReadonlyMap<number, RegionInstanceIndex> {
        const map = new Map<number, RegionInstanceIndex>()
        for (const [idx, data] of self.laidOutDataMap) {
          map.set(idx, buildRegionInstanceIndex(data))
        }
        return map
      },
    }))
    .views(self => ({
      /**
       * #getter
       * What the chrome lights under the pointer: the open context menu's
       * target while one is open, else the hovered subfeature, else the
       * hovered feature — one box per region over its glyph and its labels.
       */
      get hoverInk(): HighlightRect[] {
        const item = self.hoverBoxSubfeature ?? self.hoverBoxFeature
        return featureHighlightInk(self, item ? [item.featureId] : [])
      },
      /**
       * #getter
       * The session's selected feature, boxed the same way.
       */
      get selectionInk(): HighlightRect[] {
        const id = self.selectedFeatureId
        return featureHighlightInk(self, id === undefined ? [] : [id])
      },
      /**
       * #getter
       * Every feature the user pinned — a search hit, a right-click
       * highlight, the `highlight=` URL param — boxed the same way. The one
       * highlight list the SVG export draws.
       */
      get pinnedInk(): HighlightRect[] {
        return featureHighlightInk(self, self.highlightedFeatureIdSet)
      },
      /**
       * #getter
       * The features collected for a solo, boxed the same way, while the
       * solo is still pending. Empty once it applies, since the view then
       * shows only these.
       */
      get soloInk(): HighlightRect[] {
        return self.soloApplied
          ? []
          : featureHighlightInk(self, self.soloFeatureIdSet)
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      searchFeatureByID(id: string) {
        const item = self.featureIdIndex.get(id)
        if (!item) {
          return undefined
        }
        return [item.startBp, item.topPx, item.endBp, item.bottomPx] as const
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      // Keyed off the loaded payloads rather than `visibleRegions`, which
      // is a fresh array every pan frame: the two overlays that read this
      // would otherwise rebuild it per frame of every gesture. Feature wins
      // over subfeature on id collision, so the feature `set` is
      // unconditional; a spanning feature resolves to the last region's
      // copy here and the first in `indexById`, which is harmless because
      // the copies are interchangeable.
      get featureItemMap(): Map<string, FeatureItemEntry> {
        const map = new Map<string, FeatureItemEntry>()
        for (const [idx, { assemblyName, refName }] of self.rpcDataMap) {
          const data = self.laidOutDataMap.get(idx)
          if (!data) {
            continue
          }
          const source = { assemblyName, refName }
          for (const f of data.flatbushItems) {
            map.set(f.featureId, { kind: 'feature', item: f, source })
          }
          for (const s of data.subfeatureInfos) {
            if (!map.has(s.featureId)) {
              map.set(s.featureId, { kind: 'subfeature', item: s, source })
            }
          }
        }
        return map
      },

      /**
       * #getter
       */
      // MobX caches this only because afterAttach keeps an autorun
      // subscribed: an unobserved computed is suspended and re-evaluates on
      // every read, which rebuilt a Hilbert-sorted index per mousemove.
      // `coarseBpPerPx`, not live `bpPerPx`, matching the geometry the rows
      // were packed at.
      get flatbushIndexes() {
        const bpPerPx = containingLgv(self).coarseBpPerPx
        const labels = {
          showLabels: self.renderedShowLabels,
          showDescriptions: self.renderedShowDescriptions,
          fontSize: self.renderedLabelFontSize,
        }
        const result = new Map<number, FlatbushRegionIndexes>()
        for (const [idx, data] of self.laidOutDataMap) {
          result.set(idx, {
            feature: buildFeatureFlatbushIndex(
              data.flatbushItems,
              data.floatingLabelsData,
              bpPerPx,
              self.reversedRegions.has(idx),
              labels,
            ),
            subfeature: buildSubfeatureFlatbushIndex(data.subfeatureInfos),
          })
        }
        return result
      },
      /**
       * #method
       */
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Stage a region as fetched — the store's raw write with this
       * display's payload shape, so a test stands up a loaded display in
       * one call.
       */
      setRpcData(
        displayedRegionIndex: number,
        data: FeatureDataResult,
        region: Region,
      ) {
        self.setLoadedRegion(
          displayedRegionIndex,
          region,
          loadedFeatureData(data, region),
        )
      },

      // Deliberately no `clearDisplaySpecificData` override:
      // `clearAllRpcData` fires on same-region refetches, and zeroing
      // scroll or the gate's density stats there yanks the viewport and
      // flickers the banner on every zoom.
      /**
       * #action
       */
      startRenderingBackend(backend: CanvasFeatureRenderingBackend) {
        // `renderDataMap` is `laidOutDataMap` by reference when idle and
        // fresh per-frame objects during a Y morph, so only changed regions
        // re-upload.
        installUpload(self, backend, {
          cells: () => self.renderDataMap,
          inputs: () => self.gpuProps(),
          encode: (data, { colorTable, fieldPalette }) =>
            resolveRegionColors(data, colorTable, fieldPalette),
          render: (b, encoded) =>
            b.renderBlocks(self.renderBlocks, encoded, self.renderState),
        })
      },
    }))
    .actions(featureSetActions)
    .actions(featureHighlightActions)
    .actions(self => {
      const superOpenContextMenu = self.openContextMenu
      return {
        /**
         * #action
         * Drops the hover first, so its tooltip does not sit under the
         * menu; the highlight box stays on the target through
         * `hoverBoxFeature`.
         */
        openContextMenu(info: FeatureContextMenuInfo) {
          self.clearHover()
          superOpenContextMenu(info)
        },
      }
    })
    .actions(self => {
      const openDetails = createCanvasFeatureDetailsOpener(self)
      return {
        /**
         * #action
         * Open the feature-details widget on what `fetch` resolves to, with
         * the adapter's header metadata beside it; a lookup that resolves
         * to nothing is reported as a miss.
         */
        openFeatureDetails(
          fetch: () => Promise<Feature | undefined>,
          parentFeature?: ParentFeatureSummary,
        ) {
          void openDetails(fetch, parentFeature)
        },

        /**
         * #action
         * Open the feature-details widget on a feature already in hand.
         */
        selectFeature(feature: Feature) {
          void openDetails(async () => feature)
        },

        /**
         * #action
         */
        clearSelection() {
          getSession(self).clearSelection()
        },

        /**
         * #action
         */
        setShowLabels(value: ShowLabelsMode) {
          setConf(self, 'showLabels', value)
        },

        /**
         * #action
         * Sets the runtime filter override (already-`jexl:`-prefixed
         * expressions).
         */
        setJexlFilters(filters?: string[]) {
          self.jexlFiltersSetting = cast(filters)
        },

        /**
         * #action
         */
        setShowOutline(value: boolean) {
          setConf(self, 'outlineColor', value ? THEME_DERIVED_COLOR : '')
        },

        /**
         * #action
         * Paints every feature one constant, a CSS color or a `jexl:`
         * callback; undefined lets each feature's own color paint. The field,
         * its order and range stay under `scale: 'none'` for the way back.
         */
        setFeatureColor(color?: string) {
          setConf(self, 'color', colorForValue(self.colorSettings, color))
        },

        /**
         * #action
         * Paints by a field's values through a categorical scale, keeping
         * `color.value` for the way back; undefined returns to that value.
         */
        setColorScale(scale?: {
          field: string
          domain?: readonly string[]
          range?: readonly string[]
        }) {
          const { value } = self.colorSettings
          setConf(
            self,
            'color',
            scale
              ? {
                  ...(value === undefined ? {} : { value }),
                  field: scale.field,
                  domain: [...(scale.domain ?? [])],
                  range: [...(scale.range ?? [])],
                }
              : colorForField(self.colorSettings, ''),
          )
        },

        /**
         * #action
         */
        // Skips no-op updates: mousemove fires per pixel but the base under
        // the cursor changes far less often.
        setSequenceHoverPosition(pos: SequenceHoverPosition | undefined) {
          const prev = self.sequenceHoverPosition
          const same =
            prev === pos ||
            (prev?.refName === pos?.refName &&
              prev?.start === pos?.start &&
              prev?.end === pos?.end)
          if (!same) {
            self.sequenceHoverPosition = pos
          }
        },
      }
    })
    .actions(self => {
      const fetchMetadata = createAdapterMetadataFetch(self)
      return {
        /**
         * #action
         */
        openFilterDialog() {
          getDialogHost(self).queueDialog(handleClose => [
            JexlFilterDialog,
            {
              model: self,
              handleClose,
              metadata: fetchMetadata().catch(() => undefined),
            },
          ])
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       */
      setDisplayMode(value: DisplayMode) {
        setConf(self, 'displayMode', value)
      },

      /**
       * #action
       * Writes the `facet` object, an unnamed domain as empty; undefined is
       * ungrouped. The stack starts over from the top.
       */
      setFacet(facet?: { field: string; domain?: readonly string[] }) {
        setConf(
          self,
          'facet',
          facet
            ? { field: facet.field, domain: [...(facet.domain ?? [])] }
            : {},
        )
        self.setScrollTop(0)
      },

      /**
       * #action
       */
      openSetColorDialog() {
        getDialogHost(self).queueDialog(handleClose => [
          SetColorDialog,
          { model: self, handleClose },
        ])
      },

      /**
       * #action
       */
      async fetchFullFeature(
        featureId: string,
        displayedRegionIndex: number,
        opts: {
          signal?: AbortSignal
          statusCallback?: StatusCallback
        } = {},
      ) {
        const region = self.loadedRegions.get(displayedRegionIndex)
        if (!region) {
          return undefined
        }
        // The feature's own span, not the buffered region: the whole region
        // is a second download of everything on screen.
        const item = self.featureIdIndex.get(featureId)
        return fetchCanvasFeatureDetails(
          getSession(self),
          getRpcSessionId(self),
          self.adapterConfig,
          featureId,
          item ? featureSpanRegion(region, item.startBp, item.endBp) : region,
          opts,
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       * Everything this display is doing to narrow what the user sees, each
       * declared once, so the "Filter by... (n)" count, its undo rows and
       * "Clear all filters" cannot disagree; a method, not a getter,
       * because a getter cannot be super-captured.
       */
      featureNarrowings(): Reversibles {
        return {
          jexlFilters: jexlFilterNarrowing(self),
          solo: {
            count: self.soloApplied ? 1 : 0,
            clear: () => {
              self.clearSolo()
            },
          },
          hiddenFeatures: {
            count: self.hiddenFeatureIds.length > 0 ? 1 : 0,
            label: () =>
              `Show ${self.hiddenFeatureCount} hidden ${pluralize(self.hiddenFeatureCount, self.featureNoun)}`,
            icon: VisibilityIcon,
            clear: () => {
              self.showAllHidden()
            },
          },
        }
      },

      /**
       * #method
       * Reversible state that MARKS features rather than hiding them — the
       * highlight boxes and the pins holding features at the top of the
       * layout.
       */
      featureMarks(): Reversibles {
        return {
          highlights: {
            count: self.featureHighlightCount,
            label: n => `Clear ${n} ${pluralize(n, 'highlight')}`,
            icon: Highlighter,
            clear: () => {
              self.clearFeatureHighlights()
            },
          },
          pinned: {
            count: self.pinnedFeatureCount,
            label: n => `Unpin ${n} ${pluralize(n, self.featureNoun)}`,
            icon: VerticalAlignTopIcon,
            clear: () => {
              self.clearPinnedFeatures()
            },
          },
        }
      },
    }))
    .views(self => ({
      /**
       * #method
       * The worker's zoom-dependent decisions, resolved: the RPC spreads this
       * object and the foundation stamps it beside each region, so a track
       * with the overlay off and a fixed mode never refetches on zoom.
       * `expandedGeneIds` only under `longestCoding`, the one mode the worker
       * collapses in.
       */
      zoomFetchArgs() {
        const geneGlyphMode = self.effectiveGeneGlyphMode
        return {
          geneGlyphMode,
          peptides:
            self.showAminoAcids &&
            shouldRenderPeptideBackground(containingLgv(self).bpPerPx),
          expandedGeneIds:
            geneGlyphMode === 'longestCoding' && self.expandedGeneIds.length > 0
              ? toJS(self.expandedGeneIds)
              : undefined,
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      // Always fetches `featureId`, the top-level id, not
      // `subfeatureInfo.parentFeatureId`: GetCanvasFeatureDetails searches
      // top-level features only, and `findSubfeatureById` recurses from the
      // root.
      selectFeatureById(
        featureId: string,
        subfeatureInfo: SubfeatureInfo | undefined,
        displayedRegionIndex: number,
      ) {
        // The name comes off the item the display drew, since the track's
        // `labels.name` expression decides what names a feature on screen.
        const drawn = subfeatureInfo
          ? self.featureIdIndex.get(featureId)
          : undefined
        self.openFeatureDetails(
          async () => {
            const parentFeature = await self.fetchFullFeature(
              featureId,
              displayedRegionIndex,
            )
            return parentFeature && subfeatureInfo
              ? (findSubfeatureById(parentFeature, subfeatureInfo.featureId) ??
                  parentFeature)
              : parentFeature
          },
          drawn?.name ? { name: drawn.name, type: drawn.type } : undefined,
        )
      },
    }))
    .actions(self => {
      const superReload = self.reload
      return {
        // `superReload()` is what bumps `reloadCounter`, the arming
        // mechanism of the dead-Retry check; skipping it turns that check
        // off with no symptom.
        /**
         * #action
         * Clears the loaded regions and fetches straight away, rather than
         * waiting out `FetchVisibleRegions`' 600ms debounce as the rest of
         * the family does — Retry and Force load are both clicks, and this
         * is the display the user is most often clicking on.
         */
        reload() {
          superReload()
          const view = containingLgv(self)
          if (view.initialized) {
            self.fetchNeeded(view.bufferedVisibleRegions)
          }
        },

        /**
         * #action
         */
        fetchNeeded(needed: IndexedRegion[]) {
          const view = containingLgv(self)
          const bpPerPx = view.bpPerPx
          // Not in `rpcProps()`, so a budget change is not a cache-key
          // invalidation.
          const maxFeatureDensity = self.maxFeatureDensity
          const args = rpcArgs(self)
          const zoomArgs = self.zoomFetchArgs()
          void fetchGatedRegions(self, needed, {
            call: (region, ctx) => {
              // The assembly's genetic code, so the worker can translate
              // peptides on contigs whose features carry no transl_table.
              const assembly = getSession(self).assemblyManager.get(
                region.assemblyName,
              )
              return ctx.callRpc('RenderFeatureData', {
                ...args,
                ...zoomArgs,
                geneticCodeId: assembly?.getGeneticCodeId(region.refName),
                region,
                bpPerPx,
                maxFeatureDensity,
              })
            },
            onResult: (_idx, result, region) =>
              loadedFeatureData(result, region),
          })
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * The grouping, color and filter as grammar-of-graphics channels, each
       * `null` while unset: what "Edit as JSON..." opens with.
       */
      get channelSpec(): ChannelSpec {
        return {
          facet: facetOf(self.facet),
          color: colorSpecOf(self.colorSettings),
          filter: filterOf(self.activeFilters()),
        }
      },
      /**
       * #getter
       * The key the color channel's scale derives from what the worker
       * painted, less the values only a hidden section painted, in the
       * sections' order where the facet reads the same field. An identity
       * scale's key is its `domain` colours whole, once anything is drawn.
       */
      get derivedColorScales(): ColorScale[] {
        const { colorKeyTitle } = self
        const ramp = self.rampColorScales('color')
        if (ramp.length > 0) {
          return ramp
        }
        const identity = self.identityKeyEntries
        if (identity.length > 0) {
          return [...self.rpcDataMap.values()].some(
            data => data.rectPositions.length > 0,
          )
            ? [
                {
                  kind: 'categorical',
                  id: 'color',
                  ...(colorKeyTitle ? { title: colorKeyTitle } : {}),
                  entries: identity,
                },
              ]
            : []
        }
        const scale = self.paintedColorField
        const { facet, hiddenGroupKeys, colorField } = self
        if (!scale) {
          return []
        }
        const sectionOf =
          facet && hiddenGroupKeys.size > 0
            ? sectionIdsOf(self.laidOutDataMap, facet)
            : undefined
        return derivedColorKey(
          scale,
          [...self.rpcDataMap.values()].filter(
            data => data.colorValues?.field === scale.field,
          ),
          sectionOf && (section => hiddenGroupKeys.has(sectionOf(section).key)),
          facet && facet.field === colorField?.field
            ? { ...facetField(facet), label: scale.label }
            : scale,
          colorKeyTitle,
        )
      },
      /**
       * #getter
       * `colorDomain` followed by the values the color key lists that it
       * does not, in the key's order and less the no-value row.
       */
      get pinnedColorDomain(): string[] {
        const { domain } = self.colorSettings
        const listed = new Set(domain)
        const keyed = this.derivedColorScales.flatMap(scale =>
          scale.kind === 'categorical'
            ? scale.entries
                .flatMap(e => e.values ?? [e.value])
                .filter(v => v !== '')
            : [],
        )
        return [...domain, ...keyed.filter(v => !listed.has(v))]
      },
      /**
       * #method
       * The Group by dialog's choice of field as channels: the facet, keeping
       * its domain while the field is the one already set, a color by the
       * field when ticked (left alone while it already paints, through any
       * scale), and no color when unticked over a categorical color that was
       * the facet's own.
       */
      groupByChannelSpec(
        field: string | undefined,
        colorByGroup: boolean,
      ): ChannelSpec {
        const colorField = self.colorField?.field ?? ''
        const painted = self.colorFieldName ?? ''
        const current = facetOf(self.facet)
        const wasGroupColor =
          colorField !== '' &&
          (colorField === current?.field || colorField === field)
        return {
          facet: field === current?.field ? current : field ? { field } : null,
          ...(colorByGroup && field
            ? field === painted
              ? {}
              : { color: { field } }
            : wasGroupColor
              ? { color: null }
              : {}),
        }
      },
      /**
       * #method
       * The attributes the features in view carry and the sections each
       * would make, for the Group by dialog: the render fetch's download
       * over the visible blocks, under the same admission and byte budget.
       */
      scanGroupByCandidates(opts: GroupByScanOptions) {
        return scanGroupByCandidates(self, opts)
      },
      /**
       * #getter
       */
      get channelSpecExamples() {
        return CHANNEL_SPEC_EXAMPLES
      },
      /**
       * #method
       */
      channelSpecProblems(spec: ChannelSpec) {
        return channelSpecProblems(
          spec,
          getEnv<{ pluginManager: PluginManager }>(self).pluginManager.jexl,
        )
      },
      /**
       * #getter
       * Overridable hook: the key while features draw, by default the one the
       * color channel's scale derives.
       */
      get featureColorScales(): ColorScale[] {
        return this.derivedColorScales
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `LegendMixin`'s hook: `featureColorScales`, or nothing while the
       * density band stands in, since the band paints no feature color.
       */
      get colorScales(): ColorScale[] {
        return self.coarseTierStandsIn ? [] : self.featureColorScales
      },
      /**
       * #getter
       * Overrides `LegendMixin`'s: the band standing in keeps the "Show
       * legend" toggle, since the key returns on zooming in.
       */
      get hasLegendKey(): boolean {
        return self.featureColorScales.some(scale => !colorScaleIsEmpty(scale))
      },
    }))
    .actions(self => ({
      /**
       * #action
       * The categorical analogue of the Score menu's "Pin current min/max"
       * (ADR-124): writes `pinnedColorDomain`, so every value the key lists
       * spends its own range color in key order, where the hash could give
       * two values one color.
       */
      pinColorDomain() {
        setConf(self, ['color', 'domain'], self.pinnedColorDomain)
      },
      /**
       * #action
       * What a menu or dialog naming only a field writes: the field, keeping
       * the domain and range while it is the field already painting.
       */
      colorByField(field: string) {
        setConf(self, 'color', colorForField(self.colorSettings, field))
      },
      /**
       * #action
       */
      openChannelSpecDialog(seed?: ChannelSpec) {
        getDialogHost(self).queueDialog(handleClose => [
          ChannelSpecDialog,
          { model: self, seed, handleClose },
        ])
      },
    }))
    .actions(self => ({
      /**
       * #action
       * What the Group by dialog applies: the channels its choice changes,
       * through the setters the menus use.
       */
      applyGroupBy(field: string | undefined, colorByGroup: boolean) {
        const { facet, color } = self.groupByChannelSpec(field, colorByGroup)
        if (facet !== undefined) {
          self.setFacet(facet ?? undefined)
        }
        if (color === null) {
          self.setColorScale()
        } else if (typeof color === 'string') {
          self.setFeatureColor(color)
        } else if (color !== undefined && 'field' in color) {
          self.colorByField(color.field)
        }
      },
      /**
       * #action
       */
      openColorByAttributeDialog() {
        getDialogHost(self).queueDialog(handleClose => [
          ColorByAttributeDialog,
          { model: self, handleClose },
        ])
      },
    }))
    .actions(self => {
      return {
        /**
         * #action
         * Fills `BaseDisplay`'s hover-clear hook, which the fetch
         * foundation's reaction calls on every viewport change.
         */
        clearHoveredFeature() {
          self.clearHover()
        },

        /**
         * #action
         */
        openGroupByDialog() {
          getDialogHost(self).queueDialog(handleClose => [
            GroupByDialog,
            {
              model: self,
              handleClose,
              color: self.colorSettings.value,
              colorField: self.colorFieldName ?? '',
            },
          ])
        },

        afterAttach() {
          // Reset scroll on a region-list change only; a same-region zoom
          // or pan keeps the user's scroll position.
          onDisplayedRegionsChange(
            self,
            () => {
              self.setScrollTop(0)
            },
            'CanvasResetScrollOnDisplayedRegions',
          )

          // Holding the hit-test indexes observed is the only reason MobX
          // caches them: MobX suspends an unobserved computed, and every
          // mousemove rebuilt a Flatbush per region. Safe to hold because
          // `flatbushIndexes` keys off the debounced `coarseBpPerPx`; a
          // getter reading live `visibleRegions` must not be held this way.
          autorunOnReadyView(
            self,
            () => {
              void self.flatbushIndexes
              void self.featureIdIndex
              void self.subfeatureIdIndex
            },
            { name: 'CanvasHitIndexes' },
          )

          installYMorphAutorun(self)
        },
      }
    })
    .views(self => ({
      /**
       * #method
       */
      showSubmenuCheckboxItems(): MenuItem[] {
        return showSubmenuCheckboxItems(self)
      },
      /**
       * #method
       */
      showSubmenuRadioGroups(): MenuItem[] {
        return showSubmenuRadioGroups(self)
      },
    }))
    .views(self => ({
      /**
       * #method
       * Flattened "Show..." submenu: all checkbox toggles first, then the
       * radio groups (each under its own subHeader).
       */
      showSubmenuMenuItems(): MenuItem[] {
        return [
          ...self.showSubmenuCheckboxItems(),
          ...self.showSubmenuRadioGroups(),
        ]
      },
    }))
    .views(self => ({
      /**
       * #method
       * The feature right-click menu (open details, zoom to, get sequence,
       * highlight scopes, pin/solo/hide, copy).
       */
      contextMenuItems(): MenuItem[] {
        return featureContextMenuItems(self)
      },

      /**
       * #method
       * The "Color by..." radio choices (solid/strand/attribute).
       */
      colorBySubMenuItems(): MenuItem[] {
        return colorBySubMenuItems(self)
      },
    }))
    .views(self => ({
      /**
       * #method
       * Color-related track menu entries: a single "Color by..." entry
       * whose radios pick the track's own color or a field, and whose
       * "Solid color..." item opens the solid+UTR color picker.
       */
      colorMenuItems(): MenuItem[] {
        return colorMenuItems(self)
      },

      /**
       * #method
       * One "Feature height" menu with two independent radio groups: the
       * size presets and, under a "Track sizing" subheader, how the track
       * responds when there are more features than fit.
       */
      featureHeightMenuItems(): MenuItem[] {
        return featureHeightMenuItems(self)
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      trackMenuItems(): MenuItem[] {
        return [...canvasTrackMenuItems(self), ...densityTierMenuItems(self)]
      },
    }))
}

type LinearCanvasBaseDisplayStateModel = ReturnType<
  typeof baseStateModelFactory
>
export type LinearCanvasBaseDisplayModel =
  Instance<LinearCanvasBaseDisplayStateModel>
