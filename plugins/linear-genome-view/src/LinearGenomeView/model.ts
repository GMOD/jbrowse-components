import type React from 'react'
import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import {
  assembleLocString,
  clamp,
  getBpDisplayStr,
  getSession,
  isSessionModelWithWidgets,
  localStorageGetBoolean,
  localStorageGetItem,
  measureText,
  springAnimate,
  sum,
} from '@jbrowse/core/util'
import {
  bpToPx,
  computeMoveToLayout,
  createOverviewLayout,
  getContentBlocksPxSpan,
  getLayoutHighlightCoords,
  moveTo,
  offsetBpToPx,
  pxToBp,
} from '@jbrowse/core/util/Base1DUtils'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import calculateStaticBlocks from '@jbrowse/core/util/calculateStaticBlocks'
import {
  getParentRenderProps,
  hideTrackGeneric,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { cast, getParent, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { isSessionWithMultipleViews } from '@jbrowse/product-core'
import { when } from 'mobx'

import { handleSelectedRegion } from '../searchUtils.ts'
import { doAfterAttach } from './afterAttach.ts'
import Header from './components/Header.tsx'
import MiniControls from './components/MiniControls.tsx'
import { shouldSwapTracks } from './components/util.ts'
import {
  HEADER_BAR_HEIGHT,
  HEADER_OVERVIEW_HEIGHT,
  MINIMIZED_TRACK_HEIGHT,
  RESIZE_HANDLE_HEIGHT,
  SCALE_BAR_HEIGHT,
} from './consts.ts'
import { setupKeyboardHandler } from './keyboardHandler.ts'
import {
  buildMenuItems,
  buildRubberBandMenuItems,
  buildRubberbandClickMenuItems,
  cloneMenuItems,
  rewriteOnClicks,
} from './menuItems.ts'
import {
  calculateVisibleLocStrings,
  expandRegion,
  generateLocations,
  makeBlockTicks,
} from './util.ts'

import type {
  BpOffset,
  ExportSvgOptions,
  HighlightType,
  InitState,
  NavLocation,
  VolatileGuide,
} from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AssemblyManager, ParsedLocString } from '@jbrowse/core/util'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'
import type { BlockSet, ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { Region } from '@jbrowse/core/util/types'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

// lazies
const SearchResultsDialog = lazy(
  () => import('./components/SearchResultsDialog.tsx'),
)

/**
 * Calculate the offsetPx needed to center content within a viewport.
 * Returns a negative offset when content is smaller than viewport (padding on left).
 */
function getCenteredOffsetPx(contentPx: number, viewportPx: number) {
  return Math.round(contentPx / 2 - viewportPx / 2)
}

/**
 * Resolve a region's refName to the assembly's canonical name, falling back to
 * the raw refName when the assemblyName is missing or unknown (so highlights
 * authored without an assembly still render in single-assembly views).
 */
function resolveCanonicalRefName(
  self: IAnyStateTreeNode,
  region: { assemblyName?: string; refName: string },
) {
  const { assemblyManager } = getSession(self)
  const asm = region.assemblyName
    ? assemblyManager.get(region.assemblyName)
    : undefined
  return asm?.getCanonicalRefName(region.refName) ?? region.refName
}

export const AUTO_FORCE_LOAD_BP = 20_000

// most zoomed-in level: 50px per bp
const MIN_BP_PER_PX = 1 / 50

// fraction of the view width the whole genome fills at the most zoomed-out
// level, leaving a 10% margin
const SHOW_ALL_REGIONS_FILL = 0.9

// bpPerPx deltas smaller than this are treated as no zoom change, avoiding
// pointless offset re-anchoring on micro-steps
const BP_PER_PX_EPSILON = 0.000001

/**
 * Resolve a NavLocation's refName to the assembly's canonical name, falling
 * back to the raw refName (and the view's default assembly) when the assembly
 * is missing or unknown.
 */
function navLocationRefName(
  assemblyManager: AssemblyManager,
  defaultAssemblyName: string,
  location: NavLocation,
) {
  return (
    assemblyManager
      .get(location.assemblyName || defaultAssemblyName)
      ?.getCanonicalRefName(location.refName) || location.refName
  )
}

/**
 * Resolve one end of a navigation range to the displayedRegion index that
 * contains it plus the bp offset into that region. `side` selects which edge of
 * the (grow-expanded) interval anchors the offset — 'left' for the range start,
 * 'right' for the range end — accounting for reversed regions. Both the default
 * region and the containing index use first-occurrence lookups so they agree
 * when a refName is displayed more than once.
 */
function resolveNavEndpoint({
  location,
  refName,
  side,
  displayedRegions,
  grow,
}: {
  location: NavLocation
  refName: string
  side: 'left' | 'right'
  displayedRegions: Region[]
  grow?: number
}) {
  const region = displayedRegions.find(r => r.refName === refName)
  if (!region) {
    throw new Error(`could not find a region with refName "${refName}"`)
  }
  let start = location.start ?? region.start
  let end = location.end ?? region.end
  if (grow) {
    ;({ start, end } = expandRegion(start, end, grow, region.start, region.end))
  }
  const index = displayedRegions.findIndex(
    r =>
      r.refName === refName &&
      start >= r.start &&
      start <= r.end &&
      end <= r.end &&
      end >= r.start,
  )
  if (index === -1) {
    throw new Error(
      `could not find a region that contained "${assembleLocString(location)}"`,
    )
  }
  const r = displayedRegions[index]!
  const leftEdge = r.reversed ? r.end - end : start - r.start
  const rightEdge = r.reversed ? r.end - start : end - r.start
  return { index, offset: side === 'left' ? leftEdge : rightEdge }
}

/**
 * #stateModel LinearGenomeView
 * #category view
 *
 * #example
 * A `LinearGenomeView` is what you hand-author under `defaultSession.views`. The
 * `init` shorthand fills in `displayedRegions`/`bpPerPx`/`offsetPx` for you:
 * ```js
 * defaultSession: {
 *   name: 'My session',
 *   views: [
 *     {
 *       type: 'LinearGenomeView',
 *       init: {
 *         assembly: 'hg38',
 *         loc: 'chr1:1,000,000-1,100,000',
 *         tracks: ['genes', 'alignments'],
 *       },
 *     },
 *   ],
 * }
 * ```
 * At runtime the same model is driven imperatively — every property and action
 * below is reachable on `viewState.session.views[0]`:
 * ```js
 * const view = viewState.session.views[0]
 * await view.navToLocString('chr1:2,000,000-2,100,000')
 * view.showTrack('alignments')
 * view.setBpPerPx(view.bpPerPx * 2) // zoom out 2x
 * ```
 */
export function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'LinearGenomeView',
      BaseViewModel,
      types.model({
        /**
         * #property
         */
        id: ElementId,

        /**
         * #property
         * this is a string instead of the const literal 'LinearGenomeView' to
         * reduce some typescripting strictness, but you should pass the string
         * 'LinearGenomeView' to the model explicitly
         */
        type: types.literal('LinearGenomeView') as unknown as string,

        /**
         * #property
         * corresponds roughly to the horizontal scroll of the LGV
         */
        offsetPx: types.stripDefault(types.number, 0),

        /**
         * #property
         * corresponds roughly to the zoom level, base-pairs per pixel
         */
        bpPerPx: types.stripDefault(types.number, 1),

        /**
         * #property
         * currently displayed regions, can be a single chromosome, arbitrary
         * subsections, or the entire  set of chromosomes in the genome, but it not
         * advised to use the entire set of chromosomes if your assembly is very
         * fragmented
         */
        displayedRegions: types.stripDefault(types.frozen<Region[]>(), []),

        /**
         * #property
         * array of currently displayed tracks state models instances
         */
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        ),

        /**
         * #property
         */
        hideHeader: types.stripDefault(types.boolean, false),

        /**
         * #property
         */
        hideHeaderOverview: types.stripDefault(types.boolean, false),

        /**
         * #property
         */
        hideNoTracksActive: types.stripDefault(types.boolean, false),

        /**
         * #property
         */
        trackSelectorType: types.stripDefault(
          types.enumeration(['hierarchical']),
          'hierarchical',
        ),
        /**
         * #property
         * show the "center line"
         */
        showCenterLine: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-showCenterLine', false),
        ),

        /**
         * #property
         * show the "cytobands" in the overview scale bar
         */
        showCytobandsSetting: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-showCytobands', true),
        ),

        /**
         * #property
         * how to display the track labels, can be "overlapping", "offset", or
         * "hidden", or empty string "" (which results in conf being used). see
         * LinearGenomeViewPlugin
         * https://jbrowse.org/jb2/docs/config/lineargenomeviewplugin/ docs for
         * how conf is used
         */
        trackLabelsOverride: types.optional(
          types.string,
          () => localStorageGetItem('lgv-trackLabels') ?? '',
        ),

        /**
         * #property
         * show the "gridlines" in the track area
         */
        showGridlines: types.stripDefault(types.boolean, true),

        /**
         * #property
         * highlights on the LGV from the URL parameters
         */
        highlight: types.stripDefault(
          types.array(types.frozen<HighlightType>()),
          [],
        ),

        /**
         * #property
         * controls whether view.highlight entries are rendered
         */
        highlightsVisible: types.stripDefault(types.boolean, true),

        /**
         * #property
         * controls whether highlight/bookmark chip labels are shown inline
         */
        labelsVisible: types.stripDefault(types.boolean, true),

        /**
         * #property
         * color by CDS
         */
        colorByCDS: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-colorByCDS', false),
        ),

        /**
         * #property
         * show the track outlines
         */
        showTrackOutlines: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-showTrackOutlines', true),
        ),

        /**
         * #property
         * enable scroll-to-zoom on WebGL tracks
         */
        scrollZoom: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-scrollZoom', false),
        ),
        /**
         * #property
         * when true, only the header and coordinate scalebar are rendered
         */
        scalebarOnly: types.stripDefault(types.boolean, false),
        /**
         * #property
         * transient declarative launch spec: assembly + optional location,
         * tracks, and highlights to apply once the view attaches. It is applied
         * by the afterAttach autorun and then cleared (setInit(undefined)), so a
         * saved session never retains it. Shared by all three launch surfaces —
         * URL params, createViewState(), and session/config JSON. example:
         * ```json
         * {
         *   "assembly": "hg19",
         *   "loc": "chr1:1,000,000-2,000,000",
         *   "tracks": ["genes", "variants"]
         * }
         * ```
         */
        init: types.frozen<InitState | undefined>(),
      }),
    )
    .volatile(self => {
      // typed locals so `unknown`/`Record` aren't narrowed to `undefined`/`{}`; inline
      // type assertions here get stripped by no-unnecessary-type-assertion
      const volatileError: unknown = undefined
      const trackRefs: Record<string, HTMLDivElement> = {}
      return {
        /**
         * #volatile
         */
        volatileWidth: undefined as number | undefined,
        /**
         * #volatile
         */
        minimumBlockWidth: 3,
        /**
         * #volatile
         */
        draggingTrackId: undefined as undefined | string,
        /**
         * #volatile
         */
        lastTrackDragY: undefined as undefined | number,
        /**
         * #volatile
         */

        volatileError,
        /**
         * #volatile
         */

        trackRefs,
        /**
         * #volatile
         */
        coarseDynamicBlocks: [] as ContentBlock[],
        /**
         * #volatile
         */
        coarseTotalBp: 0,
        /**
         * #volatile
         */
        coarseBpPerPx: self.bpPerPx,
        /**
         * #volatile
         */
        leftOffset: undefined as undefined | BpOffset,
        /**
         * #volatile
         */
        rightOffset: undefined as undefined | BpOffset,
        /**
         * #volatile
         */
        isScalebarRefNameMenuOpen: false,
        /**
         * #volatile
         */
        scalebarRefNameClickPending: false,
        /**
         * #volatile
         * temporary vertical guides that can be set by displays (e.g., LD display hover)
         */
        volatileGuides: [] as VolatileGuide[],
      }
    })
    .views(self => ({
      /**
       * #getter
       */
      get pinnedTracks() {
        return self.tracks.filter(t => t.pinned)
      },
      /**
       * #getter
       */
      get unpinnedTracks() {
        return self.tracks.filter(t => !t.pinned)
      },
      /**
       * #getter
       * the effective track labels setting, resolving the stored
       * `trackLabelsOverride` against the LinearGenomeViewPlugin config default
       */
      get trackLabels() {
        const sessionSetting = getConf(getSession(self), [
          'LinearGenomeViewPlugin',
          'trackLabels',
        ])
        return self.trackLabelsOverride || sessionSetting
      },
      /**
       * #getter
       */
      get width(): number {
        if (self.volatileWidth === undefined) {
          throw new Error(
            'width undefined, make sure to check for model.initialized',
          )
        }
        return self.volatileWidth
      },
      /**
       * #getter
       * width minus track outline borders (1px each side when shown)
       */
      get trackWidthPx(): number {
        return this.width - (self.showTrackOutlines ? 2 : 0)
      },
      /**
       * #getter
       */
      get assemblyNames() {
        return [...new Set(self.displayedRegions.map(r => r.assemblyName))]
      },
      /**
       * #getter
       */
      get assemblyDisplayNames() {
        const { assemblyManager } = getSession(self)
        return this.assemblyNames.map(a => assemblyManager.getDisplayName(a))
      },
      /**
       * #getter
       * checking if lgv is a 'top-level' view is used for toggling pin track
       * capability, sticky positioning
       */
      get isTopLevelView() {
        return getSession(self).views.some(r => r.id === self.id)
      },
      /**
       * #getter
       * only uses sticky view headers when it is a 'top-level' view and
       * session allows it
       */
      get stickyViewHeaders() {
        const session = getSession(self)
        return isSessionWithMultipleViews(session)
          ? this.isTopLevelView && session.stickyViewHeaders
          : false
      },

      /**
       * #getter
       */
      get rubberbandTop() {
        let pinnedTracksTop = 0
        if (this.stickyViewHeaders) {
          pinnedTracksTop = VIEW_HEADER_HEIGHT
          if (!self.hideHeader) {
            pinnedTracksTop += HEADER_BAR_HEIGHT
            if (!self.hideHeaderOverview) {
              pinnedTracksTop += HEADER_OVERVIEW_HEIGHT
            }
          }
        }
        return pinnedTracksTop
      },

      get pinnedTracksTop() {
        return this.rubberbandTop + SCALE_BAR_HEIGHT
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      scalebarDisplayPrefix() {
        return getParent<{ type: string }>(self, 2).type === 'LinearSyntenyView'
          ? self.assemblyDisplayNames[0]
          : ''
      },
      /**
       * #method
       */
      MiniControlsComponent(): React.FC<any> {
        return MiniControls
      },

      /**
       * #method
       */
      HeaderComponent(): React.FC<any> {
        return Header
      },

      /**
       * #getter
       */
      get assembliesNotFound() {
        const { assemblyManager } = getSession(self)
        const r0 = self.assemblyNames
          .filter(a => !assemblyManager.assemblyNameMap[a])
          .join(',')
        return r0 ? `Assemblies ${r0} not found` : undefined
      },

      /**
       * #getter
       */
      get assemblyErrors() {
        const { assemblyManager } = getSession(self)
        return self.assemblyNames
          .map(name => assemblyManager.get(name)?.error)
          .filter(e => !!e)
          .join(', ')
      },

      /**
       * #getter
       */
      get assembliesInitialized() {
        const { assemblyManager } = getSession(self)
        return self.assemblyNames.every(
          name => assemblyManager.get(name)?.initialized,
        )
      },

      /**
       * #getter
       */
      get initialized() {
        if (self.volatileWidth === undefined) {
          return false
        }
        // if init is set, wait for that assembly to have regions loaded
        if (self.init) {
          const { assemblyManager } = getSession(self)
          const asm = assemblyManager.get(self.init.assembly)
          return !!(asm?.initialized && asm.regions)
        }
        return this.assembliesInitialized
      },

      /**
       * #getter
       */
      get hasDisplayedRegions() {
        return self.displayedRegions.length > 0
      },

      /**
       * #getter
       */
      get loadingMessage() {
        return this.showLoading ? 'Loading' : undefined
      },

      /**
       * #getter
       */
      get hasSomethingToShow() {
        return this.hasDisplayedRegions || !!self.init
      },

      /**
       * #getter
       * Whether to show a loading indicator instead of the import form or view
       */
      get showLoading() {
        return !this.initialized && !this.error && this.hasSomethingToShow
      },

      /**
       * #getter
       * Whether to show the import form
       */
      get showImportForm() {
        return !this.hasSomethingToShow || !!this.error
      },

      /**
       * #getter
       */
      get scalebarHeight() {
        return SCALE_BAR_HEIGHT + RESIZE_HANDLE_HEIGHT
      },

      /**
       * #getter
       */
      get headerHeight() {
        if (self.hideHeader) {
          return 0
        } else if (self.hideHeaderOverview) {
          return HEADER_BAR_HEIGHT
        } else {
          return HEADER_BAR_HEIGHT + HEADER_OVERVIEW_HEIGHT
        }
      },

      /**
       * #getter
       */
      get trackHeights() {
        return sum(
          self.tracks.map(t =>
            t.minimized ? MINIMIZED_TRACK_HEIGHT : t.displays[0].height,
          ),
        )
      },

      /**
       * #getter
       */
      get trackHeightsWithResizeHandles() {
        return this.trackHeights + self.tracks.length * RESIZE_HANDLE_HEIGHT
      },

      /**
       * #getter
       */
      get height() {
        if (self.scalebarOnly) {
          return this.headerHeight + this.scalebarHeight
        }
        return (
          this.trackHeightsWithResizeHandles +
          this.headerHeight +
          this.scalebarHeight
        )
      },

      /**
       * #method
       * Y offset (in pixels, from the top of the view) where a track's
       * rendering container starts. Walks tracks in DOM render order (pinned
       * first, then unpinned), matching TrackContainer's layout and using the
       * same constants it renders with. Returns `undefined` if the track is
       * not present in the view.
       */
      getTrackYOffset(trackId: string) {
        let y = this.headerHeight + this.scalebarHeight
        for (const t of [...self.pinnedTracks, ...self.unpinnedTracks]) {
          if (t.configuration.trackId === trackId) {
            return y
          }
          y +=
            (t.minimized ? MINIMIZED_TRACK_HEIGHT : t.displays[0].height) +
            RESIZE_HANDLE_HEIGHT
        }
        return undefined
      },

      /**
       * #getter
       */
      get totalBp() {
        return sum(self.displayedRegions.map(r => r.end - r.start))
      },

      /**
       * #getter
       */
      get maxBpPerPx() {
        if (this.totalBp === 0 || self.width === 0) {
          return 1
        }
        return this.totalBp / (self.width * SHOW_ALL_REGIONS_FILL)
      },

      /**
       * #getter
       */
      get minBpPerPx() {
        return MIN_BP_PER_PX
      },

      /**
       * #getter
       */
      get error(): unknown {
        if (self.volatileError) {
          return self.volatileError
        }
        if (this.assemblyErrors) {
          return this.assemblyErrors
        }
        if (this.assembliesNotFound) {
          return this.assembliesNotFound
        }
        // Check init assembly for errors (displayedRegions may be empty during init)
        if (self.init) {
          const { assemblyManager } = getSession(self)
          const asm = assemblyManager.get(self.init.assembly)
          if (!asm) {
            return `Assembly ${self.init.assembly} not found`
          }
          if (asm.error) {
            return asm.error
          }
        }
        return undefined
      },

      /**
       * #getter
       */
      get maxOffset() {
        // objectively determined to keep the linear genome on the main screen
        const leftPadding = 10
        return this.displayedRegionsTotalPx - leftPadding
      },

      /**
       * #getter
       */
      get minOffset() {
        // objectively determined to keep the linear genome on the main screen
        const rightPadding = 30
        return -self.width + rightPadding
      },

      /**
       * #getter
       */
      get displayedRegionsTotalPx() {
        return self.bpPerPx === 0 ? 0 : this.totalBp / self.bpPerPx
      },

      /**
       * #method
       */
      renderProps() {
        return {
          ...getParentRenderProps(self),
          bpPerPx: self.bpPerPx,
          colorByCDS: self.colorByCDS,
        }
      },

      /**
       * #method
       */
      searchScope(assemblyName: string) {
        return {
          assemblyName,
          includeAggregateIndexes: true,
          tracks: self.tracks,
        }
      },

      /**
       * #getter
       */
      get trackMap() {
        const map = new Map()
        for (const track of self.tracks) {
          map.set(track.configuration.trackId, track)
        }
        return map
      },

      /**
       * #method
       */
      getTrack(id: string) {
        return this.trackMap.get(id)
      },

      /**
       * #method
       * displayId of the active (shown) display for a track in this view, used
       * by the config editor to expand the relevant display and collapse the
       * track's other displays
       */
      getActiveDisplayId(trackId: string): string | undefined {
        return this.getTrack(trackId)?.activeDisplay.configuration.displayId
      },

      /**
       * #getter
       */
      get trackTypeActions() {
        const allActions = new Map<string, MenuItem[]>()
        for (const track of self.tracks) {
          const trackInMap = allActions.get(track.type)
          if (!trackInMap) {
            const viewMenuActions = cloneMenuItems(track.viewMenuActions)
            rewriteOnClicks(
              self as LinearGenomeViewModel,
              track.type,
              viewMenuActions,
            )
            allActions.set(track.type, viewMenuActions)
          }
        }

        return allActions
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setShowTrackOutlines(arg: boolean) {
        self.showTrackOutlines = arg
      },
      /**
       * #action
       */
      setScrollZoom(flag: boolean) {
        self.scrollZoom = flag
      },
      /**
       * #action
       */
      setColorByCDS(flag: boolean) {
        self.colorByCDS = flag
      },
      /**
       * #action
       */
      setShowCytobands(flag: boolean) {
        self.showCytobandsSetting = flag
      },
      /**
       * #action
       */
      setWidth(newWidth: number) {
        self.volatileWidth = newWidth
      },
      /**
       * #action
       */
      setError(error: unknown) {
        self.volatileError = error
      },
      /**
       * #action
       */
      setIsScalebarRefNameMenuOpen(isOpen: boolean) {
        self.isScalebarRefNameMenuOpen = isOpen
      },
      /**
       * #action
       */
      setScalebarRefNameClickPending(pending: boolean) {
        self.scalebarRefNameClickPending = pending
      },
      /**
       * #action
       */
      setHideHeader(b: boolean) {
        self.hideHeader = b
      },
      /**
       * #action
       */
      setHideHeaderOverview(b: boolean) {
        self.hideHeaderOverview = b
      },
      /**
       * #action
       */
      setScalebarOnly(b: boolean) {
        self.scalebarOnly = b
      },
      /**
       * #action
       */
      setHideNoTracksActive(b: boolean) {
        self.hideNoTracksActive = b
      },
      /**
       * #action
       */
      setShowGridlines(b: boolean) {
        self.showGridlines = b
      },
      /**
       * #action
       */
      addToHighlights(highlight: HighlightType) {
        self.highlight.push(highlight)
      },
      /**
       * #action
       */
      setHighlight(highlight?: HighlightType[]) {
        self.highlight = cast(highlight)
      },
      /**
       * #action
       */
      removeHighlight(highlight: HighlightType) {
        self.highlight.remove(highlight)
      },
      /**
       * #action
       */
      updateHighlight(old: HighlightType, updates: Partial<HighlightType>) {
        const idx = self.highlight.indexOf(old)
        if (idx !== -1) {
          self.highlight[idx] = { ...old, ...updates }
        }
      },
      /**
       * #action
       */
      setHighlightsVisible(arg: boolean) {
        self.highlightsVisible = arg
      },
      /**
       * #action
       */
      setLabelsVisible(arg: boolean) {
        self.labelsVisible = arg
      },
      /**
       * #action
       * set temporary vertical guides (e.g., for LD display hover)
       */
      setVolatileGuides(guides: VolatileGuide[]) {
        self.volatileGuides = guides
      },
      /**
       * #action
       */
      scrollTo(offsetPx: number) {
        const newOffsetPx = clamp(offsetPx, self.minOffset, self.maxOffset)
        self.offsetPx = newOffsetPx
        return newOffsetPx
      },

      /**
       * #action
       */
      zoomTo(bpPerPx: number, offset = self.width / 2) {
        const newBpPerPx = clamp(bpPerPx, self.minBpPerPx, self.maxBpPerPx)
        const oldBpPerPx = self.bpPerPx
        if (Math.abs(oldBpPerPx - newBpPerPx) < BP_PER_PX_EPSILON) {
          return oldBpPerPx
        }
        if (!self.displayedRegions.length) {
          self.bpPerPx = newBpPerPx
          return newBpPerPx
        }

        // Anchor on the cursor's raw within-region bp offset (float,
        // padding-aware). Round-tripping through bpToPx using pxToBp's `coord`
        // loses up to 1 bp per call because regionCoord floors+1 (1-based)
        // while bpToPx treats coord-r.start as a 0-based offset — visible as
        // ~5 px judder during rapid scroll-zoom at small bpPerPx. The legacy
        // (offsetPx + cursor_x) * bpPerPx is also unstable in multi-region
        // because inter-region padding contributes paddingWidth * bpPerPx of
        // virtual-bp that scales with bpPerPx. Fall back to the legacy formula
        // when the cursor is over empty space (oob).
        const anchor = pxToBp(self, offset)
        self.bpPerPx = newBpPerPx
        const targetPx = anchor.oob
          ? ((self.offsetPx + offset) * oldBpPerPx) / newBpPerPx
          : offsetBpToPx(self, anchor.index, anchor.offset)
        // Don't round here: rounding offsetPx every frame loses up to 0.5 px
        // per step, which (at high bpPerPx) becomes 0.5 * bpPerPx of cursor
        // bp drift and compounds frame-to-frame during a scroll-zoom burst.
        // Fractional offsetPx is harmless — downstream block math handles it.
        this.scrollTo(targetPx - offset)
        return newBpPerPx
      },

      /**
       * #action
       * sets offsets of rubberband, used in the get sequence dialog can call
       * view.getSelectedRegions(view.leftOffset,view.rightOffset) to compute
       * the selected regions from the offsets
       */
      setOffsets(left?: BpOffset, right?: BpOffset) {
        self.leftOffset = left
        self.rightOffset = right
      },

      /**
       * #action
       */
      setSearchResults(
        searchResults: BaseResult[],
        searchQuery: string,
        assemblyName?: string,
      ) {
        getSession(self).queueDialog(handleClose => [
          SearchResultsDialog,
          {
            model: self as LinearGenomeViewModel,
            searchResults,
            searchQuery,
            handleClose,
            assemblyName,
          },
        ])
      },

      /**
       * #action
       */
      setNewView(bpPerPx: number, offsetPx: number) {
        this.zoomTo(bpPerPx)
        this.scrollTo(offsetPx)
      },

      /**
       * #action
       */
      horizontallyFlip() {
        self.displayedRegions = cast(
          [...self.displayedRegions]
            .reverse()
            .map(region => ({ ...region, reversed: !region.reversed })),
        )
        this.scrollTo(self.totalBp / self.bpPerPx - self.offsetPx - self.width)
      },

      /**
       * #action
       */
      showTrack(
        trackId: string,
        initialSnapshot = {},
        displayInitialSnapshot = {},
      ) {
        return showTrackGeneric(
          self,
          trackId,
          initialSnapshot,
          displayInitialSnapshot,
        )
      },
      /**
       * #action
       */
      hideTrack(trackId: string) {
        return hideTrackGeneric(self, trackId)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      moveTrackDown(id: string) {
        const idx = self.tracks.findIndex(v => v.id === id)
        if (idx !== -1 && idx < self.tracks.length - 1) {
          self.tracks.splice(idx, 2, self.tracks[idx + 1], self.tracks[idx])
        }
      },
      /**
       * #action
       */
      moveTrackUp(id: string) {
        const idx = self.tracks.findIndex(track => track.id === id)
        if (idx > 0) {
          self.tracks.splice(idx - 1, 2, self.tracks[idx], self.tracks[idx - 1])
        }
      },
      /**
       * #action
       */
      moveTrackToTop(id: string) {
        const track = self.tracks.find(track => track.id === id)
        if (track) {
          self.tracks = cast([track, ...self.tracks.filter(t => t.id !== id)])
        }
      },
      /**
       * #action
       */
      moveTrackToBottom(id: string) {
        const track = self.tracks.find(track => track.id === id)
        if (track) {
          self.tracks = cast([...self.tracks.filter(t => t.id !== id), track])
        }
      },
      /**
       * #action
       */
      moveTrack(movingId: string, targetId: string) {
        const oldIndex = self.tracks.findIndex(track => track.id === movingId)
        if (oldIndex === -1) {
          throw new Error(`Track ID ${movingId} not found`)
        }
        const newIndex = self.tracks.findIndex(track => track.id === targetId)
        if (newIndex === -1) {
          throw new Error(`Track ID ${targetId} not found`)
        }

        // direction-aware placement: filtering out oldIndex shifts the target
        // left by one when dragging down (oldIndex < newIndex), so splicing at
        // newIndex lands the track *after* the target; dragging up leaves the
        // target's index intact, landing *before* it. This matches the side
        // the dragged track approaches from.
        const tracks = self.tracks.filter((_, idx) => idx !== oldIndex)
        tracks.splice(newIndex, 0, self.tracks[oldIndex])
        self.tracks = cast(tracks)
      },

      /**
       * #action
       */
      toggleTrack(trackId: string) {
        return toggleTrackGeneric(self, trackId)
      },

      /**
       * #action
       */
      setTrackLabels(setting: 'overlapping' | 'offset' | 'hidden') {
        self.trackLabelsOverride = setting
      },

      /**
       * #action
       */
      setShowCenterLine(b: boolean) {
        self.showCenterLine = b
      },

      /**
       * #action
       */
      setDisplayedRegions(regions: Region[]) {
        self.displayedRegions = cast(regions)
        self.zoomTo(self.bpPerPx)
      },

      /**
       * #action
       */
      activateTrackSelector() {
        if (self.trackSelectorType === 'hierarchical') {
          const session = getSession(self)
          if (isSessionModelWithWidgets(session)) {
            const selector = session.addWidget(
              'HierarchicalTrackSelectorWidget',
              'hierarchicalTrackSelector',
              { view: self },
            )
            session.showWidget(selector)
            return selector
          }
        }
        throw new Error(`invalid track selector type ${self.trackSelectorType}`)
      },

      /**
       * #method
       * Helper method for the fetchSequence.
       * Retrieves the corresponding regions that were selected by the
       * rubberband
       *
       * @param leftOffset - `object as {start, end, index, offset}`, offset = start
       * of user drag
       * @param rightOffset - `object as {start, end, index, offset}`,
       * offset = end of user drag
       * @returns array of Region[]
       */
      getSelectedRegions(leftOffset?: BpOffset, rightOffset?: BpOffset) {
        if (!leftOffset || !rightOffset) {
          return []
        }
        const snap = getSnapshot(self)
        const snapWithLayout = {
          ...snap,
          width: self.width,
          minimumBlockWidth: self.minimumBlockWidth,
        }
        const { bpPerPx, offsetPx: rawOffsetPx } = computeMoveToLayout(
          snapWithLayout,
          leftOffset,
          rightOffset,
        )
        // mirror Base1DView.scrollTo clamping: raw offsetPx can be far outside
        // the valid range when both offsets are oob on the same side
        const offsetPx = clamp(
          rawOffsetPx,
          self.minOffset,
          self.totalBp / bpPerPx - 10,
        )
        return calculateDynamicBlocks({
          ...snapWithLayout,
          bpPerPx,
          offsetPx,
        }).contentBlocks.map(region => ({
          assemblyName: region.assemblyName,
          refName: region.refName,
          start: Math.floor(region.start),
          end: Math.ceil(region.end),
        }))
      },

      /**
       * #action
       */
      horizontalScroll(distance: number) {
        const oldOffsetPx = self.offsetPx
        // newOffsetPx is the actual offset after the scroll is clamped
        const newOffsetPx = self.scrollTo(self.offsetPx + distance)
        return newOffsetPx - oldOffsetPx
      },

      /**
       * #action
       */
      showAllRegions() {
        self.bpPerPx = self.maxBpPerPx
        self.scrollTo(
          getCenteredOffsetPx(self.displayedRegionsTotalPx, self.width),
        )
      },

      /**
       * #action
       */
      showAllRegionsInAssembly(assemblyName?: string) {
        const session = getSession(self)
        const { assemblyManager } = session
        if (!assemblyName) {
          const names = new Set(self.displayedRegions.map(r => r.assemblyName))
          if (names.size > 1) {
            session.notify(
              `Can't perform operation with multiple assemblies currently`,
            )
            return
          }
          ;[assemblyName] = [...names]
        }
        const regions = assemblyManager.get(assemblyName!)?.regions
        if (!regions) {
          return
        }
        this.setDisplayedRegions(regions)
        this.showAllRegions()
      },

      /**
       * #action
       */
      setDraggingTrackId(idx?: string) {
        self.draggingTrackId = idx
        if (idx === undefined) {
          self.lastTrackDragY = undefined
        }
      },

      /**
       * #action
       */
      setLastTrackDragY(y: number) {
        self.lastTrackDragY = y
      },

      /**
       * #action
       * called while dragging a track over the track at `targetId`; reorders
       * once the cursor has moved far enough (see shouldSwapTracks) to avoid
       * jitter when a short track is dragged over a tall one
       */
      onTrackDragOver(targetId: string, currentY: number) {
        const { draggingTrackId } = self
        if (draggingTrackId !== undefined && draggingTrackId !== targetId) {
          const draggingIdx = self.tracks.findIndex(
            t => t.id === draggingTrackId,
          )
          const targetIdx = self.tracks.findIndex(t => t.id === targetId)
          if (draggingIdx !== -1 && targetIdx !== -1) {
            const movingDown = targetIdx > draggingIdx
            if (shouldSwapTracks(self.lastTrackDragY, currentY, movingDown)) {
              self.lastTrackDragY = currentY
              this.moveTrack(draggingTrackId, targetId)
            }
          }
        }
      },

      /**
       * #action
       * this "clears the view" and makes the view return to the import form
       */
      clearView() {
        this.setDisplayedRegions([])
        self.tracks.clear()
        // it is necessary to run these after setting displayed regions empty
        // or else model.offsetPx gets set to Infinity and breaks
        // @jbrowse/mobx-state-tree snapshot
        self.scrollTo(0)
        self.zoomTo(10)
      },

      /**
       * #action
       */
      setInit(arg?: InitState) {
        self.init = arg
      },

      /**
       * #method
       * creates an svg export and save using FileSaver
       */
      async exportSvg(opts: ExportSvgOptions = {}) {
        const { renderToSvg } =
          await import('./svgcomponents/SVGLinearGenomeView.tsx')
        const html = await renderToSvg(self as LinearGenomeViewModel, opts)
        const { saveSvgAsImage } = await import('@jbrowse/core/util')
        await saveSvgAsImage(html, opts)
      },
    }))
    .actions(self => {
      let cancelLastAnimation = () => {}

      /**
       * #action
       * perform animated slide
       */
      function slide(viewWidths: number) {
        const [animate, cancelAnimation] = springAnimate(
          self.offsetPx,
          self.offsetPx + self.width * viewWidths,
          self.scrollTo,
          undefined,
          undefined,
          200,
        )
        cancelLastAnimation()
        cancelLastAnimation = cancelAnimation
        animate()
      }

      return { slide }
    })
    .actions(self => {
      let cancelLastAnimation = () => {}

      /**
       * #action
       * perform animated zoom
       */
      function zoom(targetBpPerPx: number) {
        cancelLastAnimation()

        // Clamp to zoom limits
        const effectiveTarget = clamp(
          targetBpPerPx,
          self.minBpPerPx,
          self.maxBpPerPx,
        )

        // If already at limit (or effectively no change), do nothing
        if (effectiveTarget === self.bpPerPx) {
          return
        }

        // Animate bpPerPx directly from current to target
        const [animate, cancelAnimation] = springAnimate(
          self.bpPerPx,
          effectiveTarget,
          self.zoomTo,
          undefined,
          0,
          1000,
          50,
        )
        cancelLastAnimation = cancelAnimation
        animate()
      }

      return { zoom }
    })
    .views(self => ({
      /**
       * #getter
       */
      get canShowCytobands() {
        return self.displayedRegions.length === 1 && this.anyCytobandsExist
      },
      /**
       * #getter
       */
      get showCytobands() {
        return this.canShowCytobands && self.showCytobandsSetting
      },
      /**
       * #getter
       */
      get anyCytobandsExist() {
        const { assemblyManager } = getSession(self)
        return self.assemblyNames.some(
          a => assemblyManager.get(a)?.cytobands?.length,
        )
      },
      /**
       * #getter
       * the cytoband is displayed to the right of the chromosome name, and
       * that offset is calculated manually with this method
       */
      get cytobandOffset() {
        return this.showCytobands
          ? measureText(self.displayedRegions[0]?.refName || '', 12) + 15
          : 0
      },
    }))
    .views(self => ({
      /**
       * #method
       * return the view menu items
       */
      menuItems(): MenuItem[] {
        return buildMenuItems(self as LinearGenomeViewModel)
      },
      /**
       * #getter
       * geometry of the overview scalebar — derived from displayedRegions,
       * width, and cytobandOffset so it stays cached by MobX
       */
      get overviewLayout(): ViewLayout {
        return createOverviewLayout({
          displayedRegions: self.displayedRegions,
          width: self.width - self.cytobandOffset,
          minimumBlockWidth: self.minimumBlockWidth,
        })
      },
      /**
       * #getter
       * bp-per-px scale used by overview tick labels
       */
      get overviewScale() {
        return self.totalBp / (self.width - self.cytobandOffset)
      },
    }))
    .views(self => {
      let currentlyCalculatedStaticBlocks: BlockSet | undefined
      let currentBlockKeys: string | undefined
      let coverageLeftPx = 0
      let coverageRightPx = 0
      let prevBpPerPx: number | undefined
      let prevWidth: number | undefined
      let prevMinimumBlockWidth: number | undefined
      let prevDisplayedRegions: typeof self.displayedRegions | undefined
      return {
        /**
         * #getter
         * static blocks are an important concept jbrowse uses to avoid
         * re-rendering when you scroll to the side. when you horizontally
         * scroll to the right, old blocks to the left may be removed, and new
         * blocks may be instantiated on the right. tracks may use the static
         * blocks to render their data for the region represented by the block
         */
        get staticBlocks() {
          const {
            offsetPx,
            bpPerPx,
            width,
            minimumBlockWidth,
            displayedRegions,
          } = self

          // Fast path: if only offsetPx changed and viewport is still within
          // the coverage range of existing blocks, skip the expensive
          // calculateStaticBlocks call entirely. minimumBlockWidth is read here
          // (not just in calculateStaticBlocks) so MobX still invalidates this
          // computed if it changes while the viewport stays within coverage.
          if (
            currentlyCalculatedStaticBlocks !== undefined &&
            bpPerPx === prevBpPerPx &&
            width === prevWidth &&
            minimumBlockWidth === prevMinimumBlockWidth &&
            displayedRegions === prevDisplayedRegions &&
            offsetPx >= coverageLeftPx &&
            offsetPx + width <= coverageRightPx
          ) {
            return currentlyCalculatedStaticBlocks
          }

          const newBlocks = calculateStaticBlocks(self)
          const newKeys = newBlocks.blocks.map(b => b.key).join(',')
          // minimumBlockWidth is part of the guard because block keys don't
          // encode ContentBlock-vs-ElidedBlock, so a region can flip type with
          // an unchanged key; without this the recompute would be discarded.
          if (
            currentlyCalculatedStaticBlocks === undefined ||
            currentBlockKeys !== newKeys ||
            bpPerPx !== prevBpPerPx ||
            width !== prevWidth ||
            minimumBlockWidth !== prevMinimumBlockWidth
          ) {
            currentlyCalculatedStaticBlocks = newBlocks
            currentBlockKeys = newKeys
          }

          // Update coverage range from content block extent only.
          // Using all blocks (including padding) would inflate the range
          // and let the fast path return stale blocks when the viewport
          // scrolls into the padding area where no content blocks exist.
          const cBlocks = currentlyCalculatedStaticBlocks.contentBlocks
          if (cBlocks.length > 0) {
            const last = cBlocks[cBlocks.length - 1]!
            coverageLeftPx = cBlocks[0]!.offsetPx
            coverageRightPx = last.offsetPx + last.widthPx
          }

          prevBpPerPx = bpPerPx
          prevWidth = width
          prevMinimumBlockWidth = minimumBlockWidth
          prevDisplayedRegions = displayedRegions
          return currentlyCalculatedStaticBlocks
        },
        /**
         * #getter
         * dynamic blocks represent the exact coordinates of the currently
         * visible genome regions on the screen. they are similar to static
         * blocks, but static blocks can go offscreen while dynamic blocks
         * represent exactly what is on screen
         */
        get dynamicBlocks() {
          return calculateDynamicBlocks(self)
        },
        /**
         * #getter
         * all overview scalebar blocks (content + elided), laid out on the
         * overviewLayout. memoized so the scalebar doesn't recompute it per
         * render
         */
        get overviewBlocks() {
          return calculateDynamicBlocks(self.overviewLayout).blocks
        },
        /**
         * #getter
         * leading/trailing pixel span of the visible content blocks projected
         * onto the overviewLayout — the geometry shared by the overview's "you
         * are here" rectangle and polygon
         */
        get overviewContentBlocksPxSpan() {
          return getContentBlocksPxSpan(
            self.overviewLayout,
            this.dynamicBlocks.contentBlocks,
          )
        },
        /**
         * #getter
         * Max right-edge pixel position for each displayedRegionIndex, derived
         * from staticBlocks geometry. staticBlocks caches a stable reference
         * when only offsetPx changes, so this getter is also stable during
         * normal scroll — avoiding a Map rebuild every frame.
         * Used by ScalebarRefNameLabels to clip chromosome name labels.
         */
        get scalebarRegionEndPx() {
          const m = new Map<number, number>()
          for (const block of this.staticBlocks.blocks) {
            if (
              block.type === 'ContentBlock' &&
              block.displayedRegionIndex !== undefined
            ) {
              const endPx = block.offsetPx + block.widthPx
              const cur = m.get(block.displayedRegionIndex)
              if (cur === undefined || endPx > cur) {
                m.set(block.displayedRegionIndex, endPx)
              }
            }
          }
          return m
        },
        /**
         * #getter
         * Gridline tick positions (x relative to the staticBlocks frame),
         * derived from staticBlocks + bpPerPx. Computed once and shared by every
         * Gridlines instance (scalebar, main view, each pinned track) rather
         * than recomputing the makeTicks loop per component.
         */
        get gridlineTicks() {
          const { bpPerPx } = self
          const blocks = this.staticBlocks.blocks
          const firstBlockOffset = blocks[0]?.offsetPx ?? 0
          const ticks: { x: number; major: boolean }[] = []
          for (const block of blocks) {
            if (block.type === 'ContentBlock') {
              const blockLeft = block.offsetPx - firstBlockOffset
              for (const { type, x } of makeBlockTicks(block, bpPerPx)) {
                if (x >= 0 && x <= block.widthPx) {
                  ticks.push({ x: blockLeft + x, major: type === 'major' })
                }
              }
            }
          }
          return ticks
        },
        /**
         * #getter
         * Integer-rounded sum of all visible block widths. Slightly less than
         * view.width when the genome ends before the right edge; use view.width
         * for SVG clip rects (display boundary) and this for paint canvas sizing
         * (actual content width).
         */
        get totalWidthPx(): number {
          return Math.round(this.dynamicBlocks.totalWidthPx)
        },
        /**
         * #getter
         * Like totalWidthPx but excluding inter-region boundary blocks. Used
         * when column layout divides the canvas width by feature count.
         */
        get totalWidthPxWithoutBorders(): number {
          return Math.round(this.dynamicBlocks.totalWidthPxWithoutBorders)
        },
        /**
         * #getter
         */
        get visibleBp() {
          return this.dynamicBlocks.totalBp
        },
        /**
         * #getter
         * rounded dynamic blocks are dynamic blocks without fractions of bp
         */
        get roundedDynamicBlocks() {
          return this.dynamicBlocks.contentBlocks.map(block => ({
            ...block,
            start: Math.floor(block.start),
            end: Math.ceil(block.end),
          }))
        },

        /**
         * #getter
         * Returns the currently visible content blocks with screen pixel
         * positions and displayedRegionIndex guaranteed.
         * Used by WebGL displays for per-region data fetching and rendering.
         */
        get visibleRegions() {
          return this.dynamicBlocks.contentBlocks.map(block => {
            const screenStartPx = block.offsetPx - self.offsetPx
            return {
              refName: block.refName,
              start: block.start,
              end: block.end,
              assemblyName: block.assemblyName,
              reversed: block.reversed,
              displayedRegionIndex: block.displayedRegionIndex!,
              screenStartPx,
              screenEndPx: screenStartPx + block.widthPx,
            }
          })
        },

        /**
         * #getter
         * visibleRegions expanded by a half-screen buffer on each side,
         * clamped to displayedRegion bounds, with integer-rounded coordinates.
         * Use this when fetching data that should extend slightly beyond the
         * viewport for smooth scrolling.
         */
        get bufferedVisibleRegions() {
          const bufferBp = Math.ceil(self.width * self.bpPerPx * 0.5)
          return this.visibleRegions.map(vr => {
            const dr = self.displayedRegions[vr.displayedRegionIndex]!
            return {
              region: {
                refName: vr.refName,
                start: Math.max(dr.start, Math.floor(vr.start) - bufferBp),
                end: Math.min(dr.end, Math.ceil(vr.end) + bufferBp),
                assemblyName: vr.assemblyName,
              },
              displayedRegionIndex: vr.displayedRegionIndex,
            }
          })
        },

        /**
         * #getter
         * a single "combo-locstring" representing all the regions visible on
         * the screen
         */
        get visibleLocStrings() {
          return calculateVisibleLocStrings(this.dynamicBlocks.contentBlocks)
        },

        /**
         * #getter
         * same as visibleLocStrings, but only updated every 500ms
         */
        get coarseVisibleLocStrings() {
          return calculateVisibleLocStrings(self.coarseDynamicBlocks)
        },

        /**
         * #getter
         */
        get coarseTotalBpDisplayStr() {
          return getBpDisplayStr(self.coarseTotalBp)
        },

        /**
         * #getter
         */
        get effectiveBpPerPx() {
          return self.bpPerPx
        },

        /**
         * #getter
         */
        get effectiveTotalBp() {
          return self.bpPerPx * self.width
        },

        /**
         * #getter
         */
        get effectiveTotalBpDisplayStr() {
          return getBpDisplayStr(this.effectiveTotalBp)
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       */
      setCoarseDynamicBlocks(blocks: BlockSet, bpPerPx: number) {
        self.coarseDynamicBlocks = blocks.contentBlocks
        self.coarseTotalBp = blocks.totalBp
        self.coarseBpPerPx = bpPerPx
      },
    }))
    .actions(self => ({
      /**
       * #action
       * offset is the base-pair-offset in the displayed region, index is the
       * index of the displayed region in the linear genome view
       *
       * @param start - object as `{start, end, offset, index}`
       * @param end - object as `{start, end, offset, index}`
       */
      moveTo(start?: BpOffset, end?: BpOffset) {
        moveTo(self, start, end)
      },

      /**
       * #action
       * Navigate to the given locstring, will change displayed regions if
       * needed, and wait for assemblies to be initialized
       *
       * @param input - e.g. "chr1:1-100", "chr1:1-100 chr2:1-100", "chr 1 100"
       * @param optAssemblyName - (optional) the assembly name to use when
       * navigating to the locstring
       * @param grow - optional multiplier to expand the region by (e.g., 0.2
       * adds 20% padding on each side)
       */
      async navToLocString(
        input: string,
        optAssemblyName?: string,
        grow?: number,
      ) {
        const { assemblyNames } = self
        const session = getSession(self)
        const { assemblyManager } = session
        const assemblyName = optAssemblyName || assemblyNames[0]!
        if (assemblyName) {
          await assemblyManager.waitForAssembly(assemblyName)
        }
        await handleSelectedRegion({
          input,
          assemblyName,
          grow,
          model: self as LinearGenomeViewModel,
        })
      },

      /**
       * #action
       * Similar to `navToLocString`, but accepts a list of parsed location
       * objects instead of a locstring. Will try to perform
       * `setDisplayedRegions` if changing regions
       *
       * @param regions - array of parsed location objects
       * @param assemblyName - optional assembly name
       * @param grow - optional multiplier to expand the region by (e.g., 0.2
       * adds 20% padding on each side)
       */
      async navToLocations(
        regions: ParsedLocString[],
        assemblyName?: string,
        grow?: number,
      ) {
        const { assemblyManager } = getSession(self)
        await when(() => self.volatileWidth !== undefined)

        // Generate locations from the parsed regions
        const locations = await generateLocations({
          regions,
          assemblyManager,
          assemblyName,
          grow,
        })

        // Handle single location case
        if (locations.length === 1) {
          const location = locations[0]!
          const { reversed, parentRegion, start, end } = location

          // Set the displayed region based on the parent region
          self.setDisplayedRegions([
            {
              reversed,
              ...parentRegion,
            },
          ])

          // Navigate to the specific coordinates within the region, clamping
          // into the parentRegion bounds. The lower bound is parentRegion.start
          // (not 0): the region we just displayed is parentRegion, so a start
          // below parentRegion.start would fail navTo's containment check when
          // the parentRegion doesn't begin at 0.
          this.navTo({
            ...location,
            start: clamp(
              start ?? parentRegion.start,
              parentRegion.start,
              parentRegion.end,
            ),
            end: clamp(
              end ?? parentRegion.end,
              parentRegion.start,
              parentRegion.end,
            ),
          })
        }
        // Handle multiple locations case
        else {
          self.setDisplayedRegions(
            locations.map(location => {
              const { start, end } = location
              return start === undefined || end === undefined
                ? location.parentRegion
                : {
                    ...location,
                    start,
                    end,
                  }
            }),
          )
          self.showAllRegions()
        }
      },

      /**
       * #action
       * Navigate to a location based on its refName and optionally start, end,
       * and assemblyName. Will not try to change displayed regions, use
       * `navToLocations` instead. Only navigates to a location if it is
       * entirely within a displayedRegion. Navigates to the first matching
       * location encountered.
       *
       * Throws an error if navigation was unsuccessful
       *
       * @param query - a proposed location to navigate to
       * @param grow - optional multiplier to expand the region by (e.g., 0.2
       * adds 20% padding on each side)
       */
      navTo(query: NavLocation, grow?: number) {
        this.navToMultiple([query], grow)
      },

      /**
       * #action
       * Navigate to a location based on its refName and optionally start, end,
       * and assemblyName. Will not try to change displayed regions, use
       * navToLocations instead. Only navigates to a location if it is entirely
       * within a displayedRegion. Navigates to the first matching location
       * encountered.
       *
       * Throws an error if navigation was unsuccessful
       *
       * @param locations - proposed location to navigate to
       * @param grow - optional multiplier to expand the region by (e.g., 0.2
       * adds 20% padding on each side)
       */
      navToMultiple(locations: NavLocation[], grow?: number) {
        if (
          locations.some(
            l =>
              l.start !== undefined && l.end !== undefined && l.start > l.end,
          )
        ) {
          throw new Error('found start greater than end')
        }

        const firstLocation = locations.at(0)
        const lastLocation = locations.at(-1)
        if (!firstLocation || !lastLocation) {
          return
        }

        const defaultAssemblyName = self.assemblyNames[0]!
        const { assemblyManager } = getSession(self)
        const { displayedRegions } = self
        // The range spans from the first location's left edge to the last
        // location's right edge (any locations in between are ignored).
        this.moveTo(
          resolveNavEndpoint({
            location: firstLocation,
            refName: navLocationRefName(
              assemblyManager,
              defaultAssemblyName,
              firstLocation,
            ),
            side: 'left',
            displayedRegions,
            grow,
          }),
          resolveNavEndpoint({
            location: lastLocation,
            refName: navLocationRefName(
              assemblyManager,
              defaultAssemblyName,
              lastLocation,
            ),
            side: 'right',
            displayedRegions,
            grow,
          }),
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Similar to `navToLocString`, but accepts a parsed location object
       * instead of a locstring. Will try to perform `setDisplayedRegions` if
       * changing regions
       *
       * @param parsedLocString - a parsed location object with refName, start,
       * end, etc.
       * @param assemblyName - optional assembly name
       * @param grow - optional multiplier to expand the region by (e.g., 0.2
       * adds 20% padding on each side)
       */
      async navToLocation(
        parsedLocString: ParsedLocString,
        assemblyName?: string,
        grow?: number,
      ) {
        return self.navToLocations([parsedLocString], assemblyName, grow)
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      rubberBandMenuItems(): MenuItem[] {
        return buildRubberBandMenuItems(self as LinearGenomeViewModel)
      },

      /**
       * #method
       */
      bpToPx({
        refName,
        coord,
        displayedRegionIndex,
      }: {
        refName: string
        coord: number
        displayedRegionIndex?: number
      }) {
        return bpToPx({ refName, coord, displayedRegionIndex, self })
      },

      /**
       * #method
       * Map a highlight or bookmark region to its pixel position+width inside
       * the tracks container. Falls back to the raw refName if the region's
       * assemblyName is missing or unknown so highlights authored without an
       * assembly still render in single-assembly views.
       */
      getHighlightCoords(region: {
        assemblyName?: string
        refName: string
        start: number
        end: number
      }) {
        const refName = resolveCanonicalRefName(self, region)
        return getLayoutHighlightCoords(self, { ...region, refName })
      },

      /**
       * #method
       * like getHighlightCoords but laid out against the overview scalebar and
       * shifted by the cytoband offset
       */
      getOverviewHighlightCoords(region: {
        assemblyName?: string
        refName: string
        start: number
        end: number
      }) {
        const refName = resolveCanonicalRefName(self, region)
        const coords = getLayoutHighlightCoords(self.overviewLayout, {
          ...region,
          refName,
        })
        return coords
          ? { ...coords, left: coords.left + self.cytobandOffset }
          : undefined
      },

      /**
       * #method
       * scrolls the view to center on the given bp. if that is not in any of
       * the displayed regions, does nothing
       *
       * @param coord - basepair at which you want to center the view
       * @param refName - refName of the displayedRegion you are centering at
       * @param displayedRegionIndex - index of the displayedRegion
       */
      centerAt(coord: number, refName: string, displayedRegionIndex?: number) {
        const centerPx = this.bpToPx({
          refName,
          coord,
          displayedRegionIndex,
        })
        if (centerPx !== undefined) {
          self.scrollTo(Math.round(centerPx.offsetPx - self.width / 2))
        }
      },

      /**
       * #method
       */
      pxToBp(px: number) {
        return pxToBp(self, px)
      },

      /**
       * #getter
       */
      get centerLineInfo() {
        return self.displayedRegions.length > 0
          ? this.pxToBp(self.width / 2)
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      rubberbandClickMenuItems(clickOffset: BpOffset): MenuItem[] {
        return buildRubberbandClickMenuItems(
          self as LinearGenomeViewModel,
          clickOffset,
        )
      },

      /**
       * #method
       * returns menu items for a highlight context menu. plugins can extend
       * this via Core-extendPluggableElement to add their own items
       */
      highlightMenuItems(_highlight: HighlightType): MenuItem[] {
        return []
      },
    }))
    .actions(self => ({
      afterCreate() {
        setupKeyboardHandler(self as LinearGenomeViewModel)
      },

      afterAttach() {
        doAfterAttach(self as LinearGenomeViewModel)
      },
    }))
    .preProcessSnapshot((snap: Record<string, unknown> | undefined) => {
      if (!snap) {
        return snap
      }
      // `trackLabels` was renamed to `trackLabelsOverride` (the bare
      // `trackLabels` is now the resolved getter); map legacy snapshots forward.
      const { highlight, trackLabels, ...rest } = snap
      return {
        highlight:
          Array.isArray(highlight) || highlight === undefined
            ? highlight
            : [highlight],
        ...(trackLabels ? { trackLabelsOverride: trackLabels } : {}),
        ...rest,
      }
    })
    .postProcessSnapshot(snap => {
      // init is transient launch state, never persisted. The remaining fields
      // are localStorage-backed: their strip baseline is the universal default
      // (hardcoded here), not the localStorage-derived creation default, so a
      // localStorage-set value stays portable across browsers.
      const {
        init,
        showCenterLine,
        showCytobandsSetting,
        trackLabelsOverride,
        colorByCDS,
        showTrackOutlines,
        scrollZoom,
        ...rest
      } = snap

      return {
        ...rest,
        // keep init until displayedRegions exist, so a snapshot taken before the
        // launch autorun navigates (e.g. autosave firing mid-load) can still
        // rebuild the view instead of dropping to the import form.
        // displayedRegions is stripDefault, so it's absent (not []) when empty —
        // the optional chain is runtime-necessary despite the non-nullish type.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        ...(init && !snap.displayedRegions?.length ? { init } : {}),
        ...(showCenterLine ? { showCenterLine } : {}),
        ...(!showCytobandsSetting ? { showCytobandsSetting } : {}),
        ...(trackLabelsOverride ? { trackLabelsOverride } : {}),
        ...(colorByCDS ? { colorByCDS } : {}),
        ...(!showTrackOutlines ? { showTrackOutlines } : {}),
        ...(scrollZoom ? { scrollZoom } : {}),
      }
    })
}

export type LinearGenomeViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearGenomeViewModel = Instance<LinearGenomeViewStateModel>
