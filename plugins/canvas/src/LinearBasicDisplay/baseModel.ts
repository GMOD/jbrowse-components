import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  resolveConf,
  getConfigSnapshotWithPromotables,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { Highlighter } from '@jbrowse/core/ui/Icons'
import { activeCount, clearAll } from '@jbrowse/core/ui/filterMenuItems'
import {
  getDialogHost,
  getPaletteHost,
  getSession,
  isFeature,
  pluralize,
} from '@jbrowse/core/util'
import {
  activeJexlFilters,
  configuredJexlFilters,
  jexlFilterNarrowing,
} from '@jbrowse/core/util/jexlFilters'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import HeightModeMixin from '@jbrowse/display-kit/HeightModeMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { densityTierMenuItems } from '@jbrowse/display-kit/densityTierMenu'
import {
  autorunOnReadyView,
  onDisplayedRegionsChange,
} from '@jbrowse/display-kit/displayAutoruns'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { cast, isAlive, types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { regionDataMap } from '@jbrowse/render-core/regionDataMap'
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { toJS } from 'mobx'

import { themedColorTable } from '../RenderFeatureDataRPC/colorClasses.ts'
import {
  FEATURE_DEFAULT_COLOR,
  STRAND_COLOR_JEXL,
  UTR_DEFAULT_COLOR,
} from '../RenderFeatureDataRPC/featureColors.ts'
import { labelFontSize } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import {
  THEME_DERIVED_COLOR,
  pickDisplayConfig,
} from '../RenderFeatureDataRPC/renderConfig.ts'
import { shouldRenderPeptideBackground } from '../RenderFeatureDataRPC/zoomThresholds.ts'
import CanvasFeatureGateMixin from '../shared/CanvasFeatureGateMixin.ts'
import DensityBandMixin from '../shared/DensityBandMixin.ts'
import {
  featureSpanRegion,
  fetchCanvasFeatureDetails,
} from '../shared/fetchCanvasFeatureDetails.ts'
import { fetchGatedRegions } from '../shared/fetchGatedRegions.ts'
import { createCanvasFeatureDetailsOpener } from '../shared/openCanvasFeatureDetails.ts'
import { findSubfeatureById, indexById } from './baseModelHelpers.ts'
import {
  buildFeatureFlatbushIndex,
  buildSubfeatureFlatbushIndex,
} from './components/hitTesting.ts'
import { LABEL_CULL_BUCKET_PX } from './components/labelPositioning.ts'
import { resolveRegionColors } from './components/resolveRegionColors.ts'
import { featureContextMenuItems } from './featureContextMenu.ts'
import { FeatureHighlightModel } from './featureHighlight.ts'
import {
  featureHighlightActions,
  featureHighlightViews,
} from './featureHighlightViews.ts'
import { featureSetActions, featureSetViews } from './featureSetViews.ts'
import { snapFittedContentHeight } from './fitLadder.ts'
import { fitLadderViews, fitLadderVolatiles } from './fitLadderViews.ts'
import { fitDrops, fitLadderNote, labelsFitHint } from './fitNotes.ts'
import {
  countTruncatedFeatures,
  featureIdsTouchingBlocks,
  maxBottom,
  scaleLaidOutData,
} from './layout.ts'
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
  morphOffsetViews,
  yMorphActions,
  yMorphViews,
  yMorphVolatiles,
} from './yMorphViews.ts'

import type { IsoformPicks } from '../RenderFeatureDataRPC/isoformPicks.ts'
import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
// rpcTypes.ts also declares the RpcRegistry augmentation; importing any type
// from it is enough to make rpcManager.call() resolve to the typed args.
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
import type { FeatureContextMenuInfo } from './featureContextMenu.ts'
import type { GeneGlyphMode } from './geneGlyphMode.ts'
import type { ShowLabelsMode } from './showLabelsMode.ts'
import type { SequenceHoverPosition } from '@jbrowse/core/BaseFeatureWidget'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Reversibles } from '@jbrowse/core/ui/filterMenuItems'
import type {
  Feature,
  ParentFeatureSummary,
  Region,
  StatusCallback,
} from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

const EMPTY_LAID_OUT_DATA: ReadonlyMap<number, FeatureDataResult> = new Map()

// Region identity (regionKey/reversed) is stored alongside the data so layout
// grouping derives from rpcDataMap directly. Deriving it from loadedRegions
// instead would lag: loadedRegions is cleared on every settings change but
// rpcDataMap is preserved through the refetch window, and loadedRegions is
// populated one action after setRpcData. During that gap every region would
// collapse to one layout group and features from different refs would mis-stack.
type LoadedFeatureData = FeatureDataResult & {
  regionKey: string
  // canonical refName, kept alongside the raw features so a highlight can be
  // resolved to its uniqueId *before* layout (see highlightedFeatureIdSet)
  refName: string
  reversed: boolean
}

// The two pieces of optional chrome a canvas-family subclass can contribute to
// the shared body (see the `geneGlyphNotice` / `colorLegend` hooks). Each bundles
// its state with the actions that change it, so the component never reaches for a
// model field the display it's rendering might not have.
export interface GeneGlyphNotice {
  collapsed: boolean
  // the per-gene isoform cap, when a cap is what `collapsed` is about. Absent
  // for the `longestCoding` collapse, which is a mode rather than a number.
  maxIsoforms?: number
  // what chose the transcript the collapsed genes are showing, which is what the
  // chip names — a curated tag where the annotation carries one, else length
  picks?: IsoformPicks
  dismissed: boolean
  mode: GeneGlyphMode
  setMode: (mode: GeneGlyphMode) => void
  dismiss: () => void
}

export type { Region } from '@jbrowse/core/util'
// Off this subpath rather than the barrel, for the subclass that composes its
// own "Color by..." presets around it without a value edge into the eager entry.
export { defaultColorItem } from './trackMenus.ts'

const ColorByAttributeDialog = lazy(
  () => import('./components/ColorByAttributeDialog.tsx'),
)
const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))
const JexlFilterDialog = lazy(() => import('@jbrowse/core/ui/JexlFilterDialog'))

// Floor for GROW mode's target height, so a sparse or empty track doesn't shrink
// the track to a sliver. Nothing to do with the fit ladder below, which never
// resizes the track at all — `growTargetHeight` is its only reader, and the
// mixin's `growMaxHeight` slot is the ceiling at the other end of the clamp.
const MIN_GROW_HEIGHT = 50

/**
 * #stateModel LinearCanvasBaseDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * #category display
 *
 * Shared GPU-accelerated feature display base for canvas-rendered tracks.
 * Handles fetching, layout, the "Show labels" / "Show descriptions" UI, and
 * the fetch-invalidation autorun. Subclasses layer schema-specific properties
 * and menus via the showSubmenuMenuItems / trackMenuItems / contextMenuItems
 * super-extension pattern, and extend rpcProps() via the standard
 * super-capture pattern.
 */
export default function baseStateModelFactory(
  configSchema: LinearCanvasBaseDisplayConfigModel,
) {
  return (
    types
      .compose(
        'LinearCanvasBaseDisplay',
        BaseDisplay,
        TrackHeightMixin(),
        HeightModeMixin(),
        LegendMixin(),
        MultiRegionDisplayMixin(),
        // The feature-density axis of the region-too-large gate: the model-side
        // sibling of DisplayChrome. Supplies densityStatsPerRegion,
        // observedMaxDensity/visibleFeatureDensityPerPx, the `densityTooLarge`
        // override and the worker's `maxFeatureDensity` budget, plus the
        // commit/clear helpers — folded into the feature fetch below. The byte
        // axis and its `resolvedByteLimit()` budget are RegionTooLargeMixin's,
        // reached through MultiRegionDisplayMixin above.
        CanvasFeatureGateMixin(),
        // The density tier and the band it draws: where the verdict above
        // refuses the features, a track with a density sidecar draws features
        // per bin in the banner's place. After both gate mixins, since it keys
        // off their verdict.
        DensityBandMixin(),
        ContextMenuMixin<FeatureContextMenuInfo>(),
        types.model({
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
          /**
           * #property
           * Runtime "Filter by..." override. When set (even to an empty list) it
           * replaces the `jexlFilters` config slot; when undefined the config
           * default applies. Stored as already-`jexl:`-prefixed expressions
           * (runtime convention), unlike the deferred-evaluation config slot.
           */
          jexlFiltersSetting: types.maybe(types.array(types.string)),
          /**
           * #property
           * Feature ids the user pinned to the top of the layout via the feature
           * right-click menu. Pinned features are inserted first into the greedy
           * row-packer, so they hold the topmost rows in their bp range across
           * zoom re-packs (see packPreparedRef in layout.ts). stripDefault so a display
           * with nothing pinned omits the empty array from its snapshot.
           *
           * Persisted by uniqueId, which resolves back to the same feature after
           * a plain reload of the same remote file: every adapter id is
           * `adp-<configHash>` (idMaker over the config) plus a file byte offset
           * (tabix/BigBed) or a deterministic full-file parse index (plain
           * GFF3/BED/VCF). Caveat: NOT robust to editing a file read by a plain
           * (non-tabix) adapter (the indices shift), nor to local blob files
           * (their handleId changes each session — but a blob can't reload its
           * data across refresh anyway). Same basis for solo/hiddenFeatureIds.
           */
          pinnedFeatureIds: types.stripDefault(types.array(types.string), []),
          /**
           * #property
           * "Show only these features": the collected set the user builds by
           * ctrl+clicking features (or via the right-click menu). Only isolates
           * the view once `soloApplied` is true — before that it's a highlighted
           * selection that hides nothing, so the candidates stay clickable.
           * Persistent so a view can be opened pre-focused declaratively (e.g.
           * collapse-introns seeds it in the new view's snapshot). stripDefault
           * so an unfocused display omits the empty array from its snapshot.
           */
          soloFeatureIds: types.stripDefault(types.array(types.string), []),
          /**
           * #property
           * Whether the collected soloFeatureIds set is actually isolating the
           * view (worker drops non-members). Decoupled from collection so
           * building a multi-feature set doesn't hide the features mid-build.
           */
          soloApplied: types.stripDefault(types.boolean, false),
          /**
           * #property
           * "Hide this feature" exclusion set (inverse of solo): the worker
           * drops these from layout/drawing. Applies immediately per feature —
           * no collect-then-apply. Persistent like the solo set, so a hidden
           * feature stays hidden across reload/session save. stripDefault so a
           * display with nothing hidden omits the empty array from its snapshot.
           */
          hiddenFeatureIds: types.stripDefault(types.array(types.string), []),
          /**
           * #property
           * Genes the user opened from the isoform badge on their own label:
           * these draw every isoform whatever `geneGlyphMode` or the fit
           * ladder's isoform rung would otherwise collapse them to. A per-GENE override of a
           * track-wide setting, so the reader can open the one gene they are
           * reading without turning every other gene on screen into a stack.
           *
           * The worker reads it only under `longestCoding`, the one collapse
           * it still owns, so it is a `zoomFetchKey` term in that mode and a
           * call-site RPC argument rather than an `rpcProps` cache key: a
           * click there refetches the visible regions scrim-free, and a click
           * under `all` — where the main-thread trim already exempts the gene
           * — refetches nothing.
           *
           * Persistent and by uniqueId, on the same basis as
           * solo/hidden/pinnedFeatureIds; stripDefault so a display with nothing
           * opened omits the empty array from its snapshot.
           */
          expandedGeneIds: types.stripDefault(types.array(types.string), []),
          /**
           * #property
           * Declarative feature highlights, typically seeded by a text search
           * (highlight the gene you searched for). Each entry pins a feature by
           * its span+name signature rather than its uniqueId — a search result
           * carries no uniqueId to persist (unlike solo/hidden/pinned, which come
           * from a click on a rendered feature and so DO have a reload-stable id)
           * — and is resolved against rendered features on the main thread.
           * stripDefault so a display with no highlights omits it from snapshot.
           */
          featureHighlights: types.stripDefault(
            types.array(FeatureHighlightModel),
            [],
          ),
        }),
      )
      .volatile(() => ({
        /**
         * #volatile
         */
        rpcDataMap: regionDataMap<LoadedFeatureData>('rpcDataMap'),
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
      }))
      .volatile(fitLadderVolatiles)
      .volatile(yMorphVolatiles)
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
         * What the `jexlFilters` config slot alone declares, `jexl:`-prefixed.
         *
         * In its own block ahead of `activeFilters` / `featureFilterCount` so
         * both reach it through `self`: `featureFilterCount` is super-captured by
         * subclasses and called unbound, so a same-block `this` is undefined
         * there.
         */
        configuredFilters(): string[] {
          return configuredJexlFilters(self)
        },
      }))
      .views(() => ({
        /**
         * #getter
         * Overridable hook (default absent): the isoform-collapse control the
         * shared canvas body draws in its bottom-right chip stack, or nothing
         * when the display has no gene glyphs. Bundled — state plus the two
         * actions — because the real implementation reads a `geneGlyphMode`
         * config slot that only `LinearBasicDisplay`'s schema declares; the
         * variant display shares this body and simply doesn't answer.
         *
         * Chrome a subclass owns arrives through hooks like this rather than
         * through a per-subclass component, so one registered component serves
         * every canvas-family display and no plugin imports another's component.
         */
        get geneGlyphNotice(): GeneGlyphNotice | undefined {
          return undefined
        },
        /**
         * #getter
         * Overridable hook (default none): the color key to draw over the
         * canvas whenever the display's active coloring has one — variants'
         * consequence impact / SV type presets, the `legend` config slot.
         * Whether it shows is `LegendMixin`'s `showLegend`.
         */
        get colorLegend(): LegendItem[] {
          return []
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Whether features can be laid out: data is fetched, in-bounds, and the
         * view is measured. The shared readiness guard for every layout getter —
         * an empty stack until then, so the GPU upload autorun has nothing to
         * push and view-geometry getters aren't read before the view is measured.
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
         * The features whose bp span touches the viewport. Why that is not the
         * whole packed stack — and the matching rules — live with the pure
         * `featureIdsTouchingBlocks` in layout.ts; this getter is the reactive
         * half, deciding when to ask.
         *
         * Read off `coarseDynamicBlocks` (500ms debounced), like the layout's
         * `coarseBpPerPx`, so a pan re-measures once it settles instead of
         * breathing the whole stack every frame. Undefined until the view has
         * coarse blocks, which every consumer reads as "measure the whole
         * stack".
         *
         * Three things measure over it: the label density gate
         * (`labelDensityPerPx`), the fit/fixed ladder (`fitMeasureFeatureIds`)
         * and the scroll extent (`scrollExtentMaxY`).
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
         *
         * `visibleFeatureDensityPerPx`, which this replaces at those two call
         * sites, divides a region's feature count by its whole FETCHED span, so
         * labels toggled off the buffer's average and a refetch widening the
         * buffer moved the verdict without anything on screen changing. That
         * region average keeps its own job in the too-large gate
         * (`densityTooLarge`), and stands in here while there is no window to
         * measure — before data, or before the view has coarse blocks.
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
          }
        },

        /**
         * #getter
         */
        // Quantized scroll position for the floating-label vertical cull (see
        // labelCullBand). Deliberately a coarse bucket, not raw scrollTop: the
        // label overlay observes THIS so a scroll tick within the same bucket
        // leaves the value unchanged and MobX skips the (expensive) label
        // rebuild — labels only re-emit once the user scrolls a full bucket.
        get labelScrollBucket() {
          return Math.floor(self.scrollTop / LABEL_CULL_BUCKET_PX)
        },

        /**
         * #getter
         */
        // Feature height preset (normal/compact/superCompact). Promotable
        // sentinel enum (see baseConfigSchema.ts): resolveConf walks the
        // customized-track -> session-default -> `normal` cascade and always returns
        // a concrete preset, never the `inherit` sentinel.
        get displayMode(): DisplayMode {
          return resolveConf(self, 'displayMode')
        },

        /**
         * #getter
         */
        // Resolved label font size (px) for the current display mode. Single
        // source shared by layout row reservation, the DOM overlay, and the SVG
        // export so compact modes shrink label text without any of the three
        // paths drifting.
        get labelFontSize() {
          return labelFontSize(this.displayMode)
        },

        /**
         * #getter
         */
        get showLabelsMode() {
          return resolveConf(self, 'showLabels')
        },

        /**
         * #getter
         */
        // Effective name visibility used by layout, hit testing, the DOM
        // overlay, and SVG export. 'auto' switches to false once the ON-SCREEN
        // feature density crosses the readability threshold so layout-reserved
        // label space, the rendered DOM elements, and the hit-test geometry all
        // agree — otherwise rows reserve label height that never gets used.
        // Collapsed mode is a single-row overview, so it suppresses names
        // outright — gated here (not just at renderedShowLabels) so all four
        // consumers agree. Descriptions and subfeature labels are suppressed
        // separately (effectiveShowDescriptions / rpcProps).
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
        // Whether the chosen mode admits descriptions at all, before the
        // density gate and collapsed mode get a say — the persisted intent, so
        // the track menu's radio reflects the user's choice rather than what
        // this zoom happens to be painting. Render-time consumers read
        // effectiveShowDescriptions / renderedShowDescriptions instead.
        get showDescriptions() {
          return modeCanShowDescription(this.showLabelsMode)
        },

        /**
         * #getter
         */
        get showOutline() {
          return !!getConf(self, 'outlineColor')
        },

        /**
         * #getter
         */
        // Solid color for the picker swatch. Reads the raw config `color`
        // slot value directly (self.conf.color, not getConf) so an unset or
        // jexl-expression color doesn't get evaluated without a feature —
        // jexl strings aren't valid CSS colors anyway, so they fall back to
        // the default swatch same as unset.
        get featureColor() {
          const raw = self.conf.color
          return raw !== undefined && !isJexl(raw) ? raw : FEATURE_DEFAULT_COLOR
        },

        /**
         * #getter
         */
        // Swatch for the UTR color picker. The slot is a `maybeColor`, so
        // resolve its unset state here — a bare getter must never hand back
        // undefined. Unset means the render falls back to a feature's own BED
        // color when it has one, which no single swatch can show, so the swatch
        // shows what an itemRgb-less feature actually gets.
        //
        // Reads the raw slot value, not getConf — the same jexl-without-a-feature
        // hazard as `featureColor` above, and for the same reason: `utrColor` is a
        // per-feature callback slot, so getConf evaluates the expression against
        // no feature and throws out of the dialog this feeds. A jexl string is not
        // a CSS color anyway, so it shows the default swatch like unset does.
        get utrColor(): string {
          const raw = self.conf.utrColor
          return raw !== undefined && !isJexl(raw) ? raw : UTR_DEFAULT_COLOR
        },

        /**
         * #getter
         */
        // Which "Color by..." choice is active, so the track menu can show a
        // radio checkmark. An unset slot is 'default' (a feature's own itemRgb,
        // else the stock fill), which no solid swatch can stand in for; 'strand'
        // is the exact built-in jexl; any other jexl value is a per-attribute
        // expression; anything else is a solid color. Reads the raw slot value
        // (not getConf) — same jexl-without-a-feature hazard as featureColor.
        get colorByMode(): 'default' | 'strand' | 'attribute' | 'solid' {
          const raw = self.conf.color
          return raw === undefined
            ? 'default'
            : raw === STRAND_COLOR_JEXL
              ? 'strand'
              : isJexl(raw)
                ? 'attribute'
                : 'solid'
        },

        /**
         * #getter
         */
        // The attribute name baked into an active "Color by attribute" jexl, so
        // the dialog reopens prefilled instead of blank. Empty unless that mode
        // is active.
        get colorByAttribute() {
          const raw = self.conf.color
          // Empty unless "Color by attribute" is active. raw is a jexl string
          // in that mode; narrow it explicitly so the regex gets a defined
          // string rather than masking undefined with a fallback.
          if (this.colorByMode !== 'attribute' || raw === undefined) {
            return ''
          }
          return /get\(feature,'([^']+)'\)/.exec(raw)?.[1] ?? ''
        },

        /**
         * #getter
         */
        get effectiveShowDescriptions() {
          // Auto degrades in two steps: descriptions go at
          // maxDescriptionFeatureDensity, names at the higher
          // maxLabelFeatureDensity. Anded with `showLabels` so a config that
          // inverts the two thresholds can't leave descriptions painting after
          // names are gone — the tighter of the pair always wins. The pinned
          // modes skip the density gate entirely, `description` included: that
          // rung deliberately paints descriptions with no name. Collapsed
          // suppresses them outright (like names) — gated at this render-layer
          // getter, not the mode-derived `showDescriptions` one, so the track
          // menu's radio still reflects the persisted choice rather than
          // reading false while collapsed (mirrors how subfeatureLabels is
          // forced off in rpcProps, not in its menu-facing getter).
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
          const selection = isAlive(self)
            ? getSession(self).selection
            : undefined
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

        /**
         * #getter
         * Singular, lowercase noun for what this track holds. Every menu label,
         * chip and indicator that names the thing reads it from here, so a
         * subclass renames its whole vocabulary with one override rather than
         * threading a noun through a dozen call sites — LinearVariantDisplay
         * returns 'variant' and its menu stops saying "feature" at the user.
         *
         * Distinct from the per-hit noun the context menu derives from the
         * clicked item's own `type` ("mRNA", "gene"); that names one annotation,
         * this names the track's contents. The hit noun falls back to this.
         */
        // `featureNoun` and `featureWidgetType` are `BaseDisplay`'s, and this
        // display's answers ARE the defaults — it draws plain features into the
        // generic widget. The variant display, which shares this base, overrides
        // both.
      }))
      .views(featureSetViews)
      .views(featureHighlightViews)
      .views(self => ({
        /**
         * #method
         */
        // User-controlled settings sent to the worker via RPC. Every field
        // read here becomes a cache key: SettingsInvalidate autorun calls
        // rpcProps() and clears data when any field changes. Structural args
        // (adapterConfig, sequenceAdapter, region, bpPerPx) are added at the
        // RPC call site, matching the pattern used by every other display
        // type. Subclasses extend via the super-capture pattern.
        rpcProps() {
          // getConfigSnapshotWithPromotables hands the worker concrete values for
          // every promotable slot (chevrons, subfeatureLabels, ...) instead of
          // their raw inherit sentinels — so a new promotable worker-slot needs
          // no rpcProps change here.
          //
          // It snapshots EVERY slot the schema and its inherited bases declare,
          // though, and this payload is the RPC cache key (see
          // rpcPropsCacheKey) — so what reaches the worker is PICKED here rather
          // than filtered. `pickDisplayConfig` is that pick and carries why;
          // the short version is that the subtractive spelling made every slot
          // nobody had thought to exclude a silent refetch trigger, and the
          // expensive ones came from `BaseLinearDisplay`'s schema rather than
          // from this plugin.
          //
          // The gate budgets — resolved and raw — are NOT cache keys. The
          // RESOLVED values (`resolvedByteLimit()`, `maxFeatureDensity`) ride
          // at the CALL SITE because they swing on the viewport: as a cache key
          // `maxFeatureDensity` made zooming across the 20 kb floor a full
          // `clearAllRpcData()` + refetch, blanking the display at exactly the
          // zoom people settle a gene at, for data identical on both sides of
          // it. And the RAW slots need no invalidation role either, because an
          // edit reaches the verdict through tracked reads: a region the
          // worker rejected stores no data and is never marked loaded, the
          // fetch autorun tracks `regionTooLarge`, so raising a budget releases
          // the banner and refetches the blocked region with the new budget —
          // while regions already loaded and in budget keep their data, which
          // a cache-key invalidation would have thrown away. Lowering a budget
          // re-banners from the live verdict (`densityStatsPerRegion` is
          // committed on every successful fetch regardless of budget, and the
          // byte estimate survives), with the worker re-gating whenever a
          // fetch actually happens — the moment a download would occur.
          const snapshot = getConfigSnapshotWithPromotables(self)
          const workerConfig = pickDisplayConfig(snapshot)
          return {
            // jexlFilters carries the effective runtime filters; reading
            // activeFilters() here makes it an RPC cache key so toggling filters
            // refetches. buildFeatureAdmission normalizes the prefix either way.
            displayConfig: {
              ...workerConfig,
              // Subfeature labels are worker-baked, so unlike name/description
              // labels they can't be gated on the main thread — force them off
              // here so collapsed mode suppresses every label.
              subfeatureLabels:
                self.displayMode === 'collapsed'
                  ? 'none'
                  : workerConfig.subfeatureLabels,
              jexlFilters: self.activeFilters(),
            },
            colorByCDS: self.colorByCDS,
            showAminoAcids: self.showAminoAcids,
            // Only isolate once the collection is applied; collecting (ctrl+
            // click) leaves this undefined so building the set doesn't refetch
            // or hide anything. Reading both here makes them RPC cache keys, so
            // applying/clearing the solo refetches through the admission gate.
            soloFeatureIds:
              self.soloApplied && self.soloFeatureIds.length > 0
                ? toJS(self.soloFeatureIds)
                : undefined,
            // "Hide this feature" applies immediately (no collect step), so send
            // it whenever non-empty. A cache key, so hide/unhide refetches.
            hiddenFeatureIds:
              self.hiddenFeatureIds.length > 0
                ? toJS(self.hiddenFeatureIds)
                : undefined,
          }
        },

        /**
         * #method
         * What the main-thread encode needs beyond a region's own data: the
         * packed color for every theme class the worker emitted.
         *
         * The theme deliberately does NOT appear in `rpcProps()` above. It used
         * to, so worker-baked CDS-frame and connector colors could follow it —
         * and every field of that payload is an RPC cache key, so a light/dark
         * toggle or a config `theme` edit re-downloaded and re-parsed every
         * visible region of every canvas feature track. The worker now emits a
         * class where it used to bake a theme color (colorClasses.ts) and this
         * resolves it, so the same toggle is a re-encode of what is already
         * loaded.
         *
         * `session.palette`, not `session.theme`: this crosses no boundary that
         * needs MUI, and a getter rather than a pushed volatile so the SVG
         * export and the RPC — neither of which has a component — see a real
         * palette (ARCHITECTURE.md, "Theme-derived render inputs are session
         * getters").
         */
        gpuProps() {
          return { colorTable: themedColorTable(getPaletteHost(self).palette) }
        },
      }))
      // Laid-out data derived from the raw per-region fetch results. MobX
      // caches this — it only recomputes when any tracked input changes (raw
      // data, coarseBpPerPx, label visibility). coarseBpPerPx is debounced
      // 500ms so Y-row packing doesn't recompute on every animation frame
      // during smooth zoom. Every consumer (hit test, GPU upload, React
      // render) reads this getter and sees the same cached map until an
      // input moves. Returns empty when too-large so the GPU upload autorun
      // has nothing to push — banner UI hides the canvas, preventing stale flash.
      .views(self => ({
        /**
         * #getter
         * Layout inputs shared by the base layout and every fit-escalation
         * layout, minus the per-config label/description reservation flags. One
         * source so the candidate layouts can't drift on bpPerPx / orientation /
         * display mode / pins / opened genes.
         *
         * `expandedGeneIds` belongs here and not on the rungs that trim, even
         * though only they consult it: an expanded gene arrives carrying
         * `collapsedIsoformCount`, so EVERY rung's pack trims it back to what
         * the mode collapsed it to, and a rung that inherits the layout inputs
         * without the exemption re-collapses the gene the user just opened.
         * The three trimming rungs each added it for themselves; `full` and
         * `labels` did not, which in `grow` — where `full` is the only rung —
         * left no rung below to recover on.
         *
         * Each region's ref key is NOT here: it rides on the region itself, which
         * is what the layout groups by (see `LayoutRegionData`).
         */
        get layoutInputs() {
          const view = containingLgv(self)
          return {
            bpPerPx: view.coarseBpPerPx,
            reversedRegions: self.reversedRegions,
            displayMode: self.displayMode,
            pinnedFeatureIds: self.layoutPinnedFeatureIdSet,
            expandedGeneIds: self.expandedGeneIdSet,
          }
        },
        /**
         * #getter
         * The features the ladder measures its rungs and its isoform solve
         * against: the on-screen set in `fit` and `fixed`, undefined in `grow`
         * (which measures the whole stack).
         *
         * Grow's height IS its content's, so it owes every buffered feature a
         * row to grow into. The other two size a stack to a slot the user fixed,
         * and a slot spent on a cluster half a viewport away is spent on
         * something the reader cannot see — a refetch widening the buffer then
         * moved the trim with nothing on screen changed (ADR-093). What is DRAWN
         * is never narrowed: `settledMaxY` measures the whole pack outside fit
         * mode.
         */
        get fitMeasureFeatureIds(): ReadonlySet<string> | undefined {
          return self.autoHeight ? undefined : self.onScreenFeatureIds
        },
        /**
         * #getter
         * Overridable hook (default false): the display's transcript setting
         * names every isoform, so the fit ladder's `isoforms` rung may not trim
         * — the surplus scrolls instead. `LinearBasicDisplay` answers it off
         * `geneGlyphMode`; a display with no such setting never withholds the
         * rung.
         *
         * A hook rather than a `geneGlyphMode` read here for the reason
         * `geneGlyphNotice` is one: the variant display shares this base and has
         * no gene glyphs to name a mode for.
         */
        get showsEveryIsoform() {
          return false
        },
        /**
         * #getter
         * Overridable hook: the gene-glyph mode the worker collapses under.
         * The raw slot here; `LinearBasicDisplay` resolves `auto` against the
         * zoom. A term of `zoomFetchKey` and a call-site RPC argument rather
         * than an `rpcProps` field, so a crossing of the `auto` threshold
         * refetches the regions on screen without a settings invalidation.
         */
        get effectiveGeneGlyphMode(): GeneGlyphMode {
          return getConf(self, 'geneGlyphMode')
        },
        /**
         * #getter
         * Whether the settings reserve `below` subfeature-label rows, which is
         * what earns the fit ladder its `bare` rung — with nothing reserved
         * the rung would repack an identical stack. Collapsed mode forces the
         * labels off in rpcProps, so the worker counted no rows there whatever
         * the slot says.
         */
        get reservesBelowLabelRows() {
          return (
            self.displayMode !== 'collapsed' &&
            resolveConf(self, 'subfeatureLabels') === 'below'
          )
        },
      }))
      .views(fitLadderViews)
      .views(self => ({
        /**
         * #getter
         * Uniform vertical scale for fit mode; 1 unless the resolved stack is being
         * grown to fill the track (> 1) or the bodies stack squeezed to fit (< 1).
         */
        get fitScale() {
          return self.fitStage.scale
        },
        /**
         * #getter
         * What every consumer (hit test, GPU upload, React render) reads: the
         * resolved fit layout, cloned and scaled only when grown or squeezed. A fit
         * stack shorter than the track stays top-anchored at y=0 (the surplus is
         * bottom whitespace), so a relayout — an isoform collapse, a filter — packs
         * back up against the top instead of jumping to a re-centered offset.
         * Returned by reference off the untransformed path (scale 1) so the
         * incremental-layout upload diff and Y-morph idle check stay intact.
         * Empty while the density band stands in for the features, which is
         * what makes that swap total: every painter, hit test and label reads
         * this, so a track forced to `density` over data it already holds
         * draws the band alone.
         */
        get laidOutDataMap(): ReadonlyMap<number, FeatureDataResult> {
          const { layout, scale } = self.fitStage
          return self.densityBandActive
            ? EMPTY_LAID_OUT_DATA
            : scale === 1
              ? layout
              : scaleLaidOutData(layout, scale)
        },
        /**
         * #getter
         * Descriptions are painted at the `full` stage, and at the `isoforms`
         * one where a fixed-height track reached it — that ladder is `full →
         * isoforms` and gives up transcripts rather than labels, so the rung
         * packs the descriptions the settings asked for and this has to agree.
         * Fit mode only reaches `isoforms` after `labels` dropped them. Every
         * render-time consumer — label draw and the highlight/hit/SVG
         * label-width reservation — reads this so a box never reserves width
         * for a description it won't draw.
         */
        get renderedShowDescriptions() {
          const { level } = self.fitStage
          return (
            self.effectiveShowDescriptions &&
            (level === 'full' ||
              (level === 'isoforms' && !self.fitHeightToDisplay))
          )
        },
        /**
         * #getter
         * Names are painted at every stage short of `bodies` and `bare` (and
         * whenever fit is off), where the packer reserved row height + overhang
         * for the names it kept so they never overlap — including the
         * `decimated` stage, whose per-feature pruning happens inside the
         * layout (dropped names are removed from floatingLabelsData), not via
         * this flag. At `bodies` and below nothing is reserved, so all names
         * are hidden rather than drawn on top of the boxes. Every render-time
         * consumer reads this so hidden names reserve nothing.
         */
        get renderedShowLabels() {
          const { level } = self.fitStage
          return self.showLabels && level !== 'bodies' && level !== 'bare'
        },
        /**
         * #getter
         * A subfeature label (a transcript name under its gene) is a worker-baked
         * config choice rather than a fit concession — `showLabels`/
         * `showDescriptions` govern only the feature's OWN two lines, and the
         * packer reserves this label's row and overhang to match. So it
         * survives every rung with another reduction to offer, `bodies`
         * included — only the `bare` rung, whose whole reduction IS these rows
         * (spent at zero in the pack), drops it.
         *
         * It does not survive a squeeze either. The reserved rows are spent in
         * `bodyHeightPx` and scaled with everything else, while the text draws
         * at the mode's own font size — so at scale 0.3 the names would paint
         * over rows a third as tall as the text, on top of each other and of
         * the boxes. On a display that reserves these rows the ladder reaches
         * `bare` before it squeezes, so the scale guard covers the remaining
         * squeezable ladders (rows never reserved — nothing real is hidden).
         */
        get renderedShowSubfeatureLabels() {
          const { level, scale } = self.fitStage
          return scale >= 1 && level !== 'bare'
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
            this.renderedShowDescriptions,
            // Solving for one costs a bisection, and only this rung reports it.
            self.fitStage.level === 'decimated'
              ? self.fitDecimatedFactor
              : undefined,
            // The `bare` rung exists only where the settings reserve the rows,
            // so its level alone says the reserved labels were dropped.
            self.fitStage.level === 'bare',
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The track-sizing control's account of what fit mode gave up, or
         * undefined when nothing. The ladder drops labels silently and the
         * "Labels" radio keeps saying they are on, so without this a user has
         * no way to tell a track with no descriptions from one whose
         * descriptions fit mode hid.
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
      .views(self => ({
        /**
         * #getter
         */
        // The settled laid-out content height, ignoring any in-flight Y morph.
        // The DRAWING height: the canvas, the overlay layer and the peptide lane
        // are sized from it through `contentHeight`, so it has to cover every
        // laid-out feature — a buffered feature packed below the viewport still
        // gets its box and its label, it is simply not somewhere a scroll can go
        // (`scrollExtentMaxY`). This is also what `grow` mode sizes the track to,
        // so it must NOT include the morph hold below, or the track would bounce
        // to the taller of old/new content for the morph's duration and then
        // collapse.
        //
        // Fit mode reads it off `fitStage` rather than re-walking the map:
        // `contentHeight` is the kept rung's unscaled height over
        // `fitMeasureFeatureIds` and `scaleLaidOutData` multiplies every bottomPx
        // by the same scale, so a fitted track reports the height of what it is
        // showing rather than of the buffer around it, epsilon-snapped so a
        // grow/squeeze scale doesn't spuriously scroll. `fitTargetHeight` is the
        // config slot, not the reactive `height` getter, so grow's
        // `height`→grownHeight→settledMaxY chain can't cycle back on itself.
        //
        // The other two modes measure the whole pack instead: their stage
        // contentHeight is now narrowed to the on-screen set too
        // (`fitMeasureFeatureIds`), which is right for choosing the rung and
        // wrong for sizing a canvas that draws the buffer.
        get settledMaxY() {
          if (!self.fitHeightToDisplay) {
            return maxBottom(self.fitStage.layout)
          }
          const { contentHeight: keptRungHeight, scale } = self.fitStage
          return snapFittedContentHeight(
            keptRungHeight * scale,
            self.fitTargetHeight,
            scale !== 1,
          )
        },

        /**
         * #getter
         */
        get maxY() {
          // During a Y morph hold the height at the taller of the old/new
          // layout so features animating up from a deeper row aren't clipped at
          // the bottom; it settles to the destination height when the morph
          // ends. Constant across the morph, so no per-frame reflow. This is the
          // DRAWING height — the canvas, the overlay layer and the peptide lane
          // are all sized from it, so it covers every laid-out feature. What can
          // be scrolled TO is `scrollExtentMaxY`, which is narrower. Grow-mode
          // sizing reads settledMaxY so the track height doesn't bounce
          // mid-morph.
          return self.morphFromTops === undefined
            ? this.settledMaxY
            : Math.max(this.settledMaxY, self.morphFromMaxY)
        },

        /**
         * #getter
         */
        // How deep the content a scroll can actually REACH goes: the deepest row
        // occupied by a feature on screen, rather than by one in the fetch
        // buffer.
        //
        // The fetch buffers half a viewport either side and the pack places
        // every buffered feature, so a viewport holding eight genes can carry a
        // stack twenty rows deep whose bottom twelve rows draw nothing in view.
        // Measuring the scroll extent over the whole stack offered a scroll
        // gesture that revealed blank canvas, and — since the scrollbar and the
        // edge shadow are both readouts of this one number — told the reader
        // features were hidden below a track that was showing all of them. The
        // figure review caught it three times in one pass.
        //
        // Same set and same 500ms debounce the fit ladder measures over
        // (`onScreenFeatureIds`), so a pan re-measures once it settles. Fit mode
        // is already narrowed at the source — `settledMaxY` measures the kept
        // rung over `fitMeasureFeatureIds` and epsilon-snaps a scale's float
        // slack — so it reuses that rather than re-walking the map unsnapped.
        //
        // `settledMaxY`, NOT the morph-aware `maxY`: the morph hold exists so a
        // feature easing up from a deeper row isn't clipped, which is about what
        // is DRAWN. `morphFromMaxY` is measured over the whole buffered pack, so
        // reading it here put a scrollbar and a bottom shadow over blank canvas
        // for the morph's 300ms — the exact defect the on-screen narrowing above
        // exists to prevent, reached through the fit branch.
        get scrollExtentMaxY() {
          const ids = self.fitHeightToDisplay
            ? undefined
            : self.onScreenFeatureIds
          return ids ? maxBottom(self.laidOutDataMap, ids) : this.settledMaxY
        },

        /**
         * #getter
         */
        get hasOverflow() {
          return this.scrollExtentMaxY > self.height
        },

        /**
         * #getter
         */
        // Features the packer could not place at all because the stack passed
        // GranularRectLayout's row limit. They are not scrolled-out-of-view, they
        // are absent: nothing draws or hit-tests them, and `maxY` doesn't count
        // them, so without this the display reports "everything fits" while
        // showing strictly less than its data. Fit mode is where this bites — its
        // whole promise is that every feature is in view — so the track-sizing
        // affordance surfaces it (see TrackHeightIndicator's tooltip).
        //
        // Over `fitMeasureFeatureIds`, like every other measurement the ladder
        // takes — so fit and fixed count the viewport and grow counts the whole
        // pack. The tooltip tells the user to filter or zoom in, and a count
        // including the fetch buffer said that about features a pan would have
        // shown.
        get truncatedFeatureCount() {
          return countTruncatedFeatures(
            self.laidOutDataMap,
            self.fitMeasureFeatureIds,
          )
        },

        /**
         * #getter
         */
        // Coordinate-space height of what is DRAWN: the laid-out content (maxY)
        // but never less than the viewport, so the canvas, the overlay layer and
        // the peptide lane share one definition (was `hasOverflow ? maxY :
        // height`). A buffered feature packed below the viewport still gets its
        // box and its label drawn at full size here — it is simply not somewhere
        // a scroll can go, which is `scrollContentHeight`.
        get contentHeight() {
          return Math.max(this.maxY, self.height)
        },

        /**
         * #getter
         */
        // The same coordinate space as `contentHeight`, measured over the rows a
        // scroll can reach. This is what the scrollbar and the edge shadow are
        // sized from: both exist to answer "is this track showing me all of its
        // features", and a buffered feature off the side of the viewport is not
        // an answer to that question.
        get scrollContentHeight() {
          return Math.max(this.scrollExtentMaxY, self.height)
        },

        /**
         * #getter
         */
        // How far the content can scroll: 0 when everything on screen fits.
        // Single source for the wheel handler and any scroll clamp, and the hook
        // TrackHeightMixin's clamp is earned by overriding — so a pan into a
        // sparser window pulls the scroll offset back to the new bottom rather
        // than stranding the viewport over blank canvas.
        get scrollableHeight() {
          return Math.max(0, this.scrollExtentMaxY - self.height)
        },

        /**
         * #getter
         */
        // HeightModeMixin's grow hook: the height the laid-out stack wants,
        // before the mixin's own `growMaxHeight` cap. That is the settled content
        // height (settledMaxY, NOT the morph-inflated maxY — grow must target the
        // destination height so it doesn't bounce during a zoom morph), floored
        // at MIN_GROW_HEIGHT so a sparse track doesn't collapse to a sliver.
        //
        // With no layout at all — data not landed yet, or the too-large banner
        // up — the content height is unknown rather than zero, so the track
        // holds the configured slot height instead. The floor is a claim about
        // sparse DATA; applied here it squeezed the too-large banner into a
        // 50px sliver and bounced every grow track slot→floor→content on load.
        //
        // Height-independent — settledMaxY reads the config-slot
        // `fitTargetHeight`, never the reactive `height` getter — which is what
        // lets the mixin's `height` return this in grow mode without cycling.
        // `grownHeight`, the `height` override and the grow-aware `resizeHeight`
        // all come from the mixin.
        get growTargetHeight() {
          return self.layoutReady
            ? Math.max(MIN_GROW_HEIGHT, this.settledMaxY)
            : self.fitTargetHeight
        },

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
      // The id-index consumers sit in their own block, after the two getters
      // they read, so each reads them off `self` rather than `this`. Same shape
      // and same reason as `MultiRegionDisplayMixin`'s `dataCurrent`/`svgReady`
      // split ("a super-captured view is called bare") — except here it is not
      // hypothetical. `overlayElements.tsx` destructures `morphOffsetFor` off
      // the model and calls it with no receiver, which under `this` threw
      // `Cannot read properties of undefined (reading 'featureIdIndex')` the
      // moment anything asked for an overlay box: a search hit, a selection, a
      // solo pick, or a hover. A getter survives being destructured because it
      // is evaluated at that moment with the right receiver; a *method* does
      // not, so the two kinds cannot be told apart by looking at the call site.
      // Read siblings off `self` in a later block and the distinction stops
      // mattering.
      .views(morphOffsetViews)
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

        /**
         * #method
         */
        getFeatureById(featureId: string) {
          return self.featureIdIndex.get(featureId)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The feature the hover box frames: the open context menu's target
         * while one is open, so the box always agrees with what the menu acts
         * on, else the feature under the cursor. Same rule as the multi-row
         * display's `highlightedBlockRect`.
         */
        get hoverBoxFeature() {
          const info = self.contextMenuInfo
          return info ? info.item : self.hoveredFeature
        },
        /**
         * #getter
         * The transcript the hover box frames instead of its gene, by the rule
         * of `hoverBoxFeature`.
         */
        get hoverBoxSubfeature() {
          const info = self.contextMenuInfo
          return info ? info.subfeature : self.hoveredSubfeature
        },
      }))
      .views(self => ({
        /**
         * #method
         */
        searchFeatureByID(id: string) {
          const item = self.getFeatureById(id)
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
        // Per-feature entry across visible regions, indexed by featureId.
        // Drives overlay rendering (hover/selection highlights) — keyed on
        // laidOutDataMap + view.visibleRegions, so it recomputes on layout
        // change, pan, or zoom. Feature wins over subfeature on id collision.
        //
        // That collision rule is why the feature `set` below is unconditional
        // rather than guarded like the subfeature one: a guard would let a
        // subfeature inserted by an earlier region block a feature from a later
        // one. The side effect is that a feature spanning several regions
        // resolves to the LAST region's copy here, while `indexById`
        // (featureIdIndex/subfeatureIdIndex) documents and keeps the FIRST — so
        // the two tables hand back different entries for the same id, and
        // HighlightLayer's hover box reads geometry from one and refName/label
        // width from the other.
        //
        // Harmless as things stand, and deliberately left alone rather than
        // "fixed" into agreement: bp/px extents are absolute and a spanning
        // feature shares one row across its whole ref-group, and both regions
        // carry the same floatingLabelsData entry (the drop/decimate decisions
        // are made once per ref-group), so the copies are interchangeable. If a
        // per-region difference ever appears in the fields overlays read, make
        // this first-wins via `map.get(id)?.kind !== 'feature'` — which keeps
        // the feature-over-subfeature rule intact, as a bare `!map.has` would
        // not.
        get featureItemMap(): Map<string, FeatureItemEntry> {
          const map = new Map<string, FeatureItemEntry>()
          const visibleRegions = containingLgv(self).visibleRegions
          for (const vr of visibleRegions) {
            const data = self.laidOutDataMap.get(vr.displayedRegionIndex)
            if (!data) {
              continue
            }
            for (const f of data.flatbushItems) {
              map.set(f.featureId, { kind: 'feature', item: f, vr, data })
            }
            for (const s of data.subfeatureInfos) {
              if (!map.has(s.featureId)) {
                map.set(s.featureId, { kind: 'subfeature', item: s, vr })
              }
            }
          }
          return map
        },

        /**
         * #getter
         */
        // Flatbush spatial indexes per region for hit testing. MobX caches this,
        // but ONLY because afterAttach keeps an autorun subscribed to it: its one
        // consumer is hit-testing inside DOM event handlers, and an unobserved
        // computed is suspended by MobX (it drops its dependency subscriptions, so
        // it can't know when a cached value went stale, and re-evaluates on every
        // read) — which made every mousemove rebuild a Hilbert-sorted index per
        // region. See the CanvasHitIndexes autorun.
        //
        // coarseBpPerPx (debounced), NOT live bpPerPx: the only bpPerPx-dependent
        // parts are the px->bp conversions for the hit padding and the label
        // overhang, and the layout already reserved that overhang at coarseBpPerPx
        // — so this both matches the geometry the rows were packed at and keeps a
        // smooth zoom from rebuilding every index each frame.
        get flatbushIndexes() {
          const bpPerPx = containingLgv(self).coarseBpPerPx
          const labels = {
            showLabels: self.renderedShowLabels,
            showDescriptions: self.renderedShowDescriptions,
            fontSize: self.labelFontSize,
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
         */
        setRpcData(
          displayedRegionIndex: number,
          data: FeatureDataResult,
          region: Region,
        ) {
          self.rpcDataMap.set(displayedRegionIndex, {
            ...data,
            regionKey: `${region.assemblyName}:${region.refName}`,
            refName: region.refName,
            reversed: !!region.reversed,
          })
        },

        // This display deliberately does NOT override
        // `clearDisplaySpecificData` (MultiRegionDisplayMixin's no-op default
        // stands), so a `clearAllRpcData` keeps everything below and the track
        // stays painted through the refetch window — the stance ADR-006 took
        // for this display alone, and the one `invalidateSettings` takes for
        // every per-region display since 2026-09:
        //
        // - `rpcDataMap` and the gate's density stats survive, so features stay
        //   on screen and the derived `regionTooLarge` banner stays stable across
        //   small zoom/pan moves. `pruneRpcDataMapToVisible` below is what bounds
        //   them instead, per-region, during fetchNeeded. When regionTooLarge is
        //   true `laidOutDataMap` returns empty, so no stale features render
        //   through the banner.
        // - `scrollTop` survives. clearAllRpcData fires on same-region refetches
        //   (zoom, settings), and zeroing scroll there yanks the viewport to the
        //   top on every zoom. The scroll-to-top reset lives in the
        //   displayedRegions-change handler (chromosome nav) instead, and a
        //   re-pack that shrinks content is clamped by the layout autorun's
        //   maxScroll clamp.
        /**
         * #action
         */
        pruneRpcDataMapToVisible(visibleDisplayedRegionIndices: Set<number>) {
          for (const key of self.rpcDataMap.keys()) {
            if (!visibleDisplayedRegionIndices.has(key)) {
              self.rpcDataMap.delete(key)
            }
          }
          for (const key of self.densityStatsPerRegion.keys()) {
            if (!visibleDisplayedRegionIndices.has(key)) {
              self.densityStatsPerRegion.delete(key)
            }
          }
          // Keep loadedRegions in sync with rpcDataMap so isCacheValid never
          // sees boundsValid=true with missing rpcData (blank-region on pan-back).
          for (const key of self.loadedRegions.keys()) {
            if (!visibleDisplayedRegionIndices.has(key)) {
              self.dropLoadedRegion(key)
            }
          }
        },

        /**
         * #action
         */
        startRenderingBackend(backend: CanvasFeatureRenderingBackend) {
          // Upload only regions whose laid-out data reference changed, so a new
          // chromosome streaming in doesn't re-upload the ones already on the
          // GPU. `laidOutDataMap` keeps stable references for unchanged
          // ref-groups (see createIncrementalLayout), making the diff
          // meaningful. `renderDataMap === laidOutDataMap` when idle; during a Y
          // morph it yields fresh per-frame region objects, so the interpolated
          // rows re-upload each frame (and once more on settle).
          installUpload(self, backend, {
            cells: () => self.renderDataMap,
            inputs: () => self.gpuProps(),
            encode: (data, { colorTable }) =>
              resolveRegionColors(data, colorTable),
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
           * Drops the hover first, so its tooltip does not sit under the menu;
           * the highlight box stays on the target through `hoverBoxFeature`.
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
           * the adapter's header metadata beside it; a lookup that resolves to
           * nothing is reported as a miss. `parentFeature` names the feature the
           * click was made THROUGH, where it was made through one.
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
           * expressions). Pass undefined to clear it and fall back to the config
           * `jexlFilters` slot.
           */
          setJexlFilters(filters?: string[]) {
            self.jexlFiltersSetting = cast(filters)
          },

          /**
           * #action
           */
          setShowOutline(value: boolean) {
            // THEME_DERIVED_COLOR sentinel: the worker resolves it to a
            // theme-appropriate outline so it stays visible on dark tracks too.
            setConf(self, 'outlineColor', value ? THEME_DERIVED_COLOR : '')
          },

          /**
           * #action
           */
          // undefined resets to the slot's config default (which may be a
          // per-feature jexl color); a string sets a solid color for all
          // features. Flows to the worker via rpcProps -> displayConfig.color.
          setFeatureColor(color?: string) {
            setConf(self, 'color', color)
          },

          /**
           * #action
           */
          setUtrColor(color?: string) {
            setConf(self, 'utrColor', color)
          },

          /**
           * #action
           */
          // Published by a feature sequence dialog opened off this display's
          // right-click menu, so the LGV can draw a crosshair at the base the
          // sequence readout is hovering. Skips no-op updates: mousemove fires
          // per pixel but the base under the cursor changes far less often.
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
      .actions(self => ({
        /**
         * #action
         */
        // Set the feature-size (density) preset. Orthogonal to the track-height
        // strategy — fit/grow scale or accommodate whatever size this sets —
        // so it deliberately leaves heightMode untouched.
        setDisplayMode(value: DisplayMode) {
          setConf(self, 'displayMode', value)
        },

        // `setHeightMode` (write the slot, drop a contradicted scroll offset) is
        // HeightModeMixin's; the `laidOutDataMap` getter does the actual fit
        // reactively and needs no extra teardown here.

        /**
         * #action
         */
        // Opens the solid-color picker. UTR row hidden for displays without UTRs
        // (e.g. variants).
        openSetColorDialog(showUtrColor = true) {
          getDialogHost(self).queueDialog(handleClose => [
            SetColorDialog,
            { model: self, handleClose, showUtrColor },
          ])
        },

        /**
         * #action
         */
        openColorByAttributeDialog() {
          getDialogHost(self).queueDialog(handleClose => [
            ColorByAttributeDialog,
            {
              model: self,
              handleClose,
              initialAttribute: self.colorByAttribute,
            },
          ])
        },

        /**
         * #action
         */
        openFilterDialog() {
          getDialogHost(self).queueDialog(handleClose => [
            JexlFilterDialog,
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
            stopToken?: StopToken
            statusCallback?: StatusCallback
          } = {},
        ) {
          const region = self.loadedRegions.get(displayedRegionIndex)
          if (!region) {
            return undefined
          }
          // Ask for the clicked feature's own span, not the buffered region the
          // paint came from — the display already knows where it is, and the
          // whole region is a second download of everything on screen. Falls
          // back to the region when the id has no laid-out item, which is the
          // same miss the RPC's own `find` reports.
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
         * declared once (see `Reversible`). The "Filter by... (n)" count, the
         * undo rows inside that submenu, and what "Clear all filters" clears are
         * all derived from this one list, so they cannot disagree — the pairing
         * rule that used to be a comment on two separately-maintained members.
         *
         * A METHOD, not a getter, because it is the subclass extension seam and
         * a getter cannot be super-captured — `const { x } = self` on a getter
         * evaluates it once at composition time and freezes that value forever.
         * Same rule as every other seam here (showSubmenuMenuItems,
         * trackMenuItems); the count this replaces carried the same note.
         *
         * A subclass adds a filter by super-capturing THIS and appending one
         * entry, rather than overriding a count and a clear and hoping the two
         * stay in step (LinearBasicDisplay's "Show only genes" did exactly that).
         *
         * A narrowing counts when its value is not the **no-op** one, which is
         * not always its default:
         *
         * - the jexl override's no-op is the CONFIG DEFAULT, not the empty list —
         *   `jexlFilterNarrowing` states that one, since all three displays with
         *   this row need it.
         * - `soloApplied`, not `soloFeatureIds.length`: while the user is still
         *   collecting (ctrl+click) the set only draws boxes and hides nothing.
         *   The SoloSelectionChip's × is the recovery for an unapplied one.
         * - the hidden set is ONE narrowing however many features it holds — one
         *   thing to clear, and its own row already names N.
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
         * highlight boxes and the pins holding features at the top of the layout.
         * Same declaration shape as the narrowings above and the same undo rows,
         * but deliberately a separate list: neither hides anything, so neither
         * belongs in the "Filter by... (n)" count or under "Clear all filters".
         *
         * They need the rows for the same reason the narrowings do. Both outlive
         * the navigation that created them and neither is reachable from the
         * feature itself once the user has panned away — and a pin is worse than
         * a highlight, because nothing on screen marks a pinned feature at all.
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
         * How many independent things are narrowing what the display shows —
         * the "(n)" in "Filter by... (n)", and the gate on "Clear all filters".
         * Derived, so it cannot drift from the list it counts.
         */
        featureFilterCount(): number {
          return activeCount(self.featureNarrowings())
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Reverse every narrowing. Derived from the same list `featureFilterCount`
         * counts, so a subclass that adds one gets both halves at once and the
         * menu cannot offer a recovery that doesn't recover.
         */
        clearAllFeatureFilters() {
          clearAll(self.featureNarrowings())
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        // Two bpPerPx-dependent worker decisions: the amino-acid overlay,
        // fetched under `showAminoAcids && shouldRenderPeptideBackground`
        // (executeRenderFeatureData), so the term is that gate rather than the
        // zoom itself, and the gene-glyph mode `auto` resolves against the
        // settled zoom. Every other zoom change reuses the cached features, and
        // a track with the overlay off and a fixed mode never refetches on zoom.
        //
        // The opened genes ride here too, and only under `longestCoding`: that
        // is the one mode whose collapse the worker runs, so under `all` the
        // payload cannot change and a click refetches nothing.
        //
        // A getter, not an action: an action would untrack the view.bpPerPx read.
        get zoomFetchKey(): string {
          const peptides =
            self.showAminoAcids &&
            shouldRenderPeptideBackground(containingLgv(self).bpPerPx)
          const mode = self.effectiveGeneGlyphMode
          const expanded =
            mode === 'longestCoding' && self.expandedGeneIds.length > 0
              ? `|${self.expandedGeneIds.join(',')}`
              : ''
          return `${peptides}|${mode}${expanded}`
        },
        /**
         * #method
         */
        // The reader-side check of the write-side rule: `loadedRegions` is
        // written where the payload is stored (`RegionFetchContext`), so an
        // entry here without one in `rpcDataMap` is that rule being broken. It
        // costs a map lookup and it decides which way the break fails — a
        // refetch, or a viewport that reads as covered against data nobody has
        // and never asks again — a display frozen until the page reloads.
        //
        // A view, not an action: as an action MobX untracks the `rpcDataMap`
        // read and `FetchVisibleRegions` keeps a stale answer.
        regionHasData(displayedRegionIndex: number) {
          return self.rpcDataMap.has(displayedRegionIndex)
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        // Re-fetch the full feature by id and open it in the details widget (the
        // painting ships only slim render arrays). With a subfeatureInfo we
        // descend to the clicked subfeature; otherwise the feature itself.
        // Serves both the click path and the context menu's "Open feature
        // details" (which passes no subfeature).
        //
        // Always fetches `featureId` — the top-level id every caller passes
        // from a FlatbushItem — rather than `subfeatureInfo.parentFeatureId`,
        // which names whichever feature the subfeature hangs off.
        // GetCanvasFeatureDetails searches top-level features only, so anything
        // else answers undefined; findSubfeatureById below recurses, so the root
        // always reaches the target.
        selectFeatureById(
          featureId: string,
          subfeatureInfo: SubfeatureInfo | undefined,
          displayedRegionIndex: number,
        ) {
          // What the containing feature is CALLED comes off the item the
          // display drew, not off the fetched record: which field names a
          // feature on screen is the track's `labels.name` expression, and the
          // hover's own gene row reads the same `name` (see hoverTooltipRows).
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
                ? (findSubfeatureById(
                    parentFeature,
                    subfeatureInfo.featureId,
                  ) ?? parentFeature)
                : parentFeature
            },
            drawn?.name ? { name: drawn.name, type: drawn.type } : undefined,
          )
        },
      }))
      .actions(self => {
        const superReload = self.reload
        return {
          // `superReload()` is not optional: it is what bumps `reloadCounter`,
          // and that counter is the whole arming mechanism of the dead-Retry
          // check. MST replaces an action outright, so an override that skips it
          // freezes the counter — which reads as a display that never retries,
          // and turns the check off here and on `LinearVariantDisplay` with no
          // symptom at all. `reloadReachesCounter.test.ts` watches every
          // `reload()` in the tree for the next one.
          /**
           * #action
           * Clears the loaded regions and fetches straight away, rather than
           * waiting out `FetchVisibleRegions`' 600ms debounce as the rest of the
           * family does — Retry and Force load are both clicks, and this is the
           * display the user is most often clicking on.
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
            // Not in `rpcProps()` — see the note there for why it must not be a
            // cache key.
            const maxFeatureDensity = self.maxFeatureDensity
            const args = rpcArgs(self)
            // Drop cached entries (rpcDataMap + density stats) for regions no
            // longer visible. Keeps on-screen data so labels stay up during
            // the refetch window without letting either map grow unboundedly
            // as the user pans.
            self.pruneRpcDataMapToVisible(
              new Set(
                view.bufferedVisibleRegions.map(b => b.displayedRegionIndex),
              ),
            )
            void fetchGatedRegions(self, needed, {
              call: (region, ctx) => {
                // Per-region translation table from the assembly's geneticCodes
                // config (alias-bridged via getGeneticCodeId), so the worker can
                // translate peptides on contigs whose features carry no
                // transl_table.
                const assembly = getSession(self).assemblyManager.get(
                  region.assemblyName,
                )
                return ctx.callRpc('RenderFeatureData', {
                  ...args,
                  displayConfig: {
                    ...args.displayConfig,
                    geneGlyphMode: self.effectiveGeneGlyphMode,
                  },
                  expandedGeneIds:
                    self.expandedGeneIds.length > 0
                      ? toJS(self.expandedGeneIds)
                      : undefined,
                  geneticCodeId: assembly?.getGeneticCodeId(region.refName),
                  region,
                  bpPerPx,
                  maxFeatureDensity,
                })
              },
              onResult: (displayedRegionIndex, result, region) => {
                self.setRpcData(displayedRegionIndex, result, region)
              },
            })
          },
        }
      })
      .actions(self => {
        return {
          /**
           * #action
           * Fills `BaseDisplay`'s hover-clear hook, which the fetch
           * foundation's reaction calls on every viewport change.
           *
           * The painting is a sticky canvas, so a pan or zoom under a stationary
           * cursor fires no mousemove and no mouseleave, and the highlight box
           * keeps naming whatever used to be under it.
           */
          clearHoveredFeature() {
            self.clearHover()
          },

          afterAttach() {
            // Reset scroll to the top on an actual region-list change
            // (chromosome navigation) — not on same-region zoom/pan, which must
            // keep the user's scroll position (see clearDisplaySpecificData). The
            // gate's own stale-stats cleanup on nav lives in
            // CanvasFeatureGateMixin.afterAttach, not here.
            onDisplayedRegionsChange(
              self,
              () => {
                self.setScrollTop(0)
              },
              'CanvasResetScrollOnDisplayedRegions',
            )

            // Keep the hit-test indexes observed, which is the only reason MobX
            // caches them: their sole consumer is hit-testing inside DOM event
            // handlers, and MobX suspends a computed with no observers — so
            // without this every mousemove rebuilt a Hilbert-sorted Flatbush per
            // visible region. Safe to hold BECAUSE `flatbushIndexes` keys off
            // `laidOutDataMap` and the debounced `coarseBpPerPx`: the rebuild
            // lands on the layout's own cadence, a small marginal cost on top of
            // the strictly more expensive layout pass that already runs eagerly
            // for every track on those same inputs. A getter that read live
            // `visibleRegions` instead must NOT be held this way — see
            // `laneFlatbushIndexes` in plugin-variants for that trap.
            // autorunOnReadyView because flatbushIndexes transitively reads view
            // geometry that throws before the view is measured.
            //
            // The two id->item maps ride along, and they suspend far more often
            // than the Flatbush ones: their only readers are
            // hoveredFeature/hoveredSubfeature, which short-circuit to undefined when
            // nothing is under the cursor — so the dependency disappears on every
            // hover-out, and the next hover-in rebuilt a Map over every laid-out
            // feature. Drag-panning over a track hit that on every frame (the
            // clearHover-on-viewport-change autorun below un-hovers, the next
            // mousemove re-hovers).
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
      // The menu builders live in ./trackMenus.ts and ./featureContextMenu.ts —
      // ~450 lines of MUI construction that is not model state. Each method here
      // stays as the thin, overridable seam: subclasses extend by super-capturing
      // these (the flattened "Show..." submenu, colorMenuItems, trackMenuItems),
      // and the builders read the composed section methods back off `self`, so an
      // override still lands.
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
         * radio groups (each under its own subHeader). Composed from the two
         * extension points above so subclasses inject toggles/groups in place
         * without rebuilding trackMenuItems from scratch.
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
         * The "Color by..." radio choices (solid/strand/attribute). Split out so
         * subclasses can reuse them while assembling their own color menu.
         */
        colorBySubMenuItems(): MenuItem[] {
          return colorBySubMenuItems(self)
        },
      }))
      .views(self => ({
        /**
         * #method
         * Color-related track menu entries: a single "Color by..." entry whose
         * "Solid color..." choice opens the solid+UTR color picker. A subclass
         * changing the choices overrides `colorBySubMenuItems` (variants swaps
         * in its consequence-impact and SV-type presets); this wrapper reads
         * that back off `self`, so it is not the seam to override.
         */
        colorMenuItems(): MenuItem[] {
          return colorMenuItems(self)
        },

        /**
         * #method
         * One "Feature height" menu with two independent radio groups: the size
         * presets and, under a "Track sizing" subheader, how the track responds
         * when there are more features than fit.
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
  )
}

type LinearCanvasBaseDisplayStateModel = ReturnType<
  typeof baseStateModelFactory
>
// What FeatureComponent and its layers take. The subclasses (LinearBasicDisplay,
// LinearVariantDisplay) only add to this, so their instances satisfy it — one
// component serves both with no hand-mirrored structural type.
export type LinearCanvasBaseDisplayModel =
  Instance<LinearCanvasBaseDisplayStateModel>
