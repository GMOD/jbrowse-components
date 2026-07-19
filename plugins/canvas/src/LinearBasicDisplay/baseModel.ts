import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  getConfResolved,
  makeDisplayTypeDefaultControl,
  readConfObject,
  resolvePromotableConfigSnapshot,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { promotableRadioItem } from '@jbrowse/core/ui'
import { Highlighter } from '@jbrowse/core/ui/Icons'
import {
  clamp,
  getContainingTrack,
  getContainingView,
  getSession,
  isFeature,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, cast, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  GROW_MAX_HEIGHT,
  HeightModeMixin,
  MultiRegionDisplayMixin,
  PromotableDefaultsMixin,
  TrackHeightMixin,
  autorunOnReadyView,
  heightModeMenuItems,
  installGrowExitBake,
  onDisplayedRegionsChange,
} from '@jbrowse/plugin-linear-genome-view'
import { createRegionUploadSync } from '@jbrowse/render-core/regionUploadSync'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import HeightIcon from '@mui/icons-material/Height'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import PaletteIcon from '@mui/icons-material/Palette'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import PlaylistRemoveIcon from '@mui/icons-material/PlaylistRemove'
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { autorun, observable, toJS, untracked } from 'mobx'

import {
  fetchCanvasFeatureDetails,
  findSubfeatureById,
  indexById,
  inlineRadioGroup,
  toggleArrayMember,
} from './baseModelHelpers.ts'
import CanvasFeatureGateMixin from '../shared/CanvasFeatureGateMixin.ts'
import {
  buildFeatureFlatbushIndex,
  buildSubfeatureFlatbushIndex,
} from './components/hitTesting.ts'
import { LABEL_CULL_BUCKET_PX } from './components/labelPositioning.ts'
import {
  resolveFeatureHighlights,
  targetMatchesHighlight,
} from './featureHighlight.ts'
import { resolveFitLadder, snapFittedContentHeight } from './fitLadder.ts'
import {
  computeLaidOutData,
  createIncrementalLayout,
  maxBottom,
  scaleLaidOutData,
} from './layout.ts'
import {
  canMorph,
  captureDisplayedTops,
  captureFeatureTops,
  easeInOutCubic,
  interpolateYData,
  rowGeometrySignature,
} from './yMorph.ts'
import {
  FEATURE_DEFAULT_COLOR,
  UTR_DEFAULT_COLOR,
} from '../RenderFeatureDataRPC/featureColors.ts'
import {
  HEIGHT_MULTIPLIERS,
  labelFontSize,
} from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { THEME_DERIVED_COLOR } from '../RenderFeatureDataRPC/renderConfig.ts'
import { shouldRenderPeptideBackground } from '../RenderFeatureDataRPC/zoomThresholds.ts'

import type {
  DisplayConfig,
  DisplayMode,
} from '../RenderFeatureDataRPC/renderConfig.ts'
import type { CanvasFeatureRenderingBackend } from './components/canvasFeatureRenderingBackendTypes.ts'
import type {
  FeatureItemEntry,
  FlatbushRegionIndexes,
  VisibleRegion,
} from './components/hitTesting.ts'
import type { LinearBasicDisplayConfigModel } from './configSchema.ts'
import type {
  FeatureHighlight,
  HighlightTarget,
  ResolvedHighlights,
} from './featureHighlight.ts'
import type { FitStage } from './fitLadder.ts'
import type { IncrementalLayout } from './layout.ts'
import type { ShowLabelsMode } from './showLabelsMode.ts'
// rpcTypes.ts also declares the RpcRegistry augmentation; importing any type
// from it is enough to make rpcManager.call() resolve to the typed args.
import type {
  FeatureDataResult,
  FlatbushItem,
  RenderFeatureDataResult,
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AnimationMode, Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IAnyStateTreeNode, SnapshotIn } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  HeightMode,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

// Single source for the "Feature height" radio options and their labels, so a
// fourth mode can't drift between the menu and the label lookup.
export const displayModeOptions: { value: DisplayMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'compact', label: 'Compact' },
  { value: 'superCompact', label: 'Super-compact' },
  { value: 'collapsed', label: 'Collapsed' },
]

// Persistent, declarative feature-highlight request (see featureHighlight.ts).
// A plain span+name signature — never the adapter uniqueId — so it can be
// authored in a session snapshot / URL and resolved once the region renders.
// Mirror of the plain FeatureHighlight signature: the pure matcher + search
// bridge use the interface, this MST model persists it, and
// setFeatureHighlights(cast(...)) silently DROPS any field the model lacks — so
// the assertion below fails typecheck if the two ever drift.
const FeatureHighlightModel = types.model('FeatureHighlight', {
  refName: types.string,
  start: types.number,
  end: types.number,
  name: types.maybe(types.string),
  subfeature: types.maybe(types.boolean),
})

// Compile-time proof the persisted model's snapshot and the plain
// FeatureHighlight interface stay structurally identical (checked both ways, the
// same AssignableTo guard idiom as modelContract.ts). Errors here instead of a
// silent field drop the next time either side gains a field.
type AssignableTo<A extends B, B> = A
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _HighlightModelToInterface = AssignableTo<
  SnapshotIn<typeof FeatureHighlightModel>,
  FeatureHighlight
>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _HighlightInterfaceToModel = AssignableTo<
  FeatureHighlight,
  SnapshotIn<typeof FeatureHighlightModel>
>

// Region identity (regionKey/reversed) is stored alongside the data so layout
// grouping derives from rpcDataMap directly. Deriving it from loadedRegions
// instead would lag: loadedRegions is cleared on every settings change but
// rpcDataMap is preserved through the refetch window, and loadedRegions is
// populated one action after setRpcData. During that gap every region would
// collapse to one layout group and features from different refs would mis-stack.
type LoadedFeatureData = FeatureDataResult & {
  loadedBpPerPx: number
  regionKey: string
  // canonical refName, kept alongside the raw features so a highlight can be
  // resolved to its uniqueId *before* layout (see highlightedFeatureIdSet)
  refName: string
  reversed: boolean
}

export function getView(self: IAnyStateTreeNode): LGV {
  return getContainingView(self) as LGV
}

const morphClockMs = () =>
  typeof performance === 'undefined' ? 0 : performance.now()

// Animate only where a frame clock exists and the resolved animation mode
// allows it: 'enabled' always animates, 'disabled' never does, and 'system'
// honors the OS prefers-reduced-motion setting (so reduced-motion users get
// instant snaps unless they explicitly opt in). Mode comes from the session
// preference (configuration.preferences.animationMode + user override).
function morphAllowed(mode: AnimationMode) {
  const hasFrameClock = typeof requestAnimationFrame === 'function'
  const prefersReduced =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    hasFrameClock &&
    (mode === 'enabled' || (mode === 'system' && !prefersReduced))
  )
}

export type { Region } from '@jbrowse/core/util'

const ColorByAttributeDialog = lazy(
  () => import('./components/ColorByAttributeDialog.tsx'),
)
const FeatureComponent = lazy(() => import('./components/FeatureComponent.tsx'))
const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))
const AddFiltersDialog = lazy(() => import('./components/AddFiltersDialog.tsx'))

const STRAND_COLOR_JEXL =
  "jexl:get(feature,'strand')==1?'tomato':get(feature,'strand')==-1?'cornflowerblue':'goldenrod'"

// Floor for the auto-fit height so a sparse/empty track doesn't collapse to a
// sliver. Capped by the maxHeight config in naturalContentHeight.
const MIN_FIT_HEIGHT = 50

// Smallest feature-body height (px) the fit squeeze may leave. Once bodies would
// pack tighter than this the squeeze stops and the surplus scrolls, rather than
// shrinking boxes to invisibility. See `fitMinScale`.
const MIN_FIT_BOX_PX = 2

// Fit-mode name-decimation solve (see `fitDecimatedSolved`). The whitespace
// factor keepFeatureLabel demands is searched in [0, MAX], where 0 keeps every
// name (tallest) and MAX keeps only the most isolated (plus pinned) — beyond ~8x
// almost nothing but pinned survives, so it caps the search. ITERS bisections
// give ~MAX/2^ITERS factor resolution, enough to land the stack within one label
// row of the track height without an over-long probe loop.
const FIT_MAX_ROOM_FACTOR = 8
const FIT_SOLVE_ITERS = 8

// The vertical scale that resizes a laid-out feature body of `bodyPx` to exactly
// `targetPx` — the basis for the fit squeeze floor (target the absolute
// MIN_FIT_BOX_PX). 1 when there is no body to size, so a bound built on it
// collapses to a no-op scale. (The grow ceiling doesn't use this: its target is
// the normal featureHeight, so the ratio reduces to 1 / display-mode multiplier
// with featureHeight cancelling out — see fitMaxScale.)
function bodyScaleTo(bodyPx: number, targetPx: number) {
  return bodyPx > 0 ? targetPx / bodyPx : 1
}

// The "Show N hidden features" recovery item, shared by the feature context
// menu (Show/hide submenu) and the track menu (Edit filters submenu). Empty
// when nothing is hidden.
function showHiddenFeaturesMenuItems(self: {
  hiddenFeatureIds: { length: number }
  showAllHidden: () => void
}) {
  const n = self.hiddenFeatureIds.length
  return n > 0
    ? [
        {
          label: `Show ${n} hidden feature${n > 1 ? 's' : ''}`,
          icon: VisibilityIcon,
          onClick: () => {
            self.showAllHidden()
          },
        },
      ]
    : []
}

/**
 * #stateModel LinearCanvasBaseDisplay
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
  configSchema: AnyConfigurationSchemaType,
) {
  return (
    types
      .compose(
        'LinearCanvasBaseDisplay',
        BaseDisplay,
        TrackHeightMixin(),
        HeightModeMixin(),
        MultiRegionDisplayMixin(),
        // The whole byte + feature-density region-too-large gate: the model-side
        // sibling of DisplayChrome. Supplies densityStatsPerRegion,
        // userFeatureDensityLimit, byteSizeLimit(), maxFeatureDensity,
        // observedMaxDensity/visibleFeatureDensityPerPx, the dual-axis
        // setFeatureDensityStatsLimit, and commit/clear helpers — folded into the
        // feature fetch below. Same instance the multi-row display composes.
        CanvasFeatureGateMixin(),
        PromotableDefaultsMixin(configSchema),
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
        rpcDataMap: observable.map<number, LoadedFeatureData>(),
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
         */
        mouseoverExtraInformation: undefined as string | undefined,
        /**
         * #volatile
         */
        contextMenuInfo: undefined as
          | {
              item: FlatbushItem
              // The transcript under the cursor, when the right-click landed on
              // one. Lets the menu act on the specific isoform the user aimed
              // at rather than its whole gene. Absent for gene-level entry
              // points (the label layer) and for featureless glyphs.
              subfeature?: SubfeatureInfo
              displayedRegionIndex: number
              clientX: number
              clientY: number
            }
          | undefined,
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
        get conf(): LinearBasicDisplayConfigModel {
          return self.configuration
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get renderState() {
          const view = getView(self)
          return {
            scrollY: self.scrollTop,
            canvasWidth: view.trackWidthPx,
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
        get DisplayMessageComponent() {
          return FeatureComponent
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
        // sentinel enum (see baseConfigSchema.ts): getConfResolved walks the
        // customized-track -> session-default -> `normal` cascade and always returns
        // a concrete preset, never the `inherit` sentinel.
        get displayMode(): DisplayMode {
          return getConfResolved(self, 'displayMode')
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
          return getConf(self, 'showLabels')
        },

        /**
         * #getter
         */
        // Effective boolean visibility used by layout, hit testing, the DOM
        // overlay, and SVG export. 'auto' switches to false once feature
        // density crosses the readability threshold so layout-reserved label
        // space, the rendered DOM elements, and the hit-test geometry all
        // agree — otherwise rows reserve label height that never gets used.
        get showLabels() {
          // Collapsed mode is a single-row overview — suppress feature names so
          // nothing paints on top of the piled-up boxes. Gated here (not just at
          // renderedShowLabels) so layout row reservation, the DOM overlay, hit
          // testing, and SVG export all agree. Descriptions and subfeature labels
          // are suppressed separately (effectiveShowDescriptions / rpcProps).
          if (this.displayMode === 'collapsed') {
            return false
          }
          const mode = this.showLabelsMode
          if (mode === 'off') {
            return false
          }
          if (mode === 'on') {
            return true
          }
          return (
            self.visibleFeatureDensityPerPx <=
            getConf(self, 'maxLabelFeatureDensity')
          )
        },

        /**
         * #getter
         */
        get showDescriptions() {
          return getConf(self, 'showDescriptions')
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
        get utrColor(): string {
          return getConf(self, 'utrColor') ?? UTR_DEFAULT_COLOR
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
          // In auto mode the density gate hides both labels and descriptions
          // together. Manual 'off' only hides labels — descriptions remain
          // independently controllable. Collapsed suppresses them outright (like
          // names) — gated at this render-layer getter, not the raw
          // `showDescriptions` one, so the "Show descriptions" menu checkbox still
          // reflects the persisted setting rather than reading false while
          // collapsed (mirrors how subfeatureLabels is forced off in rpcProps,
          // not in its menu-facing getter).
          return (
            this.displayMode !== 'collapsed' &&
            this.showDescriptions &&
            (this.showLabelsMode !== 'auto' || this.showLabels)
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
         * #method
         * The filters actually applied, as `jexl:`-prefixed expressions. The
         * runtime override shadows the config slot when set; otherwise the
         * deferred-evaluation `jexlFilters` config slot is prefixed on read.
         * This is the single source of truth for both the worker (via rpcProps)
         * and the "Filter by..." dialog (so existing config filters show up and
         * are editable).
         */
        activeFilters(): string[] {
          return (
            toJS(self.jexlFiltersSetting) ??
            getConf(self, 'jexlFilters').map((f: string) => `jexl:${f}`)
          )
        },

        /**
         * #getter
         */
        get sequenceAdapter() {
          const { assemblyManager } = getSession(self)
          const track = getContainingTrack(self)
          const assemblyNames = readConfObject(
            track.configuration,
            'assemblyNames',
          ) as string[]
          const assembly = assemblyManager.get(assemblyNames[0]!)
          return assembly
            ? getConf(assembly, ['sequence', 'adapter'])
            : undefined
        },

        /**
         * #getter
         */
        get regionKeys() {
          const map = new Map<number, string>()
          for (const [num, data] of self.rpcDataMap) {
            map.set(num, data.regionKey)
          }
          return map
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
        // Resolve declarative highlights against the RAW fetched data (rpcDataMap)
        // rather than the laid-out data — deliberately pre-layout, so it can feed
        // both boxing and pinning without a layout→layout cycle (coords/name live
        // on the raw items, no row/topPx needed). See resolveFeatureHighlights for
        // the box/pin/boxedBy resolution rules.
        get resolvedHighlights(): ResolvedHighlights {
          return resolveFeatureHighlights(
            self.rpcDataMap.values(),
            self.featureHighlights,
          )
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
        get featureWidgetType() {
          return {
            type: 'BaseFeatureWidget',
            id: 'baseFeature',
          }
        },
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
          // resolvePromotableConfigSnapshot hands the worker concrete values for
          // every promotable slot (chevrons, subfeatureLabels, ...) instead of
          // their raw inherit sentinels — so a new promotable worker-slot needs
          // no rpcProps change here. The excluded slots are display-only (never
          // sent to the worker): showLabels/showDescriptions gate label
          // visibility on the main thread, displayMode drives compact/
          // superCompact height scaling and collapsed single-row packing there,
          // and heightMode is a pure main-thread track-height/layout strategy, so
          // excluding them keeps toggling those off the RPC cache key.
          const {
            showLabels: _l,
            showDescriptions: _d,
            displayMode: _dm,
            heightMode: _hm,
            ...rest
          } = resolvePromotableConfigSnapshot(self)
          return {
            // jexlFilters carries the effective runtime filters (mirrors the
            // effectiveGeneGlyphMode substitution in the concrete model); reading
            // activeFilters() here makes it an RPC cache key so toggling filters
            // refetches. buildFeatureAdmission normalizes the prefix either way.
            displayConfig: {
              ...rest,
              // Subfeature labels are worker-baked, so unlike name/description
              // labels they can't be gated on the main thread — force them off
              // here so collapsed mode suppresses every label.
              subfeatureLabels:
                self.displayMode === 'collapsed'
                  ? 'none'
                  : rest.subfeatureLabels,
              jexlFilters: self.activeFilters(),
            } as DisplayConfig,
            maxFeatureDensity: self.maxFeatureDensity,
            colorByCDS: self.colorByCDS,
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
         * source so the candidate layouts can't drift on bpPerPx / region keys /
         * display mode / pins.
         */
        get layoutInputs() {
          const view = getView(self)
          return {
            bpPerPx: view.coarseBpPerPx,
            regionKeys: self.regionKeys,
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
         * The `decimated` stack with its whitespace factor SOLVED to the track
         * height. A name is kept only where the feature has at least `factor ×` its
         * label width in neighbor whitespace (plus pinned/highlighted, always); the
         * factor is binary-searched so the packed stack just fits `fitTargetHeight`.
         * This fills the height with as many non-overlapping names as fit — rather
         * than snapping between a few fixed rungs — because stack height is monotone
         * in the factor (higher factor drops more names → shorter), so the search
         * keeps the SMALLEST fitting factor, i.e. the MOST names. It decimates by
         * isolation, not feature size/"importance" (no reliable importance signal —
         * a tiny miRNA can outrank a large pseudogene), so it just maximizes how
         * many readable names fit. Both the ~8 trial factors and the committed
         * layout go through the same pure `computeLaidOutData` at a factor: the
         * committed stack is *byte-identical* to the probe that was measured
         * against `trackHeight`, so the height the solve fits is exactly the height
         * `resolveFitLadder` sees. It deliberately does NOT reuse the incremental
         * memo here — the memo seeds each re-pack with the previous layout's rows
         * (`captureFeatureTops`), and seeding a new factor's (different) label set
         * from the old factor's rows packs the stack taller than the fresh probe,
         * pushing the committed stack over `trackHeight` and making the ladder
         * wrongly fall through to `bodies` (every label vanishing as the track
         * grows). When even `FIT_MAX_ROOM_FACTOR` overflows, the `labels` stack is
         * returned — it overflows (that is why the ladder reached this rung), so
         * `resolveFitLadder` descends to `bodies`, and reusing a stack already
         * packed spares the solve one more pack that would only be discarded.
         *
         * With names off entirely there is nothing to decimate — every factor packs
         * the `labels` stack (see keepFeatureLabel's `showLabels` guard) — so the
         * solve is skipped and that stack reused, turning the ~9 probes this rung
         * costs into zero on exactly the dense tracks where the auto density gate
         * hides names and fit mode is most used.
         */
        get fitDecimatedSolved(): Map<number, FeatureDataResult> {
          if (!self.layoutReady || !self.showLabels) {
            return this.fitLabelsOnlyLayout
          }
          const trackHeight = self.fitTargetHeight
          const layoutAtFactor = (labelRoomFactor: number) =>
            computeLaidOutData(self.rpcDataMap, {
              ...self.layoutInputs,
              showLabels: self.showLabels,
              showDescriptions: false,
              labelDecimation: 'fitWidth',
              labelRoomFactor,
            })
          // Binary-search the whitespace factor: `lo` overflows (factor 0 keeps
          // every name — the `labels` stack, which already overflowed to reach
          // this rung), `hi` fits. Keep the fitting probe's OWN map as the
          // committed layout, so the stack the ladder measured IS the stack it
          // renders — the probe/commit identity the solve depends on becomes the
          // same object, not a re-run that has to match. `hiLayout` stays
          // undefined only when nothing fit; then the `labels` stack — already
          // packed, and known to overflow since the ladder descended past it to
          // reach this rung — is returned so resolveFitLadder falls to `bodies`.
          let lo = 0
          let hi = FIT_MAX_ROOM_FACTOR
          let hiLayout: Map<number, FeatureDataResult> | undefined
          for (let i = 0; i < FIT_SOLVE_ITERS; i++) {
            const mid = (lo + hi) / 2
            const layout = layoutAtFactor(mid)
            if (maxBottom(layout) <= trackHeight) {
              hi = mid
              hiLayout = layout
            } else {
              lo = mid
            }
          }
          return hiLayout ?? this.fitLabelsOnlyLayout
        },
        /**
         * #getter
         * Nothing reserved: bodies packed edge-to-edge (the tightest stack),
         * labels hidden — the `bodies` stage's stack. With names already off this
         * is what the `labels` rung packed, so reuse that stack by reference
         * instead of re-packing it into a third memo.
         */
        get fitBodiesOnlyLayout(): Map<number, FeatureDataResult> {
          return self.showLabels
            ? self.fitLayoutAt(self.incrementalLayoutBodiesOnly, false, false)
            : this.fitLabelsOnlyLayout
        },
        /**
         * #getter
         * The unscaled feature-body height (px): configured `featureHeight` times
         * the display-mode multiplier (what the layout already applied). Basis for
         * the fit squeeze/grow scale floors.
         */
        get fitBodyPx() {
          return (
            getConf(self, 'featureHeight') *
            HEIGHT_MULTIPLIERS[self.displayMode]
          )
        },
        /**
         * #getter
         * Floor on the fit squeeze: the smallest vertical scale that still leaves a
         * feature body at least `MIN_FIT_BOX_PX` tall. When bodies would pack
         * tighter than this the squeeze stops here and the surplus scrolls instead
         * of vanishing.
         */
        get fitMinScale() {
          return Math.min(1, bodyScaleTo(this.fitBodyPx, MIN_FIT_BOX_PX))
        },
        /**
         * #getter
         * Ceiling on the fit grow: the largest vertical scale before a feature body
         * exceeds the configured (normal-mode) `featureHeight`. A sparse stack
         * grows to fill the track only until its bodies reach their normal height,
         * so fit never makes a feature taller than it would be outside fit mode. In
         * normal display mode fitBodyPx already is the normal height, pinning the
         * scale at 1 (no grow, surplus stays whitespace); a compact mode (fitBodyPx
         * below normal) may grow back up to — but not past — the normal height.
         *
         * This is exactly `1 / multiplier`: the grow target is the normal
         * `featureHeight` and the laid-out body is `featureHeight * multiplier`, so
         * `featureHeight` cancels and the ceiling is purely the display mode's
         * compact ratio (1 in normal mode → no grow).
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
         * Vertical offset (px) that centers a fit stack shorter than the track
         * within it, so "fit" uses the whole allotted area instead of leaving all
         * the slack as a bottom void with the features hugging the top. Non-zero
         * only in fit mode when the scaled content is shorter than the track — the
         * sparse case where grow is capped at the normal feature height
         * (`fitMaxScale`), so the surplus would otherwise strand as whitespace.
         * Reads the scaled candidate height off `fitStage` (not `settledMaxY`,
         * defined later) and the config-slot `fitTargetHeight` (not the reactive
         * `height`, which would cycle in grow mode), so it can't feed back on
         * itself. 0 whenever the content fills or overflows the track (exact fit,
         * grow, or a squeeze that still scrolls), leaving those top-anchored.
         */
        get fitContentOffsetY() {
          const { scale, contentHeight } = self.fitStage
          const slack = self.fitTargetHeight - contentHeight * scale
          return self.fitHeightToDisplay && slack > 0 ? slack / 2 : 0
        },
        /**
         * #getter
         * What every consumer (hit test, GPU upload, React render) reads: the
         * resolved fit layout, cloned and scaled only when grown or squeezed, and
         * shifted down by `fitContentOffsetY` to center a short stack in the track.
         * Returned by reference off the untransformed path (scale 1, no offset) so
         * the incremental-layout upload diff and Y-morph idle check stay intact.
         */
        get laidOutDataMap(): Map<number, FeatureDataResult> {
          const { layout, scale } = self.fitStage
          const offsetY = this.fitContentOffsetY
          return scale === 1 && offsetY === 0
            ? layout
            : scaleLaidOutData(layout, scale, offsetY)
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
      }))
      .views(self => ({
        /**
         * #getter
         */
        // What the canvas + DOM overlays actually draw. Identical to
        // `laidOutDataMap` except during a row re-pack, when feature Y eases
        // from the previous layout to the new one (see yMorph). Returns the
        // same object reference as `laidOutDataMap` when idle, so consumers
        // don't re-upload/re-render unless an animation is in flight.
        get renderDataMap(): Map<number, FeatureDataResult> {
          const from = self.morphFromTops
          // morphProgress === 1 is the settled frame between the clock's final
          // setMorphProgress(1) and endYMorph clearing morphFromTops: every
          // feature already sits at its destination, so return laidOutDataMap by
          // reference (same as idle) instead of rebuilding an identical map. The
          // stable reference also lets the MobX computed skip a redundant
          // re-render when endYMorph then clears the morph.
          if (from === undefined || self.morphProgress === 1) {
            return self.laidOutDataMap
          }
          return interpolateYData(
            from,
            self.laidOutDataMap,
            easeInOutCubic(self.morphProgress),
          )
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
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        // The settled laid-out content height, ignoring any in-flight Y morph.
        // Content height without re-walking the scaled map: fitStage carries the
        // kept rung's unscaled height, and scaleLaidOutData multiplies every
        // bottomPx by scale, so maxBottom(laidOutDataMap) is exactly
        // keptRungHeight * scale. This is what `grow` mode sizes the track to —
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
          // ends. Constant across the morph, so no per-frame reflow. Only the
          // scroll-extent side reads this — grow-mode sizing reads settledMaxY so
          // the track height doesn't bounce mid-morph.
          return self.morphFromTops === undefined
            ? this.settledMaxY
            : Math.max(this.settledMaxY, self.morphFromMaxY)
        },

        /**
         * #getter
         */
        get hasOverflow() {
          return this.maxY > self.height
        },

        /**
         * #getter
         */
        // Coordinate-space height of the virtual-scroll content: the laid-out
        // content (maxY) but never less than the viewport, so overlays and the
        // scrollbar share one definition (was `hasOverflow ? maxY : height`).
        get contentHeight() {
          return Math.max(this.maxY, self.height)
        },

        /**
         * #getter
         */
        // How far the content can scroll: 0 when it fits. Single source for the
        // wheel handler and any scroll clamp.
        get scrollableHeight() {
          return Math.max(0, this.maxY - self.height)
        },

        /**
         * #getter
         */
        // Height that fits the laid-out content: the settled content height
        // (settledMaxY, NOT the morph-inflated maxY — grow must target the
        // destination height so it doesn't bounce during a zoom morph) clamped to
        // MIN_FIT_HEIGHT (so a sparse track doesn't collapse) and the maxHeight
        // cap. Feeds `grownHeight`, the grow-mode target (a tighter cap).
        get naturalContentHeight() {
          return clamp(this.settledMaxY, MIN_FIT_HEIGHT, self.maxHeight)
        },

        /**
         * #getter
         */
        // Target track height for the persistent `grow` mode: `naturalContentHeight`
        // capped at GROW_MAX_HEIGHT so a dense track doesn't grow to thousands of px
        // (content past the cap scrolls). Shared cap + `grownHeight` getter name
        // with the alignments display. Height-independent (naturalContentHeight reads
        // the config-slot `fitTargetHeight`, not the reactive `height` getter), so the
        // `height` getter below can return it in grow mode without cycling.
        get grownHeight() {
          return Math.min(this.naturalContentHeight, GROW_MAX_HEIGHT)
        },

        /**
         * #getter
         */
        // In grow mode the track height follows the laid-out content
        // (`grownHeight`) reactively — no autorun writes the height config slot,
        // so a settled zoom never churns the persisted session nor bakes a
        // momentary height. Fixed/fit read the slot directly (fit scales content
        // to fill it). Guarded on `view.initialized`: `grownHeight` transitively
        // reads view-geometry getters that throw before the view is measured, and
        // unlike the former autorun (whose MobX error-boundary swallowed the
        // pre-init throw) a getter would propagate it into render/hydration — so
        // pre-init we fall back to the slot. Overrides TrackHeightMixin.height.
        get height(): number {
          return self.autoHeight && getView(self).initialized
            ? this.grownHeight
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

        /**
         * #getter
         */
        get hoveredFeature() {
          const id = self.featureIdUnderMouse
          return id ? (this.featureIdIndex.get(id) ?? null) : null
        },

        /**
         * #getter
         */
        get hoveredSubfeature() {
          const id = self.subfeatureIdUnderMouse
          return id ? (this.subfeatureIdIndex.get(id) ?? null) : null
        },

        /**
         * #method
         */
        getFeatureById(featureId: string) {
          return this.featureIdIndex.get(featureId)
        },

        /**
         * #method
         */
        searchFeatureByID(id: string) {
          const item = this.getFeatureById(id)
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
          loadedBpPerPx: number,
          region: Region,
        ) {
          self.rpcDataMap.set(displayedRegionIndex, {
            ...data,
            loadedBpPerPx,
            regionKey: `${region.assemblyName}:${region.refName}`,
            refName: region.refName,
            reversed: !!region.reversed,
          })
        },

        /**
         * #action
         */
        clearDisplaySpecificData() {
          // Density stats survive viewport-change clearAllRpcData calls so
          // the derived `regionTooLarge` banner stays stable across small
          // zoom or pan moves. pruneRpcDataMapToVisible drops off-screen
          // entries during fetchNeeded. rpcDataMap is similarly preserved;
          // when regionTooLarge is true, laidOutDataMap returns empty so no
          // stale features render through the banner.
          //
          // NOTE: scrollTop is intentionally NOT reset here. clearAllRpcData
          // fires on same-region refetches (zoom/settings), and zeroing scroll
          // there yanks the viewport to the top on every zoom. The scroll-to-top
          // reset lives in the displayedRegions-change handler (chromosome nav)
          // instead; a re-pack that shrinks content is clamped by the layout
          // autorun's maxScroll clamp).
        },

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
              self.loadedRegions.delete(key)
            }
          }
        },

        /**
         * #action
         */
        startRenderingBackend(backend: CanvasFeatureRenderingBackend) {
          // Upload only regions whose laid-out data reference changed, so a
          // new chromosome streaming in doesn't re-upload the ones already on
          // the GPU. `laidOutDataMap` keeps stable references for unchanged
          // ref-groups (see createIncrementalLayout), making the diff
          // meaningful; createRegionUploadSync owns the pruning + the
          // context-loss reset.
          const syncRegions = createRegionUploadSync<
            FeatureDataResult,
            CanvasFeatureRenderingBackend
          >()
          self.attachRenderingBackend<CanvasFeatureRenderingBackend>(backend, {
            upload: b => {
              // renderDataMap === laidOutDataMap when idle; during a Y morph it
              // yields fresh per-frame region objects, so syncRegions re-uploads
              // the interpolated rows each frame (and once more on settle).
              syncRegions(b, self.renderDataMap)
            },
            render: b => {
              if (self.renderDataMap.size === 0) {
                return false
              }
              b.renderBlocks(
                self.renderBlocks,
                self.renderDataMap,
                self.renderState,
              )
              return true
            },
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
          tooltip: string | undefined,
        ) {
          if (!self.contextMenuInfo) {
            self.featureIdUnderMouse = featureId
            self.subfeatureIdUnderMouse = subfeatureId
            self.mouseoverExtraInformation = tooltip
          }
        },

        /**
         * #action
         */
        clearHover() {
          self.featureIdUnderMouse = null
          self.subfeatureIdUnderMouse = null
          self.mouseoverExtraInformation = undefined
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
        togglePinnedFeature(featureId: string) {
          toggleArrayMember(self.pinnedFeatureIds, featureId)
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
        // can mark several features at once; skip the add if this feature already
        // resolves to a stored highlight (idempotent re-highlight).
        //
        // That dedupe holds only within the target's own scope. An unscoped
        // (search) highlight fuzzily matches a transcript whose span equals its
        // gene's while boxing the gene, not the transcript — counting that as a
        // duplicate would make the menu's "Highlight this transcript" a dead
        // click, since the entry is offered precisely because the transcript
        // ISN'T boxed.
        addFeatureHighlightForItem(target: HighlightTarget, refName: string) {
          const already = self.featureHighlights.some(
            h =>
              !!h.subfeature === !!target.subfeature &&
              targetMatchesHighlight(target, refName, h),
          )
          if (!already) {
            self.featureHighlights.push({
              refName,
              start: target.startBp,
              end: target.endBp,
              name: target.name,
              subfeature: target.subfeature,
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

        /**
         * #action
         */
        // Reset every feature-level filter: the show-only collection, the hidden
        // set, and the runtime "Filter by..." jexl override. Backs the track
        // menu's "Clear filters" item.
        clearAllFeatureFilters() {
          self.clearSolo()
          self.showAllHidden()
          // Drop the runtime "Filter by..." override so the config jexlFilters
          // default applies again (setJexlFilters is defined in a later block).
          self.jexlFiltersSetting = undefined
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
            self.configuration.setSlot('showLabels', value)
          },

          /**
           * #action
           */
          setShowDescriptions(value: boolean) {
            self.configuration.setSlot('showDescriptions', value)
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
            self.configuration.setSlot(
              'outlineColor',
              value ? THEME_DERIVED_COLOR : '',
            )
          },

          /**
           * #action
           */
          // undefined resets to the slot's config default (which may be a
          // per-feature jexl color); a string sets a solid color for all
          // features. Flows to the worker via rpcProps -> displayConfig.color.
          setFeatureColor(color?: string) {
            self.configuration.setSlot('color', color)
          },

          /**
           * #action
           */
          setUtrColor(color?: string) {
            self.configuration.setSlot('utrColor', color)
          },

          /**
           * #action
           */
          openContextMenu(
            featureInfo: FlatbushItem,
            displayedRegionIndex: number,
            clientX: number,
            clientY: number,
            subfeature?: SubfeatureInfo,
          ) {
            self.contextMenuInfo = {
              item: featureInfo,
              subfeature,
              displayedRegionIndex,
              clientX,
              clientY,
            }
            // Pin the hover to the menu's target so its highlight box always
            // matches what the menu acts on — for every entry point (canvas or
            // label right-click), and even when no mousemove preceded this
            // open. When the click landed on a transcript, keep the box on that
            // transcript: the menu names it, so the box must agree. Drop the
            // tooltip so it doesn't overlap the menu. closeContextMenu clears
            // all of this again.
            self.featureIdUnderMouse = featureInfo.featureId
            self.subfeatureIdUnderMouse = subfeature?.featureId ?? null
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
          self.configuration.setSlot('displayMode', value)
        },

        /**
         * #action
         */
        // Set the track-height strategy by writing the unified `heightMode` slot;
        // mutual exclusion is inherent to the single enum. The `laidOutDataMap`
        // getter does the actual fit reactively.
        setHeightMode(mode: HeightMode) {
          self.configuration.setSlot('heightMode', mode)
          // Entering a non-fixed mode (grow/fit) resets a leftover scrollTop that
          // a reconfigured height contradicts: it can strand the sticky GPU canvas
          // at an out-of-range offset (fit usually has no scroll extent — except
          // an extreme stack floored at fitMinScale; grow can remove overflow,
          // leaving the old offset painting clipped/blank until a DOM scroll event
          // syncs it). Mirrors the alignments setHeightMode.
          if (mode !== 'fixed') {
            self.setScrollTop(0)
          }
        },

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
            AddFiltersDialog,
            { model: self, handleClose },
          ])
        },

        /**
         * #action
         */
        async fetchFullFeature(
          featureId: string,
          displayedRegionIndex: number,
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
          )
        },

        /**
         * #action
         */
        // The only bpPerPx-dependent worker decision is the amino-acid overlay
        // (gated by shouldRenderPeptideBackground). Refetch when crossing that
        // discrete threshold; otherwise the cached data stays valid.
        //
        // Missing rpcData (regionData === undefined) means the region was
        // pruned off-screen or not yet fetched — always refetch. The
        // FetchVisibleRegions autorun gates on regionTooLarge before calling
        // this, so the density-blocking case is handled there, not here.
        isCacheValid(displayedRegionIndex: number) {
          const view = getView(self)
          const regionData = self.rpcDataMap.get(displayedRegionIndex)
          if (regionData === undefined) {
            return false
          }
          return (
            shouldRenderPeptideBackground(view.bpPerPx) ===
            shouldRenderPeptideBackground(regionData.loadedBpPerPx)
          )
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        // Re-fetch the full feature by id and open it in the details widget (the
        // painting ships only slim render arrays). With a subfeatureInfo we fetch
        // its parent and descend to the clicked subfeature; otherwise the feature
        // itself. Serves both the click path and the context menu's "Open feature
        // details" (which passes no subfeature).
        selectFeatureById(
          featureId: string,
          subfeatureInfo: SubfeatureInfo | undefined,
          displayedRegionIndex: number,
        ) {
          void (async () => {
            const parentFeature = await self.fetchFullFeature(
              subfeatureInfo ? subfeatureInfo.parentFeatureId : featureId,
              displayedRegionIndex,
            )
            if (parentFeature && isAlive(self)) {
              const target = subfeatureInfo
                ? (findSubfeatureById(
                    parentFeature,
                    subfeatureInfo.featureId,
                  ) ?? parentFeature)
                : parentFeature
              self.selectFeature(target)
            }
          })()
        },
      }))
      .actions(self => {
        // One fetched region: the raw RPC response paired with the context
        // needed to commit it. `result` is too-large (density or byte
        // short-circuit) or the full feature payload — both optionally carry an
        // index `bytes` estimate.
        interface RegionFetch {
          displayedRegionIndex: number
          region: Region
          bpPerPx: number
          result: RenderFeatureDataResult
        }

        async function fetchFeaturesForRegion(
          region: Region,
          displayedRegionIndex: number,
          bpPerPx: number,
          byteSizeLimit: number | undefined,
          stopToken: StopToken,
        ): Promise<RegionFetch> {
          const sessionId = getRpcSessionId(self)
          const session = getSession(self)
          // Per-region translation table from the assembly's geneticCodes
          // config (alias-bridged via getGeneticCodeId), so the worker can
          // translate peptides on contigs whose features carry no transl_table.
          const assembly = session.assemblyManager.get(region.assemblyName)
          const result = await session.rpcManager.call(
            sessionId,
            'RenderFeatureData',
            {
              adapterConfig: self.adapterConfig,
              sequenceAdapter: self.sequenceAdapter,
              geneticCodeId: assembly?.getGeneticCodeId(region.refName),
              ...self.rpcProps(),
              region,
              bpPerPx,
              byteSizeLimit,
              stopToken,
              // keyed by region so concurrent per-region fetches aggregate
              // into one bar (FetchMixin.setRegionStatus) instead of each
              // overwriting the shared statusMessage/statusProgress
              statusCallback:
                self.makeRegionStatusCallback(displayedRegionIndex),
            },
          )
          return { displayedRegionIndex, region, bpPerPx, result }
        }

        function applyFetchResults(fetches: RegionFetch[]) {
          for (const { displayedRegionIndex, region, bpPerPx, result } of fetches) {
            if (!('regionTooLarge' in result)) {
              self.setRpcData(displayedRegionIndex, result, bpPerPx, region)
            }
          }
          // Commit the per-region byte/density estimates to the shared gate (byte
          // **max**, not sum, so a multi-region view where each region fits isn't
          // blanked by the cross-region total). Same helper the multi-row display
          // uses, so the two canvas gates can't drift.
          self.commitFeatureGateStats(
            fetches.map(({ displayedRegionIndex, region, result }) => ({
              displayedRegionIndex,
              regionWidthBp: region.end - region.start,
              bytes: result.bytes,
              featureCount: result.featureCount,
            })),
          )
        }

        return {
          /**
           * #action
           */
          async reload() {
            const view = getView(self)
            if (!view.initialized) {
              return
            }
            self.clearAllRpcData()
            self.fetchNeeded(view.bufferedVisibleRegions)
          },

          /**
           * #action
           */
          fetchNeeded(
            needed: { region: Region; displayedRegionIndex: number }[],
          ) {
            const view = getView(self)
            const bpPerPx = view.bpPerPx
            const byteSizeLimit = self.byteSizeLimit()
            // Drop cached entries (rpcDataMap + density stats) for regions no
            // longer visible. Keeps on-screen data so labels stay up during
            // the refetch window without letting either map grow unboundedly
            // as the user pans.
            self.pruneRpcDataMapToVisible(
              new Set(
                view.bufferedVisibleRegions.map(b => b.displayedRegionIndex),
              ),
            )
            void self.fetchRegions(needed, async (ctx: FetchContext) => {
              const promises = needed.map(({ region, displayedRegionIndex }) =>
                fetchFeaturesForRegion(
                  region,
                  displayedRegionIndex,
                  bpPerPx,
                  byteSizeLimit,
                  ctx.stopToken,
                ),
              )
              const results = await Promise.all(promises)
              if (ctx.isStale()) {
                return
              }
              applyFetchResults(results)
            })
          },
        }
      })
      .actions(self => {
        const superResizeHeight = self.resizeHeight
        return {
          /**
           * #action
           * A manual drag-resize means the user wants a fixed height; leave grow
           * mode first, otherwise the reactive `height` getter re-derives
           * grownHeight on the next layout change and the drag appears to do
           * nothing. Read the displayed (grown) height before flipping and write
           * `grown + distance` directly — the grow-exit bake skips when the slot
           * is written during the exit, so this delta isn't clobbered (a plain
           * `superResizeHeight` would read the stale slot post-flip and lose it).
           */
          resizeHeight(distance: number) {
            if (self.autoHeight) {
              const grown = self.height
              self.setHeightMode('fixed')
              return self.setHeight(grown + distance) - grown
            }
            return superResizeHeight(distance)
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

            // Keep scrollTop within the content whenever the scroll extent
            // shrinks. The morph autorun already clamps on a layout change, but
            // a manual drag-resize that grows the display (raising the viewport
            // past the old scroll bottom) has no layout change to trigger it,
            // and the sticky canvas has no native overflow container to
            // self-correct. Enforcing the bound reactively here means no
            // geometry-changing action has to remember to re-clamp.
            addDisposer(
              self,
              autorun(
                () => {
                  const view = getView(self)
                  if (!view.initialized) {
                    return
                  }
                  if (self.scrollTop > self.scrollableHeight) {
                    self.setScrollTop(self.scrollableHeight)
                  }
                },
                { name: 'CanvasClampScroll' },
              ),
            )

            // Drop density-derived state when displayedRegions change
            // (chromosome navigation). Both maps are keyed by
            // displayedRegionIndex which gets reused across chromosomes —
            // stale entries would otherwise gate the derived regionTooLarge
            // banner against the wrong region's stats and block refetch.
            // densityStatsPerRegion + featureDensityStats intentionally
            // survive viewport-change clearAllRpcData calls so the banner
            // doesn't flicker; this hook is the one path that does clear
            // them, scoped to actual region-list mutation.
            onDisplayedRegionsChange(
              self,
              () => {
                self.clearFeatureGateStats()
                // Reset scroll to the top only on an actual region-list change
                // (chromosome navigation) — not on same-region zoom/pan, which
                // must keep the user's scroll position (see
                // clearDisplaySpecificData).
                self.setScrollTop(0)
              },
              'CanvasClearDensityOnDisplayedRegions',
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
            autorunOnReadyView(
              self,
              () => {
                void self.flatbushIndexes
              },
              { name: 'CanvasHitIndexes' },
            )

            // Clear hover when the viewport moves under a stationary cursor
            // (pan, zoom, internal vertical scroll). The canvas is sticky, so
            // the cursor can stay over it while content shifts underneath — no
            // mousemove/mouseleave fires, and without this the previously
            // hovered feature's tooltip stays pinned at the cursor.
            addDisposer(
              self,
              autorun(
                () => {
                  const view = getView(self)
                  void self.scrollTop
                  void view.bpPerPx
                  void view.offsetPx
                  self.clearHover()
                },
                { name: 'CanvasClearHoverOnViewportChange' },
              ),
            )

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
            let prevLayout: Map<number, FeatureDataResult> | undefined
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
                const geometry = rowGeometrySignature({
                  displayMode: self.displayMode,
                  renderedShowLabels: self.renderedShowLabels,
                  renderedShowDescriptions: self.renderedShowDescriptions,
                  fitScale: self.fitScale,
                  offsetY: self.fitContentOffsetY,
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
                    // a feature easing up from a deep row isn't clipped.
                    const active = self.morphFromTops
                    return {
                      scrollTop: self.scrollTop,
                      height: self.height,
                      fromTops:
                        active === undefined
                          ? captureFeatureTops(from)
                          : captureDisplayedTops(
                              from,
                              active,
                              easeInOutCubic(self.morphProgress),
                            ),
                      fromMaxY:
                        active === undefined
                          ? maxBottom(from)
                          : Math.max(maxBottom(from), self.morphFromMaxY),
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
      .views(self => ({
        /**
         * #method
         */
        // The checkbox rows of the "Show..." submenu. Subclasses override to
        // append their own toggles; the flat list of all checkboxes is rendered
        // before the radio groups so the menu reads top-to-bottom as
        // checkboxes-then-radios rather than an interleaved mix.
        showSubmenuCheckboxItems(): MenuItem[] {
          return [
            {
              label: 'Show descriptions',
              type: 'checkbox' as const,
              checked: self.showDescriptions,
              keepMenuOpen: true,
              onClick: () => {
                self.setShowDescriptions(!self.showDescriptions)
              },
            },
            {
              label: 'Show outline',
              type: 'checkbox' as const,
              checked: self.showOutline,
              keepMenuOpen: true,
              onClick: () => {
                self.setShowOutline(!self.showOutline)
              },
            },
          ]
        },
        // The radio groups of the "Show..." submenu, each a subHeader + inline
        // radios. Rendered after the checkboxes; subclasses override to append.
        showSubmenuRadioGroups(): MenuItem[] {
          return inlineRadioGroup(
            'Feature labels',
            self.showLabelsMode,
            [
              { value: 'auto', label: 'Auto (hide when dense)' },
              { value: 'on', label: 'Always on' },
              { value: 'off', label: 'Always off' },
            ],
            mode => {
              self.setShowLabels(mode)
            },
          )
        },
      }))
      .views(self => ({
        /**
         * #method
         */
        // Flattened "Show..." submenu: all checkbox toggles first, then the
        // radio groups (each under its own subHeader). Composed from the two
        // extension points above so subclasses inject toggles/groups in place
        // without rebuilding trackMenuItems from scratch.
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
         */
        contextMenuItems() {
          const info = self.contextMenuInfo
          if (!info) {
            return []
          }
          const {
            item: { featureId, startBp, endBp, name, type },
            subfeature,
            displayedRegionIndex,
          } = info
          const pinned = self.pinnedFeatureIdSet.has(featureId)
          const highlighted = self.highlightedFeatureIdSet.has(featureId)
          const inSoloSet = self.soloFeatureIdSet.has(featureId)
          const soloCount = self.soloFeatureIds.length
          const subfeatureHighlighted =
            !!subfeature &&
            self.highlightedFeatureIdSet.has(subfeature.featureId)
          // Name each scope by its own type rather than hardcoding
          // "transcript"/"gene": subfeatureInfos carries more than transcripts
          // (a transposon's LTR parts, mature-protein regions), so fixed
          // wording would mislabel those.
          const subfeatureNoun = subfeature?.type ?? 'subfeature'
          const featureNoun = type ?? 'feature'
          // One toggle shared by both highlight scopes: when already boxed,
          // remove by the boxed id; otherwise add a highlight for the target.
          function highlightItem(
            active: boolean,
            addLabel: string,
            removeLabel: string,
            boxedId: string,
            target: HighlightTarget,
          ) {
            return {
              label: active ? removeLabel : addLabel,
              icon: Highlighter,
              onClick: () => {
                if (active) {
                  self.removeFeatureHighlightsForId(boxedId)
                } else {
                  const region = self.loadedRegions.get(displayedRegionIndex)
                  if (region) {
                    self.addFeatureHighlightForItem(target, region.refName)
                  }
                }
              },
            }
          }
          const wholeFeatureItem = highlightItem(
            highlighted,
            subfeature ? `Whole ${featureNoun}` : 'Highlight feature',
            subfeature
              ? `Remove whole ${featureNoun} highlight`
              : 'Remove highlight',
            featureId,
            { startBp, endBp, name },
          )
          return [
            {
              label: 'Open feature details',
              icon: MenuOpenIcon,
              onClick: () => {
                self.selectFeatureById(
                  featureId,
                  undefined,
                  displayedRegionIndex,
                )
              },
            },
            {
              label: 'Zoom to feature',
              icon: CenterFocusStrongIcon,
              onClick: () => {
                const region = self.loadedRegions.get(displayedRegionIndex)
                if (region) {
                  const view = getView(self)
                  // grow 0.2 adds ~20% flanks so the feature isn't pinned to
                  // the viewport edges (matches synteny/bookmark zoom-to).
                  view.navTo(
                    {
                      refName: region.refName,
                      start: startBp,
                      end: endBp,
                    },
                    0.2,
                  )
                }
              },
            },
            // Two highlight scopes. When the click resolved to a subfeature (an
            // isoform, an LTR part) both the whole feature and that subfeature
            // can be boxed, so the scopes are grouped under a "Highlight"
            // submenu. With no subfeature there is a single scope, kept as a
            // top-level entry so the common case stays one click away.
            ...(subfeature
              ? [
                  {
                    label: 'Highlight',
                    icon: Highlighter,
                    subMenu: [
                      // The subfeature scope is keyed to subfeatures so it
                      // resolves to this isoform rather than its gene even when
                      // the two share a span (the common GFF3 case).
                      highlightItem(
                        subfeatureHighlighted,
                        subfeature.displayLabel
                          ? `${subfeatureNoun} ${subfeature.displayLabel}`
                          : `This ${subfeatureNoun}`,
                        `Remove ${subfeatureNoun} highlight`,
                        subfeature.featureId,
                        {
                          startBp: subfeature.startBp,
                          endBp: subfeature.endBp,
                          name: subfeature.displayLabel,
                          subfeature: true,
                        },
                      ),
                      wholeFeatureItem,
                    ],
                  },
                ]
              : [wholeFeatureItem]),
            // The show/hide family (pin, solo, hide) groups the growing set of
            // visibility toggles behind one submenu so the common actions above
            // stay one click away.
            {
              label: 'Show/hide',
              icon: VisibilityIcon,
              subMenu: [
                {
                  label: pinned ? 'Unpin from top' : 'Pin to top of layout',
                  icon: VerticalAlignTopIcon,
                  onClick: () => {
                    self.togglePinnedFeature(featureId)
                  },
                },
                // Solo menu. Applying a collected set is done from the "N
                // selected" badge (see SoloSelectionChip), so the menu only
                // ever offers the one-shot single isolate, add/remove-from-set,
                // and show-all.
                //  - applied → show everything again (and optionally drop this)
                //  - otherwise → the one-shot isolate + add/remove this feature
                ...(self.soloApplied
                  ? [
                      {
                        label: 'Show all features',
                        icon: FilterAltOffIcon,
                        onClick: () => {
                          self.clearSolo()
                        },
                      },
                      ...(inSoloSet && soloCount > 1
                        ? [
                            {
                              label: 'Remove this feature from view',
                              icon: PlaylistRemoveIcon,
                              onClick: () => {
                                self.toggleSoloFeature(featureId)
                              },
                            },
                          ]
                        : []),
                    ]
                  : [
                      {
                        label: 'Show only this feature',
                        icon: FilterAltIcon,
                        onClick: () => {
                          self.soloFeature(featureId)
                        },
                      },
                      {
                        label: inSoloSet ? 'Remove from set' : 'Add to set',
                        icon: inSoloSet ? PlaylistRemoveIcon : PlaylistAddIcon,
                        onClick: () => {
                          self.toggleSoloFeature(featureId)
                        },
                      },
                    ]),
                {
                  label: 'Hide this feature',
                  icon: VisibilityOffIcon,
                  onClick: () => {
                    self.hideFeature(featureId)
                  },
                },
                // Reachable from any still-visible feature; the track menu's
                // "Clear filters" covers the case where everything got hidden.
                ...showHiddenFeaturesMenuItems(self),
              ],
            },
            {
              label: 'Copy info to clipboard',
              icon: ContentCopyIcon,
              onClick: () => {
                void (async () => {
                  const session = getSession(self)
                  const fullFeature = await self.fetchFullFeature(
                    featureId,
                    displayedRegionIndex,
                  )
                  if (!fullFeature) {
                    return
                  }
                  try {
                    const { uniqueId: _, ...rest } = fullFeature.toJSON()
                    const { default: copy } =
                      await import('@jbrowse/core/util/copyToClipboard')
                    copy(JSON.stringify(rest, null, 4))
                    session.notify('Copied to clipboard', 'success')
                  } catch (e) {
                    console.error(e)
                    session.notifyError(`${e}`, e)
                  }
                })()
              },
            },
          ]
        },

        /**
         * #method
         * The "Color by..." radio choices (solid/strand/attribute). Split out so
         * subclasses can reuse them while assembling their own color menu.
         */
        colorBySubMenuItems() {
          return [
            {
              label: 'Solid color...',
              type: 'radio' as const,
              checked: self.colorByMode === 'solid',
              onClick: () => {
                self.openSetColorDialog()
              },
            },
            {
              label: 'Strand',
              type: 'radio' as const,
              checked: self.colorByMode === 'strand',
              onClick: () => {
                self.setFeatureColor(STRAND_COLOR_JEXL)
              },
            },
            {
              label: 'Attribute...',
              type: 'radio' as const,
              checked: self.colorByMode === 'attribute',
              onClick: () => {
                self.openColorByAttributeDialog()
              },
            },
          ]
        },
      }))
      .views(self => ({
        /**
         * #method
         * Color-related track menu entries: a single "Color by..." entry whose
         * "Solid color..." choice opens the solid+UTR color picker. Subclasses
         * (e.g. variants) override to drop the gene-oriented UTR picker.
         */
        colorMenuItems() {
          return [
            {
              label: 'Color by...',
              icon: PaletteIcon,
              subMenu: self.colorBySubMenuItems(),
            },
          ]
        },

        /**
         * #method
         * One "Feature height" menu with two independent radio groups, mirroring
         * the alignments display: the size presets (how tall each feature is
         * drawn) and, under a "Track sizing" subheader, how the track responds
         * when there are more features than fit — scroll / expand / squeeze. The
         * two axes are orthogonal, so picking a size never changes the mode and
         * vice versa. Shared by every canvas display (genes, variants).
         */
        featureHeightMenuItems() {
          return [
            {
              label: 'Feature height',
              icon: HeightIcon,
              subMenu: [
                // Each preset row carries its own pin (endAdornment): the radio
                // selects the mode for this track, the pin promotes that preset
                // as the session-wide default for this display type. displayMode
                // is a sentinel promotable slot, so every preset — `normal`
                // included — is customizable back over another session default.
                ...displayModeOptions.map(option =>
                  promotableRadioItem({
                    label: option.label,
                    checked: self.displayMode === option.value,
                    keepMenuOpen: true,
                    onClick: () => {
                      self.setDisplayMode(option.value)
                    },
                    displayTypeDefault: makeDisplayTypeDefaultControl(
                      self,
                      'displayMode',
                      option.value,
                    ),
                  }),
                ),
                { type: 'subHeader' as const, label: 'Track sizing' },
                ...heightModeMenuItems(self, 'feature'),
              ],
            },
          ]
        },
      }))
      .views(self => ({
        /**
         * #method
         */
        trackMenuItems(): MenuItem[] {
          const hiddenCount = self.hiddenFeatureIds.length
          const hasFeatureFilters =
            self.jexlFiltersSetting !== undefined ||
            self.soloFeatureIds.length > 0 ||
            hiddenCount > 0
          return [
            {
              label: 'Show...',
              icon: VisibilityIcon,
              subMenu: self.showSubmenuMenuItems(),
            },
            ...self.featureHeightMenuItems(),
            ...self.colorMenuItems(),
            {
              label: 'Edit filters',
              icon: FilterAltIcon,
              subMenu: [
                {
                  label: 'Filter by...',
                  icon: ClearAllIcon,
                  onClick: () => {
                    self.openFilterDialog()
                  },
                },
                // Track-level unhide: the per-feature "Show N hidden" item is
                // only reachable from a still-visible feature's menu, so this is
                // the sole recovery once every feature in view is hidden.
                ...showHiddenFeaturesMenuItems(self),
                ...(hasFeatureFilters
                  ? [
                      {
                        label: 'Clear filters',
                        icon: FilterAltOffIcon,
                        onClick: () => {
                          self.clearAllFeatureFilters()
                        },
                      },
                    ]
                  : []),
              ],
            },
          ]
        },
      }))
  )
}
