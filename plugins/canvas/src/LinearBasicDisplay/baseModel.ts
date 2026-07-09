import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  getConfResolved,
  makeSessionDefaultControl,
  readConfObject,
  resolvePromotableConfigSnapshot,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { promotableRadioItem } from '@jbrowse/core/ui'
import { Highlighter } from '@jbrowse/core/ui/Icons'
import {
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
  AUTO_FORCE_LOAD_BP,
  GROW_MAX_HEIGHT,
  MultiRegionDisplayMixin,
  PromotableDefaultsMixin,
  TrackHeightMixin,
  autorunOnReadyView,
  evaluateRegionTooLarge,
  onDisplayedRegionsChange,
  resolveByteLimit,
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
  radioSubMenu,
  screenDensity,
  toggleArrayMember,
} from './baseModelHelpers.ts'
import {
  buildFeatureFlatbushIndex,
  buildSubfeatureFlatbushIndex,
} from './components/hitTesting.ts'
import { featureMatchesHighlight } from './featureHighlight.ts'
import { createIncrementalLayout, scaleLaidOutData } from './layout.ts'
import {
  canMorph,
  captureDisplayedTops,
  captureFeatureTops,
  easeInOutCubic,
  interpolateYData,
  maxBottom,
} from './yMorph.ts'
import {
  HEIGHT_MULTIPLIERS,
  labelFontSize,
} from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { THEME_DERIVED_COLOR } from '../RenderFeatureDataRPC/renderConfig.ts'
import { shouldRenderPeptideBackground } from '../RenderFeatureDataRPC/zoomThresholds.ts'

import type { RegionDensityStats } from './baseModelHelpers.ts'
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
import type { FeatureHighlight } from './featureHighlight.ts'
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
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  HeightMode,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

// HeightMode (fixed/grow/fit) is the shared track-height vocabulary — see
// @jbrowse/plugin-linear-genome-view's heightMode module. Derived here from the
// `autoHeight`/`fitHeightToDisplay` booleans so the "Track height" radio group
// presents one exclusive choice.

// Single source for the "Feature height" radio options and their labels, so a
// fourth mode can't drift between the menu and the label lookup.
export const displayModeOptions: { value: DisplayMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'compact', label: 'Compact' },
  { value: 'superCompact', label: 'Super-compact' },
]

// Single source for the "Track height" radio options, shared by the track menu
// and the bottom-right track-height dropdown so the labels can't drift.
export const heightModeOptions: { value: HeightMode; label: string }[] = [
  { value: 'fixed', label: 'Fixed height — scroll to see all features' },
  { value: 'grow', label: 'Auto height — grow to fit all features' },
  { value: 'fit', label: 'Compressed — squeeze all features into view' },
]

// Persistent, declarative feature-highlight request (see featureHighlight.ts).
// A plain span+name signature — never the adapter uniqueId — so it can be
// authored in a session snapshot / URL and resolved once the region renders.
// Mirror of the plain FeatureHighlight signature. Keep the two in sync by hand:
// the pure matcher + search bridge use the interface, this MST model persists it,
// and setFeatureHighlights(cast(...)) silently DROPS any field the model lacks.
const FeatureHighlightModel = types.model('FeatureHighlight', {
  refName: types.string,
  start: types.number,
  end: types.number,
  name: types.maybe(types.string),
})

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

// Swatch fallback when the active color is a jexl (per-feature) expression
// rather than a solid CSS color. Mirrors the baseConfigSchema.ts color default.
const FEATURE_COLOR_DEFAULT = 'goldenrod'

// Floor for the auto-fit height so a sparse/empty track doesn't collapse to a
// sliver. Capped by the maxHeight config in fitHeight.
const MIN_FIT_HEIGHT = 50

// Smallest feature-body height (px) the fit squeeze may leave. Once bodies would
// pack tighter than this the squeeze stops and the surplus scrolls, rather than
// shrinking boxes to invisibility. See `fitMinScale`.
const MIN_FIT_BOX_PX = 2

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
        MultiRegionDisplayMixin(),
        PromotableDefaultsMixin(),
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
        // Per-region density stats (featureCount over genomic span) populated
        // for both successful fetches and worker-side too-large responses.
        // Drives the derived `regionTooLarge` getter so banner state is a
        // pure function of cached data + current bpPerPx (no flicker on
        // small zoom changes).
        densityStatsPerRegion: observable.map<number, RegionDensityStats>(),
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
        // Region index of the hovered feature, captured from the hit test so a
        // click/right-click acts on it directly instead of re-resolving the
        // feature's region from featureItemMap. Set/cleared with the hover ids.
        hoveredRegionIndex: undefined as number | undefined,
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
              displayedRegionIndex: number
              clientX: number
              clientY: number
            }
          | undefined,
        /**
         * #volatile
         */
        userFeatureDensityLimit: undefined as number | undefined,
        /**
         * #volatile
         */
        // visibleBp at which the current `featureDensityStats` byte estimate was
        // measured. The estimate scales with span, so a value taken while zoomed
        // out doesn't describe a smaller zoomed-in span; tracking the capture
        // span lets `estimatedVisibleBytes` rescale it to the current view
        // instead of letting a stale estimate gate refetch forever.
        byteEstimateVisibleBp: undefined as number | undefined,
        /**
         * #volatile
         */
        heightBeforeExpand: undefined as number | undefined,
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
         * #method
         */
        // Highest features-per-pixel across the visible regions at the given
        // bpPerPx, from cached per-region counts. Shared by the density gate
        // (debounced coarseBpPerPx) and the force-load baseline (live bpPerPx).
        observedMaxDensity(bpPerPx: number) {
          return Math.max(
            0,
            ...getView(self).visibleRegions.map(r => {
              const ds = self.densityStatsPerRegion.get(r.displayedRegionIndex)
              return ds ? screenDensity(ds, bpPerPx) : 0
            }),
          )
        },

        /**
         * #getter
         */
        // Current features-per-pixel across the visible regions, recomputed
        // from cached per-region counts and the debounced coarseBpPerPx (500ms
        // after the gesture settles). Drives label visibility and the
        // regionTooLarge banner; both also feed the coarse-packed layout, so
        // using coarseBpPerPx keeps all three on one cadence and avoids
        // per-frame relayout/banner flicker when a smooth zoom hovers near a
        // threshold. Still far faster than the old fetch-time snapshot.
        get visibleFeatureDensityPerPx() {
          return this.observedMaxDensity(getView(self).coarseBpPerPx)
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
        // Grow mode as a boolean, derived from the unified heightMode slot.
        // Kept for the CanvasAutoHeight autorun and other consumers that read a
        // plain flag.
        get autoHeight() {
          return this.heightMode === 'grow'
        },

        /**
         * #getter
         */
        // Feature height preset (normal/compact/superCompact). Promotable
        // sentinel enum (see baseConfigSchema.ts): getConfResolved walks the
        // pinned-track -> session-default -> `normal` cascade and always returns
        // a concrete preset, never the `inherit` sentinel.
        get displayMode(): DisplayMode {
          return getConfResolved(self, 'displayMode')
        },

        /**
         * #getter
         */
        // The active track-height strategy. Promotable sentinel enum (see
        // baseConfigSchema.ts): getConfResolved walks the pinned-track ->
        // session-default -> `fixed` cascade and always returns a concrete mode,
        // never the `inherit` sentinel. The single source of truth that
        // autoHeight/fitHeightToDisplay derive from.
        get heightMode(): HeightMode {
          return getConfResolved(self, 'heightMode')
        },

        /**
         * #getter
         */
        // Fit-to-height mode as a boolean, derived from the unified heightMode
        // slot. Named to match the alignments display's getter. Read by fitScale
        // / canExpand.
        get fitHeightToDisplay() {
          return this.heightMode === 'fit'
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
          return raw !== undefined && !isJexl(raw) ? raw : FEATURE_COLOR_DEFAULT
        },

        /**
         * #getter
         */
        get utrColor() {
          return getConf(self, 'utrColor')
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
          if (this.colorByMode !== 'attribute') {
            return ''
          }
          const raw = self.conf.color ?? ''
          return /get\(feature,'([^']+)'\)/.exec(raw)?.[1] ?? ''
        },

        /**
         * #getter
         */
        get effectiveShowDescriptions() {
          // In auto mode the density gate hides both labels and descriptions
          // together. Manual 'off' only hides labels — descriptions remain
          // independently controllable.
          return (
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
        get maxFeatureDensity() {
          // Skip density gating when the user has already force-loaded via byte estimate
          if (self.userByteSizeLimit !== undefined) {
            return undefined
          }
          const view = getView(self)
          if (view.visibleBp < AUTO_FORCE_LOAD_BP) {
            return undefined
          }
          return (
            self.userFeatureDensityLimit ??
            getConf(self, 'maxFeatureScreenDensity')
          )
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
        // on the raw items, no row/topPx needed). A highlight boxes the top-level
        // feature when it matches, and only falls back to boxing a subfeature when
        // no top-level feature matched (e.g. a searched transcript whose span is a
        // subspan of its gene, so it never matches the gene's full span):
        //   `box` = the render-item ids the overlay draws a box around.
        //   `pin` = the ids the packer pins to a top row. For a subfeature that's
        //           its PARENT feature, since the packer keys on top-level ids and
        //           pinning the subfeature id would be a no-op that leaves the
        //           searched transcript buried/clipped in a dense track.
        get resolvedHighlights(): {
          box: ReadonlySet<string>
          pin: ReadonlySet<string>
        } {
          const box = new Set<string>()
          const pin = new Set<string>()
          for (const h of self.featureHighlights) {
            for (const data of self.rpcDataMap.values()) {
              let topLevelMatched = false
              for (const item of data.flatbushItems) {
                if (featureMatchesHighlight(item, data.refName, h)) {
                  box.add(item.featureId)
                  pin.add(item.featureId)
                  topLevelMatched = true
                }
              }
              // Only fall back to boxing subfeatures when the top-level feature
              // never matched (e.g. a searched transcript whose span is a
              // subspan of its gene). If the gene itself matched, boxing its
              // subfeatures too would draw redundant sub-boxes inside the glyph.
              if (!topLevelMatched) {
                for (const s of data.subfeatureInfos) {
                  if (
                    featureMatchesHighlight(
                      {
                        startBp: s.startBp,
                        endBp: s.endBp,
                        name: s.displayLabel,
                      },
                      data.refName,
                      h,
                    )
                  ) {
                    box.add(s.featureId)
                    pin.add(s.parentFeatureId)
                  }
                }
              }
            }
          }
          return { box, pin }
        },

        /**
         * #getter
         */
        // The render-item ids resolved from a search highlight (features and/or
        // subfeatures), for the overlay to box. See resolvedHighlights.
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
          // superCompact height scaling + collapse-mode label decimation there,
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
      // Derived regionTooLarge: a pure function of cached stats × current
      // bpPerPx + visible regions. No imperative clear-and-reset, so small
      // zoom/pan moves don't flicker the banner. Shadows RegionTooLargeMixin's
      // imperative getter.
      .views(self => ({
        /**
         * #getter
         * The cached byte estimate scaled from the span it was measured over
         * (`byteEstimateVisibleBp`) to the currently visible span. The estimate
         * is roughly proportional to span, so scaling makes it a pure function
         * of the current view — mirroring densityTooLarge. Crucially it
         * self-releases on zoom-in: without scaling, a large zoomed-out estimate
         * stays above the limit forever and gates refetch (FetchVisibleRegions
         * won't re-estimate while regionTooLarge holds) — a permanently stuck
         * banner.
         */
        get estimatedVisibleBytes() {
          const stats = self.featureDensityStats
          if (!stats?.bytes) {
            return undefined
          }
          const captureBp = self.byteEstimateVisibleBp
          return captureBp
            ? (stats.bytes * getView(self).visibleBp) / captureBp
            : stats.bytes
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get densityTooLarge() {
          const max = self.maxFeatureDensity
          return max === undefined
            ? false
            : self.visibleFeatureDensityPerPx > max
        },
      }))
      .views(self => ({
        // Shared verdict + reason: bytes-over-limit takes precedence over
        // density, gated by AUTO_FORCE_LOAD_BP. Same helper as the block-based
        // and pre-fetch byte paths so the banner text can't drift. Feeds the
        // scaled estimatedVisibleBytes so the byte gate self-releases on
        // zoom-in (see estimatedVisibleBytes).
        get tooLargeStatus() {
          return evaluateRegionTooLarge({
            visibleBp: getView(self).visibleBp,
            bytes: self.estimatedVisibleBytes,
            byteLimit: resolveByteLimit({
              userByteSizeLimit: self.userByteSizeLimit,
              adapterFetchSizeLimit: self.featureDensityStats?.fetchSizeLimit,
              configFetchSizeLimit: readConfObject(self.conf, 'fetchSizeLimit'),
            }),
            densityTooLarge: self.densityTooLarge,
          })
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get regionTooLarge() {
          return self.tooLargeStatus.tooLarge
        },

        /**
         * #getter
         */
        get regionTooLargeReason() {
          return self.tooLargeStatus.reason
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
          const view = getView(self)
          return self.regionTooLarge ||
            !view.initialized ||
            self.rpcDataMap.size === 0
            ? new Map<number, FeatureDataResult>()
            : memo(self.rpcDataMap, {
                ...self.layoutInputs,
                showLabels,
                showDescriptions,
              })
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
         * Names reserved, descriptions dropped — the `labels` stage's stack.
         */
        get fitLabelsOnlyLayout(): Map<number, FeatureDataResult> {
          return self.fitLayoutAt(
            self.incrementalLayoutLabelsOnly,
            self.showLabels,
            false,
          )
        },
        /**
         * #getter
         * Nothing reserved: bodies packed edge-to-edge (the tightest stack),
         * labels hidden — the `bodies` stage's stack.
         */
        get fitBodiesOnlyLayout(): Map<number, FeatureDataResult> {
          return self.fitLayoutAt(self.incrementalLayoutBodiesOnly, false, false)
        },
        /**
         * #getter
         * Floor on the fit squeeze: the smallest vertical scale that still leaves a
         * feature body at least `MIN_FIT_BOX_PX` tall. The unscaled body height is
         * the configured `featureHeight` times the display-mode multiplier (what
         * the layout already applied). When bodies would pack tighter than this the
         * squeeze stops here and the surplus scrolls instead of vanishing.
         */
        get fitMinScale() {
          const boxPx =
            getConf(self, 'featureHeight') * HEIGHT_MULTIPLIERS[self.displayMode]
          return boxPx > 0 ? Math.min(1, MIN_FIT_BOX_PX / boxPx) : 1
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The resolved fit outcome — which reservation `level` survived, its
         * unscaled `layout`, and the vertical `scale` to fill the track — bundled
         * so the three can never disagree. The ladder keeps the least reduction
         * whose *unscaled* stack fits the track height: `full` (names +
         * descriptions), else `labels` (drop descriptions), else `bodies` (drop
         * names too, pack tight). Only `bodies` can still overflow, and only it
         * scales; `full`/`labels` fit by construction. Non-fit modes stay at
         * `full`, scale 1. Read off the unscaled candidate heights so it can't feed
         * back on its own `scale`. The bodies squeeze is floored at `fitMinScale`
         * (keeping boxes visible); a stack too dense to fit even there overflows
         * and scrolls.
         */
        get fitStage(): {
          level: 'full' | 'labels' | 'bodies'
          layout: Map<number, FeatureDataResult>
          scale: number
        } {
          const h = self.height
          const base = self.baseLaidOutDataMap
          return !self.fitHeightToDisplay || maxBottom(base) <= h
            ? { level: 'full', layout: base, scale: 1 }
            : maxBottom(self.fitLabelsOnlyLayout) <= h
              ? { level: 'labels', layout: self.fitLabelsOnlyLayout, scale: 1 }
              : {
                  level: 'bodies',
                  layout: self.fitBodiesOnlyLayout,
                  scale: Math.max(
                    self.fitMinScale,
                    Math.min(1, h / maxBottom(self.fitBodiesOnlyLayout)),
                  ),
                }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Uniform vertical shrink for fit mode; 1 unless the bodies stack is being
         * squeezed to fill the track.
         */
        get fitScale() {
          return self.fitStage.scale
        },
        /**
         * #getter
         * What every consumer (hit test, GPU upload, React render) reads: the
         * resolved fit layout, cloned and scaled only while squeezing bodies.
         * Returned by reference off the un-squeezed path so the incremental-layout
         * upload diff and Y-morph idle check stay intact.
         */
        get laidOutDataMap(): Map<number, FeatureDataResult> {
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
          return self.effectiveShowDescriptions && self.fitStage.level === 'full'
        },
        /**
         * #getter
         * Names are painted at the `full`/`labels` stages (and whenever fit is
         * off), where the packer reserved their row height and overhang so they
         * never overlap. At the `bodies` stage nothing is reserved, so names are
         * hidden rather than drawn on top of the boxes. Every render-time consumer
         * reads this so hidden names reserve nothing.
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
          if (from === undefined) {
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
        get maxY() {
          const raw = maxBottom(self.laidOutDataMap)
          // Fit mode scales content to exactly fill the track, but the
          // base*scale round-trip rounds a hair above `height` in ~5% of float
          // cases — which would spuriously arm the expand button, mark the track
          // as overflowing, and open a sub-pixel scrollbar. Snap that away while
          // squeezing. A larger overflow means the min-box floor (fitMinScale)
          // stopped the squeeze short of fitting, so it's real and must scroll —
          // keep it.
          const max =
            self.fitScale < 1 && raw - self.height < 1
              ? Math.min(raw, self.height)
              : raw
          // During a Y morph hold the height at the taller of the old/new
          // layout so features animating up from a deeper row aren't clipped at
          // the bottom; it settles to the destination height when the morph
          // ends. Constant across the morph, so no per-frame reflow.
          return self.morphFromTops === undefined
            ? max
            : Math.max(max, self.morphFromMaxY)
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
        // Height that fits the laid-out content: the content height (maxY)
        // clamped to MIN_FIT_HEIGHT (so a sparse track doesn't collapse) and the
        // maxHeight cap. Feeds `grownHeight` (the grow-mode target, a tighter
        // cap) and `canExpand` (whether the overflow indicator has room to grow).
        get fitHeight() {
          return Math.min(Math.max(this.maxY, MIN_FIT_HEIGHT), self.maxHeight)
        },

        /**
         * #getter
         */
        // Target track height for the persistent `grow` mode: `fitHeight` capped
        // at GROW_MAX_HEIGHT so a dense track doesn't grow to thousands of px
        // (content past the cap scrolls). Shared cap + `grownHeight` getter name
        // with the alignments display. The overflow indicator enters grow mode,
        // so it targets this too — there is no separate one-shot expand height.
        get grownHeight() {
          return Math.min(this.fitHeight, GROW_MAX_HEIGHT)
        },

        /**
         * #getter
         */
        // Whether "Expand to fit" would actually grow the track. Overflow alone
        // isn't enough: when the display is already at/above the maxHeight cap
        // (e.g. dragged taller than maxHeight while content still overflows),
        // fitHeight <= height and "expanding" would *shrink* it. Gate the expand
        // affordance on this so the button only ever offers a real grow. Fit
        // mode fits content to the current height by design, so never offer
        // expand there (fitHeight still floors at MIN_FIT_HEIGHT, which would
        // otherwise leak the button for a sub-50px track).
        get canExpand() {
          return !self.fitHeightToDisplay && this.fitHeight > self.height
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
        // Highlighted uniqueIds that are actually on screen right now, for the
        // overlay to box. The set is resolved pre-layout (highlightedFeatureIdSet)
        // and intersected with the laid-out features here, so the highlight
        // "follows" its feature across pan/zoom without a second span match. Both
        // top-level features and subfeatures are boxable (a searched transcript
        // renders as a subfeature), so any resolved id present in featureItemMap
        // qualifies.
        get highlightedFeatureIds(): string[] {
          const ids: string[] = []
          for (const id of self.highlightedFeatureIdSet) {
            if (this.featureItemMap.has(id)) {
              ids.push(id)
            }
          }
          return ids
        },

        /**
         * #getter
         */
        // Flatbush spatial indexes per region for hit testing. Recomputes when
        // any input observable moves (laid-out data, label visibility, zoom,
        // reversed flag); MobX caches the value so repeated hover events read
        // the same indexes for free.
        get flatbushIndexes() {
          const view = getView(self)
          const labels = {
            showLabels: self.renderedShowLabels,
            showDescriptions: self.renderedShowDescriptions,
          }
          const reversedRegions = self.reversedRegions
          const bpPerPx = view.bpPerPx
          const result = new Map<number, FlatbushRegionIndexes>()
          for (const [idx, data] of self.laidOutDataMap) {
            result.set(idx, {
              feature: buildFeatureFlatbushIndex(
                data.flatbushItems,
                data.floatingLabelsData,
                bpPerPx,
                reversedRegions.has(idx),
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
        clearHeightBeforeExpand() {
          self.heightBeforeExpand = undefined
        },

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
        setDensityStats(
          displayedRegionIndex: number,
          stats: RegionDensityStats,
        ) {
          self.densityStatsPerRegion.set(displayedRegionIndex, stats)
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
        setFeatureDensityStatsLimit(stats?: {
          bytes?: number
          fetchSizeLimit?: number
        }) {
          // Clear both gates first: force-loads alternate between byte and
          // density limits depending on which gate tripped, and leaving a
          // stale value behind disables the other code path forever (the
          // maxFeatureDensity getter short-circuits when userByteSizeLimit
          // is set, and densityTooLarge ignores its stats when no max is set).
          self.userByteSizeLimit = undefined
          self.userFeatureDensityLimit = undefined
          if (stats?.bytes) {
            // Raise the gate past the estimate scaled to the *current* view,
            // not the raw captured bytes — the gate compares against
            // estimatedVisibleBytes, so basing the limit on the same scaled
            // value keeps force-load reliable even if the view zoomed between
            // the estimate and the click (mirrors the density branch below,
            // which uses density observed at the current bpPerPx).
            const bytes = self.estimatedVisibleBytes ?? stats.bytes
            self.userByteSizeLimit = Math.ceil(bytes * 1.5)
          } else if (self.maxFeatureDensity !== undefined) {
            // Push the gate past the highest observed density across visible
            // regions, not past the current `maxFeatureDensity`. The latter
            // already includes any prior force-load, so basing on it
            // multiplied force-load attempts exponentially.
            const observedMax = self.observedMaxDensity(getView(self).bpPerPx)
            const baseline =
              observedMax > 0
                ? observedMax
                : readConfObject(self.conf, 'maxFeatureScreenDensity')
            self.userFeatureDensityLimit = Math.ceil(baseline * 1.5)
          }
          // Derived regionTooLarge recomputes once the limit changes — no
          // imperative flag to clear.
        },

        /**
         * #action
         */
        setHover(
          featureId: string | null,
          subfeatureId: string | null,
          tooltip: string | undefined,
          displayedRegionIndex: number,
        ) {
          self.featureIdUnderMouse = featureId
          self.subfeatureIdUnderMouse = subfeatureId
          self.mouseoverExtraInformation = tooltip
          self.hoveredRegionIndex = displayedRegionIndex
        },

        /**
         * #action
         */
        clearHover() {
          self.featureIdUnderMouse = null
          self.subfeatureIdUnderMouse = null
          self.mouseoverExtraInformation = undefined
          self.hoveredRegionIndex = undefined
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
        addFeatureHighlightForItem(
          item: Pick<FlatbushItem, 'startBp' | 'endBp' | 'name'>,
          refName: string,
        ) {
          const already = self.featureHighlights.some(h =>
            featureMatchesHighlight(item, refName, h),
          )
          if (!already) {
            self.featureHighlights.push({
              refName,
              start: item.startBp,
              end: item.endBp,
              name: item.name,
            })
          }
        },

        /**
         * #action
         */
        // Drop every stored highlight that this rendered feature resolves to,
        // using the same predicate the overlay boxes with. Matching by
        // resolution (not exact signature) lets the menu's "Remove highlight"
        // also clear a search-originated highlight, whose stored span/name is
        // trix's — not the rendered item's exact span.
        removeFeatureHighlightsForItem(
          item: Pick<FlatbushItem, 'startBp' | 'endBp' | 'name'>,
          refName: string,
        ) {
          self.featureHighlights = cast(
            self.featureHighlights.filter(
              h => !featureMatchesHighlight(item, refName, h),
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
          ) {
            self.contextMenuInfo = {
              item: featureInfo,
              displayedRegionIndex,
              clientX,
              clientY,
            }
            // Pin the hover to the menu's target so its highlight box always
            // matches the feature the menu acts on — for every entry point
            // (canvas or label right-click), and even when no mousemove
            // preceded this open. The menu is feature-level, so box the whole
            // feature (subfeature cleared) and drop the tooltip so it doesn't
            // overlap the menu. closeContextMenu clears all of this again.
            self.featureIdUnderMouse = featureInfo.featureId
            self.subfeatureIdUnderMouse = null
            self.hoveredRegionIndex = displayedRegionIndex
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
          // Entering a non-fixed mode (grow/fit) resets transient state a
          // reconfigured height contradicts: a pending manual expand/restore
          // marker is stale, and a leftover scrollTop can strand the sticky GPU
          // canvas at an out-of-range offset (fit usually has no scroll extent —
          // except an extreme stack floored at fitMinScale; grow can remove
          // overflow, leaving the old offset painting clipped/blank until a DOM
          // scroll event syncs it). Mirrors the alignments setHeightMode.
          if (mode !== 'fixed') {
            self.clearHeightBeforeExpand()
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
        // The "Expand to fit features" indicator enters persistent `grow` mode
        // (rather than a one-shot resize) so the track keeps fitting as the user
        // zooms/pans and new data loads — the same mode the "Auto height" track
        // menu radio drives. Stashes the pre-grow height so toggling the
        // indicator back off restores it non-destructively; setHeightMode clears
        // that marker on entry, so restash after.
        expandToFit() {
          const prev = self.height
          self.setHeightMode('grow')
          self.heightBeforeExpand = prev
        },

        /**
         * #action
         */
        // Toggle the indicator back off: leave grow mode and restore the height
        // the track had before growing. setHeightMode('fixed') keeps
        // heightBeforeExpand (only non-fixed modes clear it), so the restore
        // below can read it.
        collapseFromExpand() {
          self.setHeightMode('fixed')
          if (self.heightBeforeExpand !== undefined) {
            self.setHeight(self.heightBeforeExpand)
            self.heightBeforeExpand = undefined
          }
        },

        /**
         * #action
         */
        // Compressed-byte budget passed into the feature-fetch RPC, which
        // short-circuits an over-budget region before downloading features
        // (canvas gates inside the fetch RPC rather than via the shared
        // pre-flight estimate RPC, so there's no second round-trip to race).
        // Only gated in the force-load zone (visibleBp >= AUTO_FORCE_LOAD_BP);
        // below it small regions always load. `userByteSizeLimit` (set by
        // force-load) raises the budget so a forced fetch isn't re-blocked.
        byteSizeLimit(): number | undefined {
          const view = getView(self)
          return view.visibleBp < AUTO_FORCE_LOAD_BP
            ? undefined
            : (self.userByteSizeLimit ??
                readConfObject(self.conf, 'fetchSizeLimit'))
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
          let totalBytes = 0
          for (const {
            displayedRegionIndex,
            region,
            bpPerPx,
            result,
          } of fetches) {
            totalBytes += result.bytes ?? 0
            // featureCount drives the density gate; absent only on a byte
            // short-circuit (no features were counted), which the byte gate
            // covers via totalBytes instead.
            if (result.featureCount !== undefined) {
              self.setDensityStats(displayedRegionIndex, {
                featureCount: result.featureCount,
                regionWidthBp: region.end - region.start,
              })
            }
            if (!('regionTooLarge' in result)) {
              self.setRpcData(displayedRegionIndex, result, bpPerPx, region)
            }
          }
          // Feed the derived byte gate (bytesEstimateTooLarge) the way the
          // pre-flight RPC used to — now sourced from the fetch itself.
          self.setFeatureDensityStats({ bytes: totalBytes })
        }

        return {
          /**
           * #action
           */
          async reload() {
            const view = getContainingView(self) as LinearGenomeViewModel
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
        const superSetFeatureDensityStats = self.setFeatureDensityStats
        return {
          /**
           * #action
           * Records the span the byte estimate was measured at so
           * `estimatedVisibleBytes` can scale it to the current view (see
           * `byteEstimateVisibleBp`).
           */
          setFeatureDensityStats(
            stats?: Parameters<typeof superSetFeatureDensityStats>[0],
          ) {
            self.byteEstimateVisibleBp = stats
              ? getView(self).visibleBp
              : undefined
            superSetFeatureDensityStats(stats)
          },
        }
      })
      .actions(self => ({
        /**
         * #action
         */
        clearStaleDensityState() {
          self.densityStatsPerRegion.clear()
          self.setFeatureDensityStats(undefined)
        },
      }))
      .actions(self => {
        const superResizeHeight = self.resizeHeight
        return {
          /**
           * #action
           * A manual drag-resize means the user wants a fixed height; leave grow
           * mode first, otherwise the CanvasAutoHeight autorun snaps the height
           * back on the next layout change and the drag appears to do nothing.
           * Also drop any expand-to-fit marker — once the user sets a height by
           * hand, restoring to the pre-expand height is stale (same reasoning
           * setHeightMode uses when entering grow/fit).
           */
          resizeHeight(distance: number) {
            if (self.heightMode === 'grow') {
              self.setHeightMode('fixed')
            }
            self.clearHeightBeforeExpand()
            return superResizeHeight(distance)
          },
        }
      })
      .actions(self => {
        const superAfterAttach = self.afterAttach
        return {
          /**
           * #action
           */
          afterAttach() {
            superAfterAttach()

            // Auto-height (grow): snap height to fit the laid-out content,
            // capped at GROW_MAX_HEIGHT via grownHeight. maxY derives from
            // laidOutDataMap, which derives from raw fetch data + coarseBpPerPx
            // (debounced 500ms) + label visibility — so zoom and label toggles
            // both flow through here without extra plumbing.
            addDisposer(
              self,
              autorun(
                () => {
                  if (self.autoHeight) {
                    self.setHeight(self.grownHeight)
                  }
                },
                { name: 'CanvasAutoHeight' },
              ),
            )

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
                  const view = getContainingView(self) as LinearGenomeViewModel
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
                self.clearStaleDensityState()
                self.clearHeightBeforeExpand()
                // Reset scroll to the top only on an actual region-list change
                // (chromosome navigation) — not on same-region zoom/pan, which
                // must keep the user's scroll position (see
                // clearDisplaySpecificData).
                self.setScrollTop(0)
              },
              'CanvasClearDensityOnDisplayedRegions',
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
            let prevMode: string | undefined
            let prevShowLabels: boolean | undefined
            let prevShowDescriptions: boolean | undefined
            let prevFitScale: number | undefined
            // autorunOnReadyView gates on view.initialized — laidOutDataMap is
            // empty until then, and showLabels/effectiveShowDescriptions read
            // view.width (which throws pre-measure), so the body must not run
            // until the view is ready. prevs stay undefined until the first
            // ready run seeds them; they're only compared once prevLayout is
            // non-undefined, which can't happen before that first run.
            autorunOnReadyView(
              self,
              () => {
                const current = self.laidOutDataMap
                const mode = self.displayMode
                const showLabels = self.showLabels
                const showDescriptions = self.effectiveShowDescriptions
                // A fit-to-height rescale (e.g. a drag-resize) is a uniform
                // fit, not a row re-pack, so treat it like a mode change:
                // snap rather than morph, else every resize frame animates.
                const fitScale = self.fitScale
                const scaleUnchanged =
                  mode === prevMode &&
                  showLabels === prevShowLabels &&
                  showDescriptions === prevShowDescriptions &&
                  fitScale === prevFitScale
                const from = prevLayout
                prevLayout = current
                prevMode = mode
                prevShowLabels = showLabels
                prevShowDescriptions = showDescriptions
                prevFitScale = fitScale
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
                // below, not only in the same-scale path.
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
        // Extension point for subclasses to add checkbox/radio items to the
        // "Show..." submenu without rebuilding trackMenuItems from scratch.
        showSubmenuMenuItems() {
          return [
            radioSubMenu(
              'Show labels',
              self.showLabelsMode,
              [
                { value: 'auto', label: 'Auto (hide when dense)' },
                { value: 'on', label: 'Always on' },
                { value: 'off', label: 'Always off' },
              ],
              mode => {
                self.setShowLabels(mode)
              },
            ),
            {
              label: 'Show descriptions',
              type: 'checkbox' as const,
              checked: self.showDescriptions,
              onClick: () => {
                self.setShowDescriptions(!self.showDescriptions)
              },
            },
            {
              label: 'Show outline',
              type: 'checkbox' as const,
              checked: self.showOutline,
              onClick: () => {
                self.setShowOutline(!self.showOutline)
              },
            },
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
            item: { featureId, startBp, endBp, name },
            displayedRegionIndex,
          } = info
          const pinned = self.pinnedFeatureIdSet.has(featureId)
          const highlighted = self.highlightedFeatureIdSet.has(featureId)
          const inSoloSet = self.soloFeatureIdSet.has(featureId)
          const soloCount = self.soloFeatureIds.length
          const hiddenCount = self.hiddenFeatureIds.length
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
            {
              label: highlighted ? 'Remove highlight' : 'Highlight feature',
              icon: Highlighter,
              onClick: () => {
                const region = self.loadedRegions.get(displayedRegionIndex)
                if (region) {
                  const item = { startBp, endBp, name }
                  if (highlighted) {
                    self.removeFeatureHighlightsForItem(item, region.refName)
                  } else {
                    self.addFeatureHighlightForItem(item, region.refName)
                  }
                }
              },
            },
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
                ...(hiddenCount > 0
                  ? [
                      {
                        label: `Show ${hiddenCount} hidden feature${hiddenCount > 1 ? 's' : ''}`,
                        icon: VisibilityIcon,
                        onClick: () => {
                          self.showAllHidden()
                        },
                      },
                    ]
                  : []),
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
         * The "Feature height" submenu. The top level is only the three intuitive
         * size presets (the one thing ~everyone wants). The less-obvious
         * container-sizing strategy lives under a "Track height" nested entry
         * with effect-describing labels, so a first-time user never has to parse
         * "fixed/grow/fit". Shared by every canvas display (genes, variants).
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
                // included — is pinnable back over another session default.
                ...displayModeOptions.map(option =>
                  promotableRadioItem({
                    label: option.label,
                    checked: self.displayMode === option.value,
                    onClick: () => {
                      self.setDisplayMode(option.value)
                    },
                    sessionDefault: makeSessionDefaultControl(
                      self,
                      'displayMode',
                      option.value,
                    ),
                  }),
                ),
                { type: 'divider' as const },
                {
                  // Each track-height mode carries its own pin, like the density
                  // presets above: the radio sets the mode for this track, the pin
                  // promotes it as the session-wide default. heightMode is a
                  // sentinel promotable slot, so every mode — `fixed` included —
                  // is pinnable back over another session default.
                  label: 'Track height',
                  subMenu: heightModeOptions.map(option =>
                    promotableRadioItem({
                      label: option.label,
                      checked: self.heightMode === option.value,
                      onClick: () => {
                        self.setHeightMode(option.value)
                      },
                      sessionDefault: makeSessionDefaultControl(
                        self,
                        'heightMode',
                        option.value,
                      ),
                    }),
                  ),
                },
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
                ...(hiddenCount > 0
                  ? [
                      {
                        label: `Show ${hiddenCount} hidden feature${hiddenCount > 1 ? 's' : ''}`,
                        icon: VisibilityIcon,
                        onClick: () => {
                          self.showAllHidden()
                        },
                      },
                    ]
                  : []),
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
