import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  resolveConf,
  getConfigSnapshotWithPromotables,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { Highlighter } from '@jbrowse/core/ui/Icons'
import { activeCount, clearAll } from '@jbrowse/core/ui/filterMenuItems'
import {
  canonicalizeViewRefName,
  getContainingView,
  getSession,
  isFeature,
  openFeatureWidget,
  pluralize,
  withFeatureDetails,
} from '@jbrowse/core/util'
import {
  activeJexlFilters,
  configuredJexlFilters,
  jexlFilterNarrowing,
} from '@jbrowse/core/util/jexlFilters'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { sameOptionalStrings } from '@jbrowse/core/util/sameStrings'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, cast, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  HeightModeMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  autorunOnReadyView,
  fetchEachRegion,
  installGrowExitBake,
  onDisplayedRegionsChange,
} from '@jbrowse/plugin-linear-genome-view'
import {
  installPerRegionLifecycle,
  regionDataMap,
} from '@jbrowse/render-core/installPerRegionLifecycle'
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { toJS, untracked } from 'mobx'

import {
  FEATURE_DEFAULT_COLOR,
  STRAND_COLOR_JEXL,
  UTR_DEFAULT_COLOR,
} from '../RenderFeatureDataRPC/featureColors.ts'
import {
  HEIGHT_MULTIPLIERS,
  labelFontSize,
} from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import {
  THEME_DERIVED_COLOR,
  pickDisplayConfig,
} from '../RenderFeatureDataRPC/renderConfig.ts'
import { shouldRenderPeptideBackground } from '../RenderFeatureDataRPC/zoomThresholds.ts'
import CanvasFeatureGateMixin from '../shared/CanvasFeatureGateMixin.ts'
import { fetchCanvasFeatureDetails } from '../shared/fetchCanvasFeatureDetails.ts'
import {
  findSubfeatureById,
  indexById,
  toggleArrayMember,
} from './baseModelHelpers.ts'
import {
  buildFeatureFlatbushIndex,
  buildSubfeatureFlatbushIndex,
} from './components/hitTesting.ts'
import { LABEL_CULL_BUCKET_PX } from './components/labelPositioning.ts'
import { featureContextMenuItems } from './featureContextMenu.ts'
import {
  FeatureHighlightModel,
  resolveFeatureHighlights,
  warnUnresolvedHighlights,
} from './featureHighlight.ts'
import {
  MIN_FIT_BOX_PX,
  resolveFitLadder,
  snapFittedContentHeight,
  solveLabelRoomFactor,
  squeezeFloorScale,
} from './fitLadder.ts'
import {
  countTruncatedFeatures,
  createContentHeightProbe,
  createIncrementalLayout,
  featureIdsTouchingBlocks,
  maxBottom,
  minDrawnBoxHeight,
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
  canMorph,
  captureFeatureTops,
  easeInOutCubic,
  interpolateYData,
  morphAllowed,
  morphClockMs,
  morphOffset,
  rowGeometrySignature,
} from './yMorph.ts'

import type { IsoformPicks } from '../RenderFeatureDataRPC/isoformPicks.ts'
import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
// rpcTypes.ts also declares the RpcRegistry augmentation; importing any type
// from it is enough to make rpcManager.call() resolve to the typed args.
import type {
  FeatureDataResult,
  RenderFeatureDataResult,
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { RegionGateMeasurement } from '../shared/CanvasFeatureGateMixin.ts'
import type { LinearCanvasBaseDisplayConfigModel } from './baseConfigSchema.ts'
import type { CanvasFeatureRenderingBackend } from './components/canvasFeatureRenderingBackendTypes.ts'
import type {
  FeatureItemEntry,
  FlatbushRegionIndexes,
  VisibleRegion,
} from './components/hitTesting.ts'
import type { LinearBasicDisplayConfig } from './configSchema.ts'
import type { FeatureContextMenuInfo } from './featureContextMenu.ts'
import type {
  FeatureHighlight,
  HighlightTarget,
  ResolvedHighlights,
} from './featureHighlight.ts'
import type { FitStage } from './fitLadder.ts'
import type { GeneGlyphMode } from './geneGlyphMode.ts'
import type {
  IncrementalLayout,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
} from './layout.ts'
import type { ShowLabelsMode } from './showLabelsMode.ts'
import type { SequenceHoverPosition } from '@jbrowse/core/BaseFeatureWidget'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Reversibles } from '@jbrowse/core/ui/filterMenuItems'
import type { Feature, Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LegendItem,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

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

export function getView(self: IAnyStateTreeNode): LGV {
  return getContainingView(self) as LGV
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

export interface CanvasColorLegend {
  items: LegendItem[]
  // Session-only visibility, and the reason this is a flag rather than the
  // one-way `dismiss()` it used to be: the key's own "×" is the only thing that
  // could put it away, and it disappears with the key it just removed, so a
  // dismissal lasted until reload with nothing anywhere offering it back. The
  // multi-row painting hit this and answered it with a "Show legend" checkbox;
  // the hook is therefore present whenever a key EXISTS — dismissed or not — so
  // that checkbox has something to see. Drawing is `!dismissed`, on screen and
  // in the SVG export alike.
  dismissed: boolean
  setDismissed: (value: boolean) => void
}

export type { Region } from '@jbrowse/core/util'

const ColorByAttributeDialog = lazy(
  () => import('./components/ColorByAttributeDialog.tsx'),
)
const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))
const JexlFilterDialog = lazy(() => import('@jbrowse/core/ui/JexlFilterDialog'))

// Floor for GROW mode's target height, so a sparse or empty track doesn't shrink
// the track to a sliver. Nothing to do with the fit ladder below, which never
// resizes the track at all — `growTargetHeight` is its only reader, and the
// `maxHeight` config slot is the ceiling at the other end of the same clamp.
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
        MultiRegionDisplayMixin(),
        // The feature-density axis of the region-too-large gate: the model-side
        // sibling of DisplayChrome. Supplies densityStatsPerRegion,
        // observedMaxDensity/visibleFeatureDensityPerPx, the `densityTooLarge`
        // override and the worker's `maxFeatureDensity` budget, plus the
        // commit/clear helpers — folded into the feature fetch below. The byte
        // axis and its `resolvedByteLimit()` budget are RegionTooLargeMixin's,
        // reached through MultiRegionDisplayMixin above. Same instance the
        // multi-row display composes.
        CanvasFeatureGateMixin(),
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
           * zoom re-packs (see packRef in layout.ts). stripDefault so a display
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
           * these draw every isoform whatever `geneGlyphMode` or the height cap
           * would otherwise collapse them to. A per-GENE override of a
           * track-wide setting, so the reader can open the one gene they are
           * reading without turning every other gene on screen into a stack.
           *
           * The collapse is the worker's decision, so this is an RPC cache key
           * (see rpcProps) and a click refetches the visible regions — the same
           * contract solo/hidden already have, and for the same reason.
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
         * Session-only acknowledgement of the color key's "×". Owned here
         * rather than by each display that declares a `colorLegend`, since the
         * hook, the drawing and the "Show legend" checkbox that reverses it are
         * all the base's — see CanvasColorLegend.
         */
        colorLegendDismissed: false,
        /**
         * #volatile
         */
        featureIdUnderMouse: null as string | null,
        /**
         * #volatile
         */
        subfeatureIdUnderMouse: null as string | null,
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
        /**
         * #volatile
         */
        // Everything the right-click resolved — see FeatureContextMenuInfo for
        // what each field means and which entry points supply it.
        contextMenuInfo: undefined as FeatureContextMenuInfo | undefined,
        /**
         * #volatile
         */
        // Per-instance memo backing `laidOutDataMap`. Stateful (holds the
        // previous per-ref-group layout) so unchanged chromosomes keep stable
        // object references — turns whole-genome layout/upload from O(N²) to
        // O(N). The volatile holds a stable reference; mutating its internal
        // cache is invisible to MobX, so reading it in the computed is safe.
        incrementalLayout: createIncrementalLayout(),
        /**
         * #volatile
         */
        // Fit-mode escalation layouts (see `fitStage`). One memo instance per
        // reservation config, so each keeps its own stable per-group references
        // and prior-row ordering exactly like `incrementalLayout` — a single
        // shared instance can only cache one config at a time.
        incrementalLayoutLabelsOnly: createIncrementalLayout(),
        /**
         * #volatile
         */
        incrementalLayoutBodiesOnly: createIncrementalLayout(),
        /**
         * #volatile
         */
        // The `decimated` rung's memo. Unlike its three siblings this one packs
        // WITHOUT prior-row seeding (`seedPriorRows: false`), because the rung's
        // whitespace factor is chosen by measuring unseeded candidate packs and
        // the commit has to match what was measured — see `fitDecimatedSolved`.
        // Its job here is purely to hand back the same stack by reference when
        // the solve lands on the factor it already committed, which is the common
        // case: every pan settle and every drag-resize frame re-solves, and most
        // of those re-solve to the same factor over the same data.
        incrementalLayoutDecimated: createIncrementalLayout({
          seedPriorRows: false,
        }),
        /**
         * #volatile
         */
        // Feature-Y transition state. While `morphFromTops` is set,
        // `renderDataMap` eases each feature from its previous row (id ->
        // topPx here) toward its `laidOutDataMap` row by `morphProgress` (0->1,
        // driven by a rAF clock). Render-only — hit-test and layout always read
        // the destination `laidOutDataMap`.
        morphFromTops: undefined as Map<string, number> | undefined,
        /**
         * #volatile
         */
        morphProgress: 1,
        morphStartMs: 0,
        // Height of the layout being animated away from; `maxY` holds at the
        // taller of this and the destination during a morph (anti-clip).
        morphFromMaxY: 0,
      }))
      .views(self => ({
        /**
         * #getter
         * the config typed off the concrete schema; `ConfigurationReference`
         * erases `self.configuration` to `any`, so direct reads route through
         * this to stay typed (same move as `BaseAdapter<CONF>`).
         */
        get conf(): LinearBasicDisplayConfig {
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
         * Overridable hook (default absent): a floating color key to draw over
         * the canvas. Present whenever a display's active coloring HAS a key
         * worth showing (variants' consequence impact / SV type presets, the
         * `legend` config slot) — whether or not the user has put it away, which
         * is the hook's own `dismissed` flag. See CanvasColorLegend.
         */
        get colorLegend(): CanvasColorLegend | undefined {
          return undefined
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
        get maxHeight() {
          return getConf(self, 'maxHeight')
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
        // overlay, and SVG export. 'auto' switches to false once feature
        // density crosses the readability threshold so layout-reserved label
        // space, the rendered DOM elements, and the hit-test geometry all
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
              self.visibleFeatureDensityPerPx <=
                getConf(self, 'maxLabelFeatureDensity'))
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
        // radio checkmark. 'strand' is the exact built-in jexl; any other jexl
        // value is a per-attribute expression; anything else (a solid color)
        // reads as the default solid mode. Reads the raw slot value (not
        // getConf) — same jexl-without-a-feature hazard as featureColor.
        get colorByMode(): 'strand' | 'attribute' | 'solid' {
          const raw = self.conf.color
          return raw === STRAND_COLOR_JEXL
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
                self.visibleFeatureDensityPerPx <=
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
          const view = getView(self)
          return view.colorByCDS
        },

        /**
         * #getter
         */
        get showAminoAcids() {
          const view = getView(self)
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
         */
        // MobX caches this, so the returned Set keeps a stable reference until
        // pinnedFeatureIds mutates — letting the layout cache detect a pin
        // toggle with a cheap reference compare (see groupUnchanged).
        get pinnedFeatureIdSet(): ReadonlySet<string> {
          return new Set(self.pinnedFeatureIds)
        },

        /**
         * #getter
         */
        // The highlight list with every refName run through
        // canonicalizeViewRefName — the one normalization layer, which resolves
        // aliases and casing together.
        //
        // The matchers compare refName text directly, and the regions they
        // compare it against carry the assembly's CANONICAL name. A highlight
        // does not: the right-click path copies the region's own refName and is
        // therefore already canonical, but a hand-authored session spec carries
        // whatever the author typed — which is whatever the location box showed
        // them, i.e. an alias as often as not. Unnormalized, `chr12` against an
        // assembly canonicalized on `12` boxes nothing, says nothing, and is
        // indistinguishable from the feature not being there. Worse, it depends
        // on the assembly: the same spec key works on one hg38 config and
        // silently does nothing on another.
        //
        // The search bridge (searchResultHighlight.ts) canonicalizes at its own
        // producer for exactly this reason. Doing it here covers the provenance
        // that has no producer to fix it.
        get canonicalFeatureHighlights(): FeatureHighlight[] {
          return self.featureHighlights.map(h => ({
            refName: canonicalizeViewRefName(self, h.refName),
            start: h.start,
            end: h.end,
            name: h.name,
            featureId: h.featureId,
          }))
        },

        /**
         * #getter
         */
        // Resolve declarative highlights against the RAW fetched data (rpcDataMap)
        // rather than the laid-out data — deliberately pre-layout, so it can feed
        // both boxing and pinning without a layout→layout cycle (coords/name live
        // on the raw items, no row/topPx needed). See resolveFeatureHighlights for
        // the box/pin/boxedBy resolution rules.
        get resolvedHighlights(): ResolvedHighlights {
          // index-aligned with self.featureHighlights, so `boxedBy` attribution
          // still indexes the stored list (removeFeatureHighlightsForId).
          const highlights = this.canonicalFeatureHighlights
          const resolved = resolveFeatureHighlights(
            self.rpcDataMap.values(),
            highlights,
          )
          // exact-span matching makes a mistyped coordinate draw nothing at all;
          // say so once rather than leaving it silent (warnUnresolvedHighlights
          // dedupes, so recomputing this getter doesn't spam). It is handed the
          // loaded region SPANS, not just "is there data": a highlight resolves
          // to nothing whenever the user pans or navigates off its locus, and
          // gating on data-existence alone blamed the spec for that.
          warnUnresolvedHighlights(highlights, resolved, [
            ...self.loadedRegions.values(),
          ])
          return resolved
        },

        /**
         * #getter
         */
        // The render-item ids resolved from a search highlight (features and/or
        // subfeatures), for the overlay and SVG export to box. Resolved pre-layout
        // against the raw fetched data (see resolvedHighlights), so it stays stable
        // across pan/zoom; the overlay's addFeatureBox no-ops any id not currently
        // laid out, so no on-screen intersection is needed here (same as
        // soloFeatureIdSet).
        get highlightedFeatureIdSet(): ReadonlySet<string> {
          return this.resolvedHighlights.box
        },

        /**
         * #getter
         */
        // Rows the packer pins to the top: the user's explicit pins PLUS any
        // searched highlight, so a searched feature lands in a top row instead of
        // being buried (or clipped) deep in a dense track. Returns the pinned set
        // by reference when nothing is highlighted, keeping the layout cache's
        // reference compare cheap in the common case.
        get layoutPinnedFeatureIdSet(): ReadonlySet<string> {
          const highlighted = this.resolvedHighlights.pin
          if (highlighted.size === 0) {
            return this.pinnedFeatureIdSet
          }
          return new Set([...self.pinnedFeatureIds, ...highlighted])
        },

        /**
         * #getter
         */
        // Membership set for the "show only these features" collection; drives
        // the overlay highlight and the context-menu toggle labels.
        get soloFeatureIdSet(): ReadonlySet<string> {
          return new Set(self.soloFeatureIds)
        },

        /**
         * #getter
         */
        // How many features the user has hidden one at a time, for the
        // "Show N hidden features" recovery item. The menu builders read this
        // rather than the array, so their structural `self` types ask for a
        // number instead of an observable they'd only call `.length` on.
        get hiddenFeatureCount() {
          return self.hiddenFeatureIds.length
        },

        /**
         * #getter
         */
        // Size of the show-only list, whether or not it has been applied.
        // `soloFeatureIdSet.size` would answer the same question, but that
        // getter allocates a Set for membership tests the count doesn't need.
        get soloFeatureCount() {
          return self.soloFeatureIds.length
        },

        /**
         * #getter
         */
        // How many features are pinned to the top, for the "Unpin N features"
        // recovery item. The array's length rather than `pinnedFeatureIdSet.size`
        // for the same reason as `soloFeatureCount`: the count needs no Set.
        get pinnedFeatureCount() {
          return self.pinnedFeatureIds.length
        },

        /**
         * #getter
         */
        // How many highlight boxes are drawn, for the "Clear N highlights"
        // recovery item. Counts the specs, not the resolved boxes: a highlight
        // the user has panned away from resolves to nothing but is exactly the
        // one the track-level clear exists to reach.
        get featureHighlightCount() {
          return self.featureHighlights.length
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
            // jexlFilters carries the effective runtime filters (mirrors the
            // effectiveGeneGlyphMode substitution in the concrete model); reading
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
            // The per-gene isoform expansions. A cache key, so opening or
            // closing a gene refetches — the collapse happens in
            // `layoutSubfeatures`, which only the worker runs.
            expandedGeneIds:
              self.expandedGeneIds.length > 0
                ? toJS(self.expandedGeneIds)
                : undefined,
            // Structurally-serializable theme description so worker-side coloring
            // (CDS frames, stroke fallback) matches the user's active theme; the
            // worker rebuilds the full theme via createJBrowseThemeFromArgs. The
            // created theme itself carries functions and can't cross the worker
            // boundary. Tracked here (not added at the call site) so switching
            // themes invalidates the RPC cache and refetches with new colors.
            theme: getSession(self).themeOptions,
          }
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
         * display mode / pins.
         *
         * Each region's ref key is NOT here: it rides on the region itself, which
         * is what the layout groups by (see `LayoutRegionData`).
         */
        get layoutInputs() {
          const view = getView(self)
          return {
            bpPerPx: view.coarseBpPerPx,
            reversedRegions: self.reversedRegions,
            displayMode: self.displayMode,
            pinnedFeatureIds: self.layoutPinnedFeatureIdSet,
          }
        },
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
            getView(self).initialized &&
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
         * Two things measure over it, for the same reason: the fit ladder
         * (`fitMeasureFeatureIds`) and the scroll extent (`scrollExtentMaxY`).
         */
        get onScreenFeatureIds(): ReadonlySet<string> | undefined {
          if (!self.layoutReady) {
            return undefined
          }
          const blocks = getView(self).coarseDynamicBlocks
          return blocks.length === 0
            ? undefined
            : featureIdsTouchingBlocks(self.rpcDataMap.values(), blocks)
        },
        /**
         * #getter
         * The features fit mode measures its stack against: the on-screen set
         * while the fit is running, undefined otherwise (which measures the
         * whole stack).
         */
        get fitMeasureFeatureIds(): ReadonlySet<string> | undefined {
          return self.fitHeightToDisplay ? this.onScreenFeatureIds : undefined
        },
      }))
      .views(self => ({
        /**
         * #method
         * One fit-escalation candidate: the stack packed with the given
         * label/description reservation, via that config's own memo instance so
         * each keeps stable references across renders. Empty until
         * initialized/in-bounds, so the GPU upload autorun has nothing to push.
         */
        fitLayoutAt(
          memo: IncrementalLayout,
          showLabels: boolean,
          showDescriptions: boolean,
        ): Map<number, FeatureDataResult> {
          return self.layoutReady
            ? memo(self.rpcDataMap, {
                ...self.layoutInputs,
                showLabels,
                showDescriptions,
              })
            : new Map<number, FeatureDataResult>()
        },
        /**
         * #getter
         * The `decimated` rung's layout inputs minus the whitespace factor. Typed
         * without `labelRoomFactor` so the solve's shared preparation provably can't
         * depend on it (see createContentHeightProbe).
         */
        get decimatedBaseInputs(): LabelRoomFactorFreeInputs {
          return {
            ...self.layoutInputs,
            showLabels: self.showLabels,
            showDescriptions: false,
            labelDecimation: 'fitWidth',
          }
        },
        /**
         * #method
         * Layout inputs for the `decimated` rung at one whitespace factor. Every
         * probe and the committed layout go through this single builder, so the
         * stack the solve measures cannot differ from the stack it commits by a
         * forgotten field.
         */
        decimatedLayoutInputs(labelRoomFactor: number): LayoutInputs {
          return { ...this.decimatedBaseInputs, labelRoomFactor }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Measures the `decimated` rung's stack height at any whitespace factor,
         * against the features the ladder measures its rungs with — so the factor
         * the solve picks is judged on the same stack the rung is then kept or
         * rejected on.
         *
         * A getter, not a call inside the solve, because the preparation it holds
         * (per-kind label widths, the two neighbor-room sorts — about a fifth of
         * a layout) depends on the data and the layout inputs but NOT on the track
         * height. Dragging the resize handle re-solves every frame; caching it
         * here keeps those frames to the bisection's packs alone.
         */
        get decimatedHeightProbe(): (labelRoomFactor: number) => number {
          return createContentHeightProbe(
            self.rpcDataMap,
            self.decimatedBaseInputs,
            undefined,
            self.fitMeasureFeatureIds,
          )
        },
      }))
      .views(self => ({
        /**
         * #method
         * The whitespace factor the `decimated` rung commits at: the smallest one
         * whose packed stack fits `trackHeight` (smallest = most names kept), or
         * undefined when even the most aggressive decimation overflows. The
         * bisection lives in `solveLabelRoomFactor` (fitLadder.ts), next to the
         * ladder walk it serves.
         */
        solveLabelRoomFactor(trackHeight: number) {
          return solveLabelRoomFactor(self.decimatedHeightProbe, trackHeight)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Full reservation (names + descriptions): rendered at fit stage `full`
         * and in non-fit modes, and the first stack `fitStage` probes.
         */
        get baseLaidOutDataMap(): Map<number, FeatureDataResult> {
          return self.fitLayoutAt(
            self.incrementalLayout,
            self.showLabels,
            self.effectiveShowDescriptions,
          )
        },
        /**
         * #getter
         * Names reserved, descriptions dropped — the `labels` stage's stack. With
         * descriptions already off (config, or the auto density gate) this rung's
         * reservation is the base one, so reuse that stack by reference rather than
         * packing a byte-identical copy into a second memo.
         */
        get fitLabelsOnlyLayout(): Map<number, FeatureDataResult> {
          return self.effectiveShowDescriptions
            ? self.fitLayoutAt(
                self.incrementalLayoutLabelsOnly,
                self.showLabels,
                false,
              )
            : this.baseLaidOutDataMap
        },
        /**
         * #getter
         * The whitespace factor the `decimated` rung commits at: the smallest
         * one whose packed stack fits `fitTargetHeight`, so the most names are
         * kept. Undefined when there is nothing to decimate (names off) or when
         * even the most aggressive factor overflows.
         */
        get fitDecimatedFactor(): number | undefined {
          // A memoized getter rather than the bare `solveLabelRoomFactor` call
          // it replaces, so `rowGeometrySignature` reads the same answer the
          // rung packed at without paying for a second bisection (~9 packs).
          return self.layoutReady && self.showLabels
            ? self.solveLabelRoomFactor(self.fitTargetHeight)
            : undefined
        },
        /**
         * #getter
         * The `decimated` stack: names kept only on features with at least
         * `fitDecimatedFactor ×` their label width in neighbour whitespace (plus
         * pinned/highlighted, always). Filling the height with as many
         * non-overlapping names as fit, rather than snapping between a few fixed
         * rungs, is what this rung is for; it decimates by isolation, not by any
         * notion of feature importance. Falls back to the `labels` stack when
         * there is nothing to decimate or no factor fits.
         */
        get fitDecimatedSolved(): Map<number, FeatureDataResult> {
          // Probe and commit must pack identically or the committed stack
          // overflows the height the solve fit, the ladder descends to `bodies`
          // and every name vanishes on the tallest tracks. Hence
          // `incrementalLayoutDecimated`, built with `seedPriorRows: false` to
          // match the unseeded probe; the memo is there for reference stability
          // across the re-solve every pan settle and drag frame triggers.
          //
          // Seeding this rung from the factor-independent `labels` stack was
          // tried and moved zero rows — that seed's order and the
          // `layoutStartBp` tiebreak it would replace already coincide. Don't
          // re-add it without a measurement.
          const factor = this.fitDecimatedFactor
          return factor === undefined
            ? this.fitLabelsOnlyLayout
            : self.incrementalLayoutDecimated(
                self.rpcDataMap,
                self.decimatedLayoutInputs(factor),
              )
        },
        get fitBodiesOnlyLayout(): Map<number, FeatureDataResult> {
          return self.showLabels
            ? self.fitLayoutAt(self.incrementalLayoutBodiesOnly, false, false)
            : this.fitLabelsOnlyLayout
        },
        /**
         * #getter
         * The unscaled height (px) of the shortest box on screen that the layout
         * actually DRAWS — a UTR at its 0.65 fraction, a transcript rect inside a
         * gene, a plain variant box — which is the one a uniform squeeze takes
         * below a visible size first, and so the basis for the squeeze floor
         * below. 0 when nothing is drawn, which makes that floor a no-op.
         *
         * A drawn box, not a feature's laid-out extent, and the distinction is the
         * whole floor: a gene's extent is every stacked transcript plus its label
         * rows, so a floor built on it promised 2px boxes while letting each
         * transcript render at a third of a pixel. See `minDrawnBoxHeight`.
         *
         * Measured off the layout, never off the `featureHeight` config slot. The
         * slot is a per-feature jexl callback slot (`contextVariable:
         * ['feature']`), so reading it here — with no feature in scope —
         * evaluates the callback against nothing and throws, taking the whole fit
         * layout down with it. And even where it holds a plain number it names
         * the plain-rect glyph's row height, which is not what a UTR or an
         * isoform inside a gene is drawn at.
         *
         * Reads the `full` rung specifically because it is the stack the ladder
         * always materializes, so it costs nothing extra. Box HEIGHTS don't vary
         * across rungs (only the label reservation does), but the set of boxes
         * counted can: `minDrawnBoxHeight` skips a feature the packer left
         * unplaced, and `bodies` — the only rung a squeeze ever runs on — packs
         * tighter and so places features `full` pushed past the row limit. On a
         * stack deep enough to truncate at `full`, the floor is therefore
         * measured over a subset and can allow a squeeze slightly past the
         * MIN_FIT_BOX_PX promise. Reading it off `bodies` instead would be
         * circular — that layout is chosen using this scale.
         *
         * Narrowed to `fitMeasureFeatureIds`, the same on-screen set every rung
         * is measured over.
         */
        get fitSmallestBoxPx() {
          return minDrawnBoxHeight(
            this.baseLaidOutDataMap,
            self.fitMeasureFeatureIds,
          )
        },
        /**
         * #getter
         * Floor on the fit squeeze: the smallest vertical scale that still leaves
         * every drawn box at least `MIN_FIT_BOX_PX` tall. When boxes would pack
         * tighter than this the squeeze stops here and the surplus scrolls instead
         * of vanishing. `squeezeFloorScale` answers both degenerate cases (nothing
         * drawn, or boxes already at the minimum) as 1 — no squeeze available — so
         * there is nothing to clamp or zero-check here.
         */
        get fitMinScale() {
          return squeezeFloorScale(this.fitSmallestBoxPx, MIN_FIT_BOX_PX)
        },
        /**
         * #getter
         * Ceiling on the fit grow: the largest vertical scale before a feature body
         * exceeds the height it would have outside fit mode. A sparse stack grows
         * to fill the track only until its bodies reach that height, so fit never
         * makes a feature taller than the display normally draws it. In normal
         * display mode the laid-out body already is that height, pinning the scale
         * at 1 (no grow, surplus stays whitespace); a compact mode may grow back up
         * to — but not past — it.
         *
         * That works out to exactly `1 / multiplier`, with no body height read at
         * all: the grow target is the unmultiplied height and the laid-out body is
         * that height times the mode's multiplier, so it cancels whatever it was
         * per feature and the ceiling is purely the display mode's compact ratio (1
         * in normal mode → no grow). Unlike the squeeze floor, which has to know
         * the shortest actual box (see `fitSmallestBoxPx`), this bound is uniform.
         */
        get fitMaxScale() {
          return Math.max(1, 1 / HEIGHT_MULTIPLIERS[self.displayMode])
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The resolved fit outcome — which reservation `level` survived, its
         * unscaled `layout`, and the vertical `scale` to fill the track — bundled
         * so the three can never disagree. The ladder keeps the least reduction
         * whose *unscaled* stack fits the track height: `full` (names +
         * descriptions), else `labels` (drop descriptions), else `decimated` at a
         * whitespace factor solved to the height (`fitDecimatedSolved` — keeps as
         * many non-overlapping names as fit, filling the space continuously), else
         * `bodies` (drop names too, pack tight) when even the tightest decimation
         * overflows. The kept rung is then scaled to fill the track: grown up to
         * `fitMaxScale` when it fits with room to spare, but never past the normal
         * feature height — so in normal display mode grow is pinned at 1 and spare
         * space stays whitespace, while a compact mode may enlarge back up to
         * normal; or — only at the last `bodies` rung — squeezed down to
         * `fitMinScale` and scrolled if even that overflows. Non-fit modes stay at `full`, scale 1. Read off the unscaled
         * candidate heights so it can't feed back on its own `scale`. The ladder
         * walk + scale math live in `resolveFitLadder`.
         *
         * Every rung is measured over `fitMeasureFeatureIds` — on screen in fit
         * mode, everything otherwise — so the rung that survives and the squeeze
         * it gets are decided by the stack in view, not by the half-viewport of
         * buffered features packed on either side of it.
         */
        get fitStage(): FitStage {
          const base = self.baseLaidOutDataMap
          const fit = self.fitHeightToDisplay
          // Non-fit mode is the `full` rung with no scaling freedom:
          // minScale=maxScale=1 pins the scale at 1 and the lone rung lays out
          // only `base` (resolveFitLadder returns immediately on the last rung).
          // Routing both modes through resolveFitLadder keeps FitStage assembled
          // in one place, so its fields (level/layout/scale/contentHeight) can't
          // drift apart.
          return resolveFitLadder(
            fit
              ? [
                  { level: 'full', layout: () => base },
                  { level: 'labels', layout: () => self.fitLabelsOnlyLayout },
                  { level: 'decimated', layout: () => self.fitDecimatedSolved },
                  { level: 'bodies', layout: () => self.fitBodiesOnlyLayout },
                ]
              : [{ level: 'full', layout: () => base }],
            self.fitTargetHeight,
            fit ? self.fitMinScale : 1,
            fit ? self.fitMaxScale : 1,
            self.fitMeasureFeatureIds,
          )
        },
      }))
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
         */
        get laidOutDataMap(): ReadonlyMap<number, FeatureDataResult> {
          const { layout, scale } = self.fitStage
          return scale === 1 ? layout : scaleLaidOutData(layout, scale)
        },
        /**
         * #getter
         * Descriptions are painted only at the `full` stage (and whenever fit is
         * off). Every render-time consumer — label draw and the highlight/hit/SVG
         * label-width reservation — reads this so a box never reserves width for a
         * description it won't draw.
         */
        get renderedShowDescriptions() {
          return (
            self.effectiveShowDescriptions && self.fitStage.level === 'full'
          )
        },
        /**
         * #getter
         * Names are painted at every stage short of `bodies` (and whenever fit is
         * off), where the packer reserved row height + overhang for the names it
         * kept so they never overlap — including the `decimated` stage, whose
         * per-feature pruning happens inside the layout (dropped names are removed
         * from floatingLabelsData), not via this flag. At the `bodies` stage
         * nothing is reserved, so all names are hidden rather than drawn on top of
         * the boxes. Every render-time consumer reads this so hidden names reserve
         * nothing.
         */
        get renderedShowLabels() {
          return self.showLabels && self.fitStage.level !== 'bodies'
        },
        /**
         * #getter
         * A subfeature label (a transcript name under its gene) is a worker-baked
         * config choice rather than a fit rung — `showLabels`/`showDescriptions`
         * govern only the feature's OWN two lines, and the packer reserves this
         * label's row and overhang unconditionally to match. So it survives every
         * rung the two flags above drop, including `bodies`.
         *
         * What it does NOT survive is the squeeze. The rows it was reserved in are
         * spent in `bodyHeightPx` and scaled with everything else, while the text
         * draws at the mode's own font size — so at scale 0.3 a gene's transcript
         * names are painted over rows a third as tall as the text, on top of each
         * other and of the boxes. Below 1 they are hidden instead; at 1 (every
         * non-squeezed rung, and all of fixed/grow) nothing changed.
         */
        get renderedShowSubfeatureLabels() {
          return self.fitStage.scale >= 1
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        // The morph's progress with the easing curve applied. The ONE place
        // `easeInOutCubic` is called on it: the interpolated map below, the
        // overlay offset and the mid-flight re-seed in CanvasYMorph all read
        // this, so none of them can end up describing a different frame than
        // the one the canvas drew.
        get morphEased() {
          return easeInOutCubic(self.morphProgress)
        },
        /**
         * #getter
         */
        // What the canvas + DOM overlays actually draw. Identical to
        // `laidOutDataMap` except during a row re-pack, when feature Y eases
        // from the previous layout to the new one (see yMorph). Returns the
        // same object reference as `laidOutDataMap` when idle, so consumers
        // don't re-upload/re-render unless an animation is in flight.
        get renderDataMap(): ReadonlyMap<number, FeatureDataResult> {
          const from = self.morphFromTops
          const t = this.morphEased
          // t === 1 is the settled frame between the clock's final
          // setMorphProgress(1) and endYMorph clearing morphFromTops: every
          // feature already sits at its destination, so return laidOutDataMap by
          // reference (same as idle) instead of rebuilding an identical map. The
          // stable reference also lets the MobX computed skip a redundant
          // re-render when endYMorph then clears the morph.
          if (from === undefined || t === 1) {
            return self.laidOutDataMap
          }
          return interpolateYData(from, self.laidOutDataMap, t)
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        // Start the feature-Y transition from `fromTops` (each feature's row in
        // the layout being left) toward the current `laidOutDataMap`. The rAF
        // clock that advances `morphProgress` lives in FeatureComponent (it
        // observes `morphFromTops`) and recomputes t from `morphStartMs` each
        // frame, so resetting these mid-flight cleanly retargets the animation.
        // A zoom morph (300ms) finishes before the next zoom (coarseBpPerPx is
        // debounced 500ms), but non-debounced changes (pin toggle, region flip)
        // can land mid-morph; the CanvasYMorph autorun re-seeds `fromTops` from
        // the live displayed positions in that case so the retarget doesn't snap.
        beginYMorph(fromTops: Map<string, number>, fromMaxY: number) {
          self.morphFromTops = fromTops
          self.morphFromMaxY = fromMaxY
          self.morphStartMs = morphClockMs()
          self.morphProgress = 0
        },
        /**
         * #action
         */
        setMorphProgress(t: number) {
          self.morphProgress = Math.min(1, Math.max(0, t))
        },
        /**
         * #action
         */
        endYMorph() {
          self.morphFromTops = undefined
          self.morphProgress = 1
          // Cleared, not left behind: `maxY` reads it only while a morph is in
          // flight, but CanvasYMorph folds it into the next morph's hold with a
          // plain `Math.max`, which is only correct if a settled display reports
          // no held height.
          self.morphFromMaxY = 0
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        // The settled laid-out content height, ignoring any in-flight Y morph.
        // Content height without re-walking the scaled map: fitStage carries the
        // kept rung's unscaled height, and scaleLaidOutData multiplies every
        // bottomPx by scale, so this is exactly `maxBottom(laidOutDataMap)` over
        // the features the stage measured — every feature in grow/fixed mode, the
        // on-screen ones in fit mode (`fitMeasureFeatureIds`), which is what makes
        // a fitted track report the height of what it is showing rather than of
        // the buffer around it. This is what `grow` mode sizes the track to —
        // it must NOT include the morph hold below, or the track would bounce to
        // the taller of old/new content for the morph's duration and then
        // collapse. Scroll-extent consumers read the morph-aware `maxY` instead.
        get settledMaxY() {
          const { contentHeight: keptRungHeight, scale } = self.fitStage
          const raw = keptRungHeight * scale
          // Snap away a sub-pixel float-epsilon overflow while a fit scale (grow or
          // squeeze) is active, so a fitted track doesn't spuriously scroll (see
          // snapFittedContentHeight). Reads the config-slot height (fitTargetHeight),
          // not the reactive `height` getter, so grow mode's `height`→grownHeight→
          // settledMaxY chain can't cycle back on itself.
          return snapFittedContentHeight(raw, self.fitTargetHeight, scale !== 1)
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
        // Over `fitMeasureFeatureIds` in fit mode, like every other measurement
        // the ladder takes: the tooltip tells the user to filter or zoom in, and
        // a count including the fetch buffer said that about features a pan would
        // have shown. Everything outside fit mode, where the set is undefined.
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
        // at MIN_GROW_HEIGHT so a sparse track doesn't collapse to a sliver and
        // capped by the `maxHeight` config slot.
        //
        // Height-independent — settledMaxY reads the config-slot
        // `fitTargetHeight`, never the reactive `height` getter — which is what
        // lets the mixin's `height` return this in grow mode without cycling.
        // `grownHeight`, the `height` override and the grow-aware `resizeHeight`
        // all come from the mixin.
        get growTargetHeight() {
          // Ceiling last, so a `maxHeight` configured below MIN_GROW_HEIGHT
          // still wins: `clamp` tests its floor first and would hand back a
          // height above the cap the config asked for. The floor is a guess
          // about usable tracks, the ceiling is an instruction.
          return Math.min(
            self.maxHeight,
            Math.max(MIN_GROW_HEIGHT, this.settledMaxY),
          )
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
      .views(self => ({
        /**
         * #method
         */
        // How far this feature's glyph is currently drawn from the row it is
        // laid out on, or 0 when no morph is easing it. The DOM overlay boxes
        // add it to their tops: they take geometry from `featureItemMap`, which
        // is built off the settled `laidOutDataMap` so hit targets are the
        // destination, and without this a selection or hover box sits on the
        // destination row for the morph's 300ms while the glyph inside it is
        // still travelling. A subfeature rides its parent's row, so its box
        // takes the parent's offset.
        morphOffsetFor(featureId: string) {
          const from = self.morphFromTops
          if (from === undefined) {
            return 0
          }
          const topLevelId = self.featureIdIndex.has(featureId)
            ? featureId
            : (self.subfeatureIdIndex.get(featureId)?.parentFeatureId ??
              featureId)
          const item = self.featureIdIndex.get(topLevelId)
          return item === undefined
            ? 0
            : morphOffset(from, topLevelId, item.topPx, self.morphEased)
        },

        /**
         * #getter
         */
        get hoveredFeature() {
          const id = self.featureIdUnderMouse
          return id ? (self.featureIdIndex.get(id) ?? null) : null
        },

        /**
         * #getter
         */
        get hoveredSubfeature() {
          const id = self.subfeatureIdUnderMouse
          return id ? (self.subfeatureIdIndex.get(id) ?? null) : null
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
          const visibleRegions = getView(self).visibleRegions as VisibleRegion[]
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
          const bpPerPx = getView(self).coarseBpPerPx
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
        // stays painted through the refetch window:
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
          installPerRegionLifecycle(self, backend, {
            data: () => self.renderDataMap,
            render: b =>
              b.renderBlocks(
                self.renderBlocks,
                self.renderDataMap,
                self.renderState,
              ),
          })
        },

        /**
         * #action
         */
        // Inert while a context menu is open: openContextMenu pins the hover to
        // the menu's target so the highlight box always frames what the menu acts
        // on, and that pin has to survive the cursor drifting onto a neighbouring
        // feature's label (the label layer keeps emitting mousemove over its own
        // divs). Enforced here rather than at each call site because this model
        // owns both halves of the invariant — contextMenuInfo and the hover — so a
        // new hover source can't reintroduce the bug. closeContextMenu releases it.
        setHover(
          featureId: string | null,
          subfeatureId: string | null,
          tooltip: string[] | undefined,
        ) {
          if (self.contextMenuInfo) {
            return
          }
          self.featureIdUnderMouse = featureId
          self.subfeatureIdUnderMouse = subfeatureId
          // The two ids above are primitives, so MobX already drops a rewrite
          // with the same value; the tooltip is a fresh array on every hit and
          // needs the comparison spelled out. Without it a cursor resting on one
          // feature re-rendered `FeatureTooltip` on every raw mousemove — the
          // rows were identical each time, and only the array's identity moved.
          if (!sameOptionalStrings(self.mouseoverExtraInformation, tooltip)) {
            self.mouseoverExtraInformation = tooltip
          }
        },

        /**
         * #action
         */
        // Holds the same pin as setHover, so the box can't be dropped out from
        // under an open menu — by a viewport shift (the clear-on-viewport-change
        // autorun), or by the cursor leaving the canvas for the menu itself.
        // closeContextMenu clears contextMenuInfo first, so its own call lands.
        clearHover() {
          if (!self.contextMenuInfo) {
            self.featureIdUnderMouse = null
            self.subfeatureIdUnderMouse = null
            self.mouseoverExtraInformation = undefined
          }
        },

        /**
         * #action
         */
        // Close the feature context menu and drop the hover it was pinned to.
        closeContextMenu() {
          self.contextMenuInfo = undefined
          this.clearHover()
        },

        /**
         * #action
         */
        // Pin/unpin a feature to the top of the layout. Toggling mutates the
        // observable array, which reruns the layout (see pinnedFeatureIdSet)
        // and animates the feature to/from its top row via the Y morph.
        //
        // Pinning also resets scroll, for the reason `showAllHidden` does: the
        // feature lands in a top row, and a track scrolled past that row would
        // show the user's "Pin to top" making the feature vanish upward. A pin
        // does not shrink the content, so the layout autorun's maxScroll clamp
        // never fires here. Unpinning leaves the scroll alone — that returns the
        // feature to its natural row and is not a request to look at anything.
        togglePinnedFeature(featureId: string) {
          toggleArrayMember(self.pinnedFeatureIds, featureId)
          if (self.pinnedFeatureIds.includes(featureId)) {
            self.setScrollTop(0)
          }
        },
        /**
         * #action
         * Open or re-collapse one gene's isoforms, from the badge on its own
         * label. Nothing else has to change: the badge's text comes from the
         * worker's own `isoformOverflow`, which reports what the collapse WOULD
         * hide whether or not this gene is in the set — so the badge that
         * opened a gene is the badge that closes it again.
         */
        toggleExpandedGene(featureId: string) {
          toggleArrayMember(self.expandedGeneIds, featureId)
        },
        /**
         * #action
         * Re-collapse every gene opened from a badge.
         */
        clearExpandedGenes() {
          self.expandedGeneIds.clear()
        },

        /**
         * #action
         */
        // Unpin every feature. The track-level counterpart of the per-feature
        // "Unpin from top", and the only way back once the pinned feature is out
        // of reach: `togglePinnedFeature` needs the feature under the cursor, and
        // a pin outlives the navigation that created it — nothing on screen marks
        // a pinned feature, and the set persists in the snapshot, so a pin left on
        // another chromosome goes on claiming a top row wherever it is drawn with
        // no affordance naming it. Same gap, and the same shape of answer, as
        // `clearFeatureHighlights`.
        clearPinnedFeatures() {
          self.pinnedFeatureIds.clear()
        },

        /**
         * #action
         */
        // Add/remove a feature from the "show only" collection. Ctrl+clicking a
        // feature and the right-click "Add/Remove" item both route here. If a
        // removal empties an applied set, drop back to showing everything.
        toggleSoloFeature(featureId: string) {
          toggleArrayMember(self.soloFeatureIds, featureId)
          // A removal that empties an applied set drops back to showing all
          // (adding never empties, so this only fires on removal).
          if (self.soloFeatureIds.length === 0) {
            self.soloApplied = false
          }
        },

        /**
         * #action
         */
        // Stop isolating and drop the whole collection.
        clearSolo() {
          self.soloFeatureIds.clear()
          self.soloApplied = false
        },

        /**
         * #action
         */
        // Hide a single feature (add to the exclusion set). Applies immediately.
        hideFeature(featureId: string) {
          if (!self.hiddenFeatureIds.includes(featureId)) {
            self.hiddenFeatureIds.push(featureId)
          }
        },

        /**
         * #action
         */
        // Bring back every hidden feature. Reset scroll so a re-shown feature
        // that first-fits to a top row (it re-enters layout as "new", with no
        // prior-y to hold its old row) lands in view instead of above a
        // scrolled-down viewport.
        showAllHidden() {
          self.hiddenFeatureIds.clear()
          self.setScrollTop(0)
        },

        /**
         * #action
         */
        // Replace the highlight set (a search selecting a new gene supersedes the
        // previous highlight rather than accumulating). Resolved lazily against
        // rendered features via highlightedFeatureIdSet.
        setFeatureHighlights(highlights: FeatureHighlight[]) {
          self.featureHighlights = cast(highlights)
        },

        /**
         * #action
         */
        // Additively highlight one rendered feature (right-click "Highlight
        // feature"). Unlike setFeatureHighlights, which replaces the set so a new
        // search supersedes the old one, manual highlights accumulate so a user
        // can mark several features at once; skip the add if this exact feature
        // (by id) is already highlighted (idempotent re-highlight). Dedupe on the
        // stored featureId, so re-highlighting a gene never collides with a
        // separately highlighted transcript that shares its span.
        addFeatureHighlightForItem(target: HighlightTarget, refName: string) {
          const already = self.featureHighlights.some(
            h => h.featureId === target.featureId,
          )
          if (!already) {
            self.featureHighlights.push({
              refName,
              start: target.startBp,
              end: target.endBp,
              name: target.name,
              featureId: target.featureId,
            })
          }
        },

        /**
         * #action
         */
        // Drop the highlights that actually box this rendered id, asking the same
        // resolution the overlay draws from — so "Remove highlight" removes
        // exactly the boxes the user is looking at, and the menu's label can't
        // disagree with what its click does.
        //
        // Deliberately NOT a re-match against the stored signature. The matchers
        // are heuristic by necessity (trix records no uniqueId, so a highlight is
        // pinned by span + a label that may be a custom/indexed string), and a
        // heuristic match is a fine basis for best-effort boxing but a bad one
        // for deleting: a gene-wide highlight fuzzily matches an isoform sharing
        // its span, so removing that isoform's highlight used to silently take
        // the gene's with it. Attribution still clears a search-drifted
        // highlight — resolution matched it by span in the first place.
        removeFeatureHighlightsForId(featureId: string) {
          const { boxedBy } = self.resolvedHighlights
          self.featureHighlights = cast(
            self.featureHighlights.filter(
              (_h, i) => !boxedBy[i]?.has(featureId),
            ),
          )
        },

        /**
         * #action
         */
        clearFeatureHighlights() {
          self.featureHighlights.clear()
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        // Isolate to the collected set (worker drops non-members). No transient
        // snackbar: the persistent SoloSelectionChip is both the confirmation
        // and the later-undo affordance (its × clears the set at any time), so a
        // toast that auto-hides would only duplicate it and vanish before the
        // user finishes exploring.
        applySolo() {
          if (self.soloFeatureIds.length === 0) {
            return
          }
          self.soloApplied = true
        },

        /**
         * #action
         */
        // One-shot single-feature isolate: replace the collection with just this
        // feature and apply immediately (the common "show only this one" case).
        soloFeature(featureId: string) {
          self.soloFeatureIds.replace([featureId])
          self.soloApplied = true
        },
      }))
      .actions(self => {
        // cache the header-metadata round-trip so repeated feature clicks reuse
        // one fetch; cleared on failure so a later click retries
        let metadataPromise: Promise<unknown> | undefined
        return {
          /**
           * #action
           * Open the feature-details widget. The adapter's header metadata
           * (VCF INFO/FORMAT descriptions, etc.) is fetched first and passed as
           * `descriptions` so the widget can label attribute rows and — for the
           * variant widget — resolve the ANN/CSQ column names; without it that
           * table renders headerless. CoreGetMetadata returns null for adapters
           * that expose none, so this is a no-op for those tracks.
           */
          selectFeature(feature: Feature) {
            if (!metadataPromise) {
              metadataPromise = getSession(self)
                // A header block already parsed by the fetch that put the
                // feature on screen, memoized here so repeated clicks reuse one
                // round trip. Nothing to narrate, and nothing a cancel could
                // save — the widget opens on the result.
                // eslint-disable-next-line no-restricted-syntax
                .rpcManager.call(getRpcSessionId(self), 'CoreGetMetadata', {
                  adapterConfig: self.adapterConfig,
                })
                .catch((e: unknown) => {
                  metadataPromise = undefined
                  throw e
                })
            }
            metadataPromise
              .then(descriptions => {
                if (isAlive(self)) {
                  openFeatureWidget(self, feature.toJSON(), {
                    widget: self.featureWidgetType,
                    extra: { descriptions },
                    feature,
                  })
                }
              })
              .catch((e: unknown) => {
                console.error(e)
                getSession(self).notifyError(`${e}`, e)
              })
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
          setColorLegendDismissed(value: boolean) {
            self.colorLegendDismissed = value
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

          /**
           * #action
           */
          // One object rather than positional args: every new hit-derived
          // field the menu wants would otherwise widen this signature and the
          // two call sites' prop types too (same idiom as
          // LinearMultiRowFeatureDisplay's openContextMenu).
          openContextMenu(info: FeatureContextMenuInfo) {
            self.contextMenuInfo = info
            // Pin the hover to the menu's target so its highlight box always
            // matches what the menu acts on — for every entry point (canvas or
            // label right-click), and even when no mousemove preceded this
            // open. When the click landed on a transcript, keep the box on that
            // transcript: the menu names it, so the box must agree. Drop the
            // tooltip so it doesn't overlap the menu. closeContextMenu clears
            // all of this again.
            self.featureIdUnderMouse = info.item.featureId
            self.subfeatureIdUnderMouse = info.subfeature?.featureId ?? null
            self.mouseoverExtraInformation = undefined
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
          getSession(self).queueDialog(handleClose => [
            SetColorDialog,
            { model: self, handleClose, showUtrColor },
          ])
        },

        /**
         * #action
         */
        openColorByAttributeDialog() {
          getSession(self).queueDialog(handleClose => [
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
          getSession(self).queueDialog(handleClose => [
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
          return fetchCanvasFeatureDetails(
            getSession(self),
            getRpcSessionId(self),
            self.adapterConfig,
            featureId,
            region,
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
        // The only bpPerPx-dependent worker decision is the amino-acid overlay
        // (gated by shouldRenderPeptideBackground), so the key is that discrete
        // threshold rather than the zoom itself — every other zoom change reuses
        // the cached features.
        //
        // A getter, not an action: an action would untrack the view.bpPerPx read.
        get regionFetchKey(): string {
          return String(shouldRenderPeptideBackground(getView(self).bpPerPx))
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
          void withFeatureDetails(
            self,
            () => self.fetchFullFeature(featureId, displayedRegionIndex),
            parentFeature => {
              const target = subfeatureInfo
                ? (findSubfeatureById(
                    parentFeature,
                    subfeatureInfo.featureId,
                  ) ?? parentFeature)
                : parentFeature
              self.selectFeature(target)
            },
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
            const view = getView(self)
            if (view.initialized) {
              self.fetchNeeded(view.bufferedVisibleRegions)
            }
          },

          /**
           * #action
           */
          fetchNeeded(
            needed: { region: Region; displayedRegionIndex: number }[],
          ) {
            const view = getView(self)
            const bpPerPx = view.bpPerPx
            // Both gate budgets, read once for the whole batch. Not in
            // `rpcProps()` — see the note there for why they must not be cache
            // keys.
            const byteLimit = self.resolvedByteLimit()
            const maxFeatureDensity = self.maxFeatureDensity
            // captured here, not at commit time
            const issued = self.gateFetchState()
            // Drop cached entries (rpcDataMap + density stats) for regions no
            // longer visible. Keeps on-screen data so labels stay up during
            // the refetch window without letting either map grow unboundedly
            // as the user pans.
            self.pruneRpcDataMapToVisible(
              new Set(
                view.bufferedVisibleRegions.map(b => b.displayedRegionIndex),
              ),
            )
            const regions = new Map(
              needed.map(n => [n.displayedRegionIndex, n.region]),
            )
            // Per-region byte/density estimates keyed by the index `onResult`
            // reports back, committed to the shared gate once the batch ends. A
            // region whose fetch was skipped as stale never lands here.
            const gateResults = new Map<number, RenderFeatureDataResult>()
            void fetchEachRegion(self, needed, {
              call: (region, ctx) => {
                // Per-region translation table from the assembly's geneticCodes
                // config (alias-bridged via getGeneticCodeId), so the worker can
                // translate peptides on contigs whose features carry no
                // transl_table.
                const assembly = getSession(self).assemblyManager.get(
                  region.assemblyName,
                )
                return ctx.callRpc('RenderFeatureData', {
                  adapterConfig: self.adapterConfig,
                  geneticCodeId: assembly?.getGeneticCodeId(region.refName),
                  ...self.rpcProps(),
                  region,
                  bpPerPx,
                  byteLimit,
                  maxFeatureDensity,
                })
              },
              // `fetchEachRegion` marks the region loaded for us, and skips a
              // refused one — same `isRegionRefused` test as here, so what we
              // store and what `loadedRegions` claims cannot come apart.
              onResult: (displayedRegionIndex, result) => {
                gateResults.set(displayedRegionIndex, result)
                if (!isRegionRefused(result)) {
                  self.setRpcData(
                    displayedRegionIndex,
                    result,
                    regions.get(displayedRegionIndex)!,
                  )
                }
              },
              // Byte **max**, not sum, so a multi-region view where each region
              // fits isn't blanked by the cross-region total. Assembled from
              // `needed`, which already carries each region's span, so the region
              // pairs with its result by construction.
              onComplete: () => {
                const measurements: RegionGateMeasurement[] = []
                for (const { region, displayedRegionIndex } of needed) {
                  const result = gateResults.get(displayedRegionIndex)
                  if (result) {
                    measurements.push({ displayedRegionIndex, region, result })
                  }
                }
                self.commitGateMeasurements(measurements, issued)
              },
            })
          },
        }
      })
      .actions(self => {
        return {
          /**
           * #action
           */
          // No superAfterAttach() call: the fork auto-chains hooks, so
          // MultiRegionDisplayMixin's afterAttach already runs (see
          // afterAttachAutoChain.test.ts). An explicit call would double-install
          // its fetch autoruns.
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
            // Grow mode needs no autorun to drive height: the `height` getter
            // returns `grownHeight` reactively (see the getter above), so
            // consumers recompute when the laid-out content changes without ever
            // writing the height config slot. Leaving grow is the one write —
            // bake the grown height into the slot on any grow->non-grow exit
            // (menu switch, reset-to-default, or a session-default change flipping
            // a track that follows the default) so fixed/fit resume from the height the user was
            // seeing, not the stale slot.
            addDisposer(self, installGrowExitBake(self, getView(self)))

            // The scroll clamp (both the shrink autorun and the bound on
            // setScrollTop) is TrackHeightMixin's, earned by overriding
            // `scrollableHeight`.

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
            // caches them. Their sole consumer is hit-testing inside DOM event
            // handlers, and MobX suspends a computed with no observers — so
            // without this subscription every mousemove rebuilt a Hilbert-sorted
            // Flatbush per visible region. Subscribing moves that rebuild onto the
            // layout's own cadence (it recomputes only when laidOutDataMap /
            // coarseBpPerPx / label visibility actually change), which is a small
            // marginal cost on top of the strictly more expensive layout pass that
            // already runs eagerly for every track on those same inputs.
            // autorunOnReadyView because flatbushIndexes transitively reads view
            // geometry that throws before the view is measured.
            //
            // The two id->item maps ride along for the same reason, and they
            // suspend far more often than the Flatbush ones: their only readers
            // are hoveredFeature/hoveredSubfeature, which short-circuit to null
            // when nothing is under the cursor — so the dependency disappears on
            // every hover-out, and the next hover-in rebuilt a Map over every
            // laid-out feature. Drag-panning over a track hit that on every
            // frame (the clearHover-on-viewport-change autorun below un-hovers,
            // the next mousemove re-hovers).
            autorunOnReadyView(
              self,
              () => {
                void self.flatbushIndexes
                void self.featureIdIndex
                void self.subfeatureIdIndex
              },
              { name: 'CanvasHitIndexes' },
            )

            // Clear hover when the viewport moves under a stationary cursor
            // (pan, zoom, internal vertical scroll). Shared with the alignments
            // display; see installClearHoverOnViewportChange.

            // Drive the feature-Y transition. When laidOutDataMap re-packs at
            // the same vertical scale (a zoom step — not a label/mode change,
            // which alters row heights), animate from the previous rows to the
            // new ones; otherwise snap. Compares to the prior map kept in
            // closure so the trigger is the layout change itself.
            // Seeded lazily on the autorun's first initialized run, NOT here:
            // showLabels/effectiveShowDescriptions transitively read view.width
            // (via the density gate), which throws before the view is measured.
            // Reading them synchronously in afterAttach would throw during
            // session restore — propagating out of display instantiation and
            // making the session loader drop the display as "unhydratable".
            // These prevs are only compared once prevLayout is non-undefined,
            // which can't happen until after the first guarded run has set them.
            let prevLayout: ReadonlyMap<number, FeatureDataResult> | undefined
            let prevGeometry: string | undefined
            // autorunOnReadyView gates on view.initialized — laidOutDataMap is
            // empty until then, and rowGeometrySignature reads renderedShow*
            // which read view.width (which throws pre-measure), so the body must
            // not run until the view is ready. prevs stay undefined until the
            // first ready run seeds them; they're only compared once prevLayout
            // is non-undefined, which can't happen before that first run.
            autorunOnReadyView(
              self,
              () => {
                const current = self.laidOutDataMap
                // Same row heights/scale as the previous layout means the change
                // is a same-scale zoom re-pack (row *assignment* only) and can
                // morph; a changed signature rescaled every row (mode/label/fit-
                // level change, or a fit squeeze) and must snap. See
                // rowGeometrySignature for why it reads the rendered, not raw,
                // label/description flags.
                const { level } = self.fitStage
                const geometry = rowGeometrySignature({
                  displayMode: self.displayMode,
                  renderedShowLabels: self.renderedShowLabels,
                  renderedShowDescriptions: self.renderedShowDescriptions,
                  fitScale: self.fitScale,
                  fitLevel: level,
                  // Only where it selects rows: at any other rung the solve is
                  // never run, and reading it would pay for a bisection to
                  // discriminate stacks it had no hand in.
                  labelRoomFactor:
                    level === 'decimated' ? self.fitDecimatedFactor : undefined,
                })
                const scaleUnchanged = geometry === prevGeometry
                const from = prevLayout
                prevLayout = current
                prevGeometry = geometry
                // Not a real layout-to-layout transition (first data, an
                // empty map on nav) — nothing to morph or snap.
                if (
                  from === undefined ||
                  from === current ||
                  from.size === 0 ||
                  current.size === 0
                ) {
                  return
                }
                // scrollTop/height are viewport state, not layout inputs, and
                // morphFromTops/morphProgress/morphFromMaxY advance every rAF
                // frame — read all untracked so neither writing scrollTop back
                // below nor the morph clock can re-trigger this layout autorun.
                const { scrollTop, height, fromTops, fromMaxY } = untracked(
                  () => {
                    // A morph still in flight means a second, non-debounced
                    // layout change (a pin toggle or region flip — unlike zoom)
                    // is interrupting it. Re-seed the next morph from each
                    // feature's live displayed position instead of `from`'s
                    // settled rows so mid-flight features don't snap, and hold
                    // the content height across the taller of the two morphs so
                    // a feature easing up from a deep row isn't clipped. With
                    // nothing in flight both fall through to `from` alone: no
                    // morphFromTops eases the capture, and endYMorph zeroed the
                    // held height.
                    return {
                      scrollTop: self.scrollTop,
                      height: self.height,
                      fromTops: captureFeatureTops(
                        from,
                        self.morphFromTops,
                        self.morphEased,
                      ),
                      fromMaxY: Math.max(maxBottom(from), self.morphFromMaxY),
                    }
                  },
                )
                // Whenever the new layout is shorter than the current scroll
                // position, clamp back into range so the viewport can't strand
                // past the content bottom. This happens on same-scale repacks
                // (zoom-in de-stacking rows) AND on mode/label changes (compact
                // mode shrinks every row) — so it must run before the branch
                // below, not only in the same-scale path. Clamp to the incoming
                // layout's own bottom, NOT self.scrollableHeight/maxY: mid-morph
                // those are held at the taller of old/new (morphFromMaxY,
                // anti-clip), so reusing them here would skip clamping to the
                // shorter incoming content until the morph settles.
                const maxScroll = Math.max(0, maxBottom(current) - height)
                if (scrollTop > maxScroll) {
                  self.setScrollTop(maxScroll)
                }
                // Only a same-scale repack (a zoom step) has comparable rows to
                // pin against; a mode/label change rescales every row, so let it
                // snap without a row morph.
                if (
                  scaleUnchanged &&
                  morphAllowed(getSession(self).animationMode) &&
                  canMorph(fromTops, current)
                ) {
                  self.beginYMorph(fromTops, fromMaxY)
                } else {
                  self.endYMorph()
                }
              },
              { name: 'CanvasYMorph' },
            )
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
          return canvasTrackMenuItems(self)
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
