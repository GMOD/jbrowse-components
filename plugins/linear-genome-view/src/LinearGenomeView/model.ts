import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import {
  BaseViewModel,
  HighlightsMixin,
} from '@jbrowse/core/pluggableElementTypes/models'
import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import {
  assembleLocString,
  clamp,
  getBpDisplayStr,
  getDialogHost,
  getSession,
  getTickDisplayStr,
  isSessionModelWithWidgets,
  localStorageGetBoolean,
  localStorageGetItem,
  springAnimate,
  sum,
} from '@jbrowse/core/util'
import {
  bpToLinearBp,
  bpToPx,
  computeMoveToLayout,
  createOverviewLayout,
  getLayoutHighlightCoords,
  getOverviewRegionPxSpan,
  moveTo,
  pxToBp,
} from '@jbrowse/core/util/Base1DUtils'
import { wholeBaseRegions } from '@jbrowse/core/util/blockTypes'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import calculateStaticBlocks from '@jbrowse/core/util/calculateStaticBlocks'
import { tickLabelsWorthDrawing } from '@jbrowse/core/util/tickLabels'
import {
  hideTrackGeneric,
  launchToggleTrackGeneric,
  launchTrackGeneric,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import {
  assemblyErrorMessage,
  computeViewStatus,
} from '@jbrowse/core/util/viewStatus'
import {
  pendingLaunch,
  withLaunchInput,
} from '@jbrowse/core/util/withLaunchInput'
import { contentRightEdgePx } from '@jbrowse/display-kit/regionHost'
import {
  cast,
  getParent,
  hasParent,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import { observable, when } from 'mobx'

import { handleSelectedRegion } from '../searchUtils.ts'
import { doAfterAttach } from './afterAttach.ts'
import { shouldSwapTracks } from './components/util.ts'
import {
  HEADER_BAR_HEIGHT,
  HEADER_OVERVIEW_HEIGHT,
  MIN_BP_PER_PX,
  MINIMIZED_TRACK_HEIGHT,
  RESIZE_HANDLE_HEIGHT,
  SCALE_BAR_HEIGHT,
  SHOW_ALL_REGIONS_FILL,
  TRACK_OUTLINE_BORDER,
  TRACK_TOP_GAP,
} from './consts.ts'
import { planFlight } from './flyTo.ts'
import { setupKeyboardHandler } from './keyboardHandler.ts'
import { lgvLaunchKeys } from './launchKeys.ts'
import {
  buildMenuItems,
  buildRubberBandMenuItems,
  buildRubberbandClickMenuItems,
} from './menuItems.ts'
import { sharedScaleContainerOf } from './sharedScaleContainer.ts'
import {
  calculateVisibleLocStrings,
  cytobandLabelGutterWidth,
  expandRegion,
  fitAllRegionsWindow,
  generateLocations,
  getScalebarRefNameLabels,
  regionsOrientation,
  groupContiguousBlocks,
  labelFitsInBlock,
  makeBlockTicks,
  runRefNameLabelPx,
  tickLabelWidth,
} from './util.ts'

import type { FlightViewport } from './flyTo.ts'
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
import type { ViewStatus } from '@jbrowse/core/util/viewStatus'
import type { LaunchInput } from '@jbrowse/core/util/withLaunchInput'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

// lazies
const SearchResultsDialog = lazy(
  () => import('./components/SearchResultsDialog.tsx'),
)

/** One span of the row that is not track data — see `paddingSpans`. */
export interface PaddingSpan {
  key: string
  x: number
  width: number
  kind: 'seam' | 'elided' | 'boundary'
}

// The one array `paddingSpans` returns when a view has nothing to mask, so that
// computed's value repeats by identity. Frozen because every consumer maps over
// it and a caller that sorted in place would do so for the whole session.
const NO_PADDING_SPANS = Object.freeze([]) as readonly PaddingSpan[]

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
  return asm?.getCanonicalRefName2(region.refName) ?? region.refName
}

// bpPerPx deltas smaller than this are treated as no zoom change, avoiding
// pointless offset re-anchoring on micro-steps
const BP_PER_PX_EPSILON = 0.000001

// px of the rightmost content kept on-screen at max scroll-right, so the genome
// can't be scrolled entirely off the left edge. Shared by maxOffset and
// getSelectedRegions' clamp so the two bounds can't drift apart.
const MAX_OFFSET_PADDING_PX = 10

// px of the leftmost content kept on-screen at max scroll-left, mirroring
// MAX_OFFSET_PADDING_PX at the other end
const MIN_OFFSET_PADDING_PX = 30

// whether two BlockSets cover the same blocks, by key and in order
function sameBlockKeys(a: BlockSet, b: BlockSet) {
  return (
    a.blocks.length === b.blocks.length &&
    a.blocks.every((block, i) => block.key === b.blocks[i]!.key)
  )
}

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
      ?.getCanonicalRefName2(location.refName) || location.refName
  )
}

/**
 * Resolve one end of a navigation range to the displayedRegion index that
 * contains it plus the bp offset into that region. `side` selects which edge of
 * the (grow-expanded) interval anchors the offset — 'left' for the range start,
 * 'right' for the range end — accounting for reversed regions. Omitted
 * start/end default to the first occurrence of the refName; containment is then
 * resolved against those raw coords, and only the region it picks bounds `grow`.
 */
function resolveNavEndpoint({
  location,
  assemblyManager,
  defaultAssemblyName,
  side,
  displayedRegions,
  grow,
}: {
  location: NavLocation
  assemblyManager: AssemblyManager
  defaultAssemblyName: string
  side: 'left' | 'right'
  displayedRegions: Region[]
  grow?: number
}) {
  const refName = navLocationRefName(
    assemblyManager,
    defaultAssemblyName,
    location,
  )
  const first = displayedRegions.find(r => r.refName === refName)
  if (!first) {
    throw new Error(`could not find a region with refName "${refName}"`)
  }
  const rawStart = location.start ?? first.start
  const rawEnd = location.end ?? first.end
  const index = displayedRegions.findIndex(
    r =>
      r.refName === refName &&
      rawStart >= r.start &&
      rawStart <= r.end &&
      rawEnd <= r.end &&
      rawEnd >= r.start,
  )
  if (index === -1) {
    throw new Error(
      `could not find a region that contained "${assembleLocString(location)}"`,
    )
  }
  const r = displayedRegions[index]!
  // grow AFTER resolving the containing region, and clamp to that region — not
  // to the first occurrence of the refName. Growing first clamped the padded
  // interval to a region that need not be the one containing it, so on a
  // duplicated refName (collapsed introns, a refName displayed twice) the
  // clamp dragged an endpoint back to the wrong region and the containment
  // search below then found nothing: `navTo(loc)` succeeded where
  // `navTo(loc, 0.2)` threw for the very same loc.
  const { start, end } = grow
    ? expandRegion(rawStart, rawEnd, grow, r.start, r.end)
    : { start: rawStart, end: rawEnd }
  const leftEdge = r.reversed ? r.end - end : start - r.start
  const rightEdge = r.reversed ? r.end - start : end - r.start
  return { index, offset: side === 'left' ? leftEdge : rightEdge }
}

// Widget id of the hierarchical track selector. One id, shared by the two
// helpers below, since `isTrackSelectorVisible` identifies the widget by id
// rather than by holding a reference to it.
const TRACK_SELECTOR_WIDGET_ID = 'hierarchicalTrackSelector'

/**
 * Add (or reuse) the hierarchical track-selector widget for this view. Returns
 * the widget alongside the (narrowed) session so callers can show/hide it.
 */
function openTrackSelectorWidget(self: IAnyStateTreeNode) {
  const session = getSession(self)
  if (isSessionModelWithWidgets(session)) {
    const selector = session.addWidget(
      'HierarchicalTrackSelectorWidget',
      TRACK_SELECTOR_WIDGET_ID,
      { view: self },
    )
    return { session, selector }
  }
  throw new Error('session does not support widgets')
}

/**
 * Whether the track selector is the drawer widget on screen right now. One
 * spelling for the `isTrackSelectorOpen` getter (which lights up the header
 * button) and for `toggleTrackSelector` (which decides hide-vs-show) — the
 * `!minimized` term is exactly the kind of thing that goes into one of two
 * hand-written copies and not the other.
 */
function isTrackSelectorVisible(self: IAnyStateTreeNode) {
  const session = getSession(self)
  return (
    isSessionModelWithWidgets(session) &&
    session.visibleWidget?.id === TRACK_SELECTOR_WIDGET_ID &&
    !session.minimized
  )
}

/**
 * #stateModel LinearGenomeView
 * #category view
 *
 * #example
 * A `LinearGenomeView` is what you hand-author under `defaultSession.views`, and
 * every setting goes directly on the view object. `assembly`/`loc` fill in
 * `displayedRegions`/`bpPerPx`/`offsetPx` for you:
 * ```js
 * defaultSession: {
 *   name: 'My session',
 *   views: [
 *     {
 *       type: 'LinearGenomeView',
 *       colorByCDS: true,
 *       assembly: 'hg38',
 *       loc: 'chr1:1,000,000-1,100,000',
 *       tracks: ['genes', 'alignments'],
 *     },
 *   ],
 * }
 * ```
 * `assembly`, `loc`, `tracks`, `tracklist`, `nav` and `highlight` need
 * on-attach resolution and are captured into the `launch` property below;
 * `colorByCDS`, `showAminoAcids`, `showCenterLine`, `trackLabels` and
 * `showHighlightChips` are plain view props MST restores natively. Both are
 * written the same way.
 * At runtime the same model is driven imperatively — every property and action
 * below is reachable on `viewState.session.views[0]`:
 * ```js
 * const view = viewState.session.views[0]
 * await view.navToLocString('chr1:2,000,000-2,100,000')
 * view.showTrack('alignments')
 * view.zoomTo(view.bpPerPx * 2) // zoom out 2x
 * ```
 */
export function stateModelFactory(pluginManager: PluginManager) {
  const model = types
    .compose(
      'LinearGenomeView',
      BaseViewModel,
      HighlightsMixin(),
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
         * Left edge of the viewport, in linearized bp — the concatenated
         * `displayedRegions` space that `offsetPx` indexes, which carries no
         * inter-region padding, so the two differ only by `bpPerPx`. May be
         * negative, which is the view scrolled past the left end.
         *
         * The viewport is stored as the genomic WINDOW it frames rather than as
         * the pixels that framed it, because pixels mean nothing without the
         * width they were measured at and a snapshot does not carry one. Storing
         * them anyway is why a session authored in a 1000px window used to open
         * at 500px showing half the region its author was looking at, while the
         * same location as a `&loc=` opened correctly — the two ways to share a
         * view disagreed, and only the one that stores intent was right.
         */
        windowStartBp: types.stripDefault(types.number, 0),

        /**
         * #property
         * Width of the viewport in bp. Zero means "not established yet": no
         * width has been measured, so there is nothing to divide by. The first
         * measure fills it in, and `bpPerPx` is `windowWidthBp / width` from
         * then on.
         */
        windowWidthBp: types.stripDefault(types.number, 0),

        /**
         * #property
         * MIGRATION ONLY, and safe to delete once pre-window sessions are no
         * longer in circulation.
         *
         * A snapshot written before the window was stored carries `offsetPx` and
         * `bpPerPx` but not the width they were measured at, so the window they
         * framed cannot be recovered. `windowStartBp` can (it is
         * `offsetPx * bpPerPx`, no width needed); the width in bp cannot. This
         * carries the old `bpPerPx` to the first measure, which adopts it at
         * whatever width arrives — exactly what the old code did — and clears
         * this. So an old link keeps its old behavior rather than being
         * reinterpreted, and everything authored since restores its window.
         */
        legacyBpPerPx: types.stripDefault(types.number, 0),

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
         * drop the header bar entirely — location box, navigation buttons and
         * overview
         */
        hideHeader: types.stripDefault(types.boolean, false),

        /**
         * #property
         * keep the header, drop the whole-chromosome overview strip below it
         */
        hideHeaderOverview: types.stripDefault(types.boolean, false),

        /**
         * #property
         * suppress the "No tracks active" placeholder, for an embed that opens
         * with no tracks on purpose
         */
        hideNoTracksActive: types.stripDefault(types.boolean, false),

        /**
         * #property
         * vestigial: the hierarchical selector is the only one that exists, so
         * this value is ignored. Retained because saved sessions and configs
         * persist it.
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
         * whether to show the "cytobands" in the overview scale bar (the
         * resolved, capability-gated value is the `effectiveShowCytobands`
         * getter)
         */
        showCytobands: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-showCytobands', true),
        ),

        /**
         * #property
         * how to display the track labels, can be "overlapping", "offset", or
         * "hidden", or empty string "" (which results in the
         * LinearGenomeViewPlugin config default being used). the resolved value
         * is the `effectiveTrackLabels` getter. see LinearGenomeViewPlugin
         * https://jbrowse.org/jb2/docs/config/lineargenomeviewplugin/ docs for
         * how conf is used
         */
        trackLabels: types.optional(
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
         * controls whether highlight/bookmark chip labels are shown inline
         */
        labelsVisible: types.stripDefault(types.boolean, true),

        /**
         * #property
         * color CDS segments by reading frame
         */
        colorByCDS: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-colorByCDS', false),
        ),

        /**
         * #property
         * draw translated codons on coding features once zoomed in far enough:
         * an alternating per-codon shading, and the amino acid letters on top of
         * it at base-level zoom. Independent of `colorByCDS`, which only recolors
         * the segments by frame.
         */
        showAminoAcids: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-showAminoAcids', true),
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
         * when true, only the header and coordinate scalebar are rendered
         */
        scalebarOnly: types.stripDefault(types.boolean, false),
        /**
         * #property
         * transient launch state: the settings written on the view object that
         * need resolving before they can be view state — an assembly, a
         * location, track recipes, highlights. `preProcessSnapshot` moves them
         * here off the snapshot, the afterAttach autorun applies them and
         * clears this, so a saved session never retains it. Not written by
         * hand: author every setting directly on the view.
         */
        launch: types.frozen<LaunchInput<InitState> | undefined>(),
      }),
    )
    .volatile(() => {
      // typed locals so `unknown`/`Record` aren't narrowed to `undefined`/`{}`; inline
      // type assertions here get stripped by no-unnecessary-type-assertion
      const volatileError: unknown = undefined
      return {
        /**
         * #volatile
         * Height of each track's in-flow label band, measured by
         * TrackContainer as the rendering container's offset inside its Paper.
         * Absent (0) while the label is hidden, overlapping, or not yet
         * measured. Observable, so the offset and height getters re-derive
         * when a band changes.
         */
        trackLabelBands: observable.map<string, number>(),
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
        coarseDynamicBlocks: [] as ContentBlock[],
        /**
         * #volatile
         */
        coarseTotalBp: 0,
        /**
         * #volatile
         */
        // A real scale rather than the not-yet-measured 0, for the canvas
        // displays that lay out against it; `setWidth` seeds the true one at
        // the first measure.
        coarseBpPerPx: 1,
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
      // The viewport in pixels, derived from the window it frames — declared
      // ahead of every other getter so that the ~300 reads of `self.bpPerPx` /
      // `self.offsetPx` across the codebase go on resolving by name. Only the
      // writes had to move, and they are six actions below.
      /**
       * #getter
       * the launch state that still has something to apply — the gate every
       * loading and error path below reads.
       */
      get pendingLaunch() {
        return pendingLaunch(self.launch)
      },
      /**
       * #getter
       * corresponds roughly to the zoom level, base-pairs per pixel.
       *
       * Zero before a width is measured, which is the same not-yet-measured
       * sentinel `Base1DView` uses and which `displayedRegionsTotalPx` and the
       * offset getters already guard for. Reads `volatileWidth` rather than the
       * `width` getter on purpose: that one throws when unmeasured, and these
       * are read from the first render.
       */
      get bpPerPx() {
        const width = self.volatileWidth
        return width === undefined || width <= 0 || self.windowWidthBp <= 0
          ? 0
          : self.windowWidthBp / width
      },
      /**
       * #getter
       * corresponds roughly to the horizontal scroll of the LGV
       */
      get offsetPx() {
        const { bpPerPx } = this
        return bpPerPx <= 0 ? 0 : self.windowStartBp / bpPerPx
      },
      /**
       * #getter
       * scroll-to-zoom is a global, personal preference resolved from the
       * session; toggling it in any view applies everywhere
       */
      get scrollZoom() {
        return getSession(self).scrollZoom
      },
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
       * the effective track labels setting, resolving the stored `trackLabels`
       * against the LinearGenomeViewPlugin config default
       */
      get effectiveTrackLabels() {
        const sessionSetting = getConf(getSession(self), [
          'LinearGenomeViewPlugin',
          'trackLabels',
        ])
        return self.trackLabels || sessionSetting
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
        // `=== true` rather than a session guard: the member is optional on
        // AbstractSessionModel, and a session with no such notion (the embedded
        // products) should read as "don't pin", which is what absent gives.
        // Tested before isTopLevelView, the order the guard used to impose — a
        // session without the preference is also the one least likely to have
        // anything useful behind `views`, and there is no reason to walk it
        return (
          getSession(self).stickyViewHeaders === true && this.isTopLevelView
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Assembly-name prefix for the scalebar refName labels, or undefined for
       * none. A container view (e.g. LinearSyntenyView) opts its sub-views in by
       * exposing showAssemblyNameInSubviewScalebar; duck-typed rather than
       * matching a concrete view type so no upward plugin dependency is needed
       * and any container can opt in. A wrong nesting depth simply yields no
       * prefix — hence the hasParent guard, since getParent throws (rather than
       * returning undefined) when the view sits shallower than depth 2.
       */
      get scalebarDisplayPrefix() {
        const parent = hasParent(self, 2)
          ? getParent<{ showAssemblyNameInSubviewScalebar?: boolean }>(self, 2)
          : undefined
        return parent?.showAssemblyNameInSubviewScalebar
          ? self.assemblyDisplayNames[0]
          : undefined
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
        return assemblyErrorMessage(assemblyManager, self.assemblyNames)
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
       * the assembly named by a pending `init`, or undefined when no init is
       * set. `init`'s assembly isn't in `assemblyNames` yet (that derives from
       * displayedRegions, still empty pre-navigation), so init-phase readiness
       * and error checks resolve it directly through here.
       */
      get initAssembly() {
        return self.pendingLaunch
          ? getSession(self).assemblyManager.get(self.pendingLaunch.assembly)
          : undefined
      },

      /**
       * #getter
       */
      get initialized() {
        if (self.volatileWidth === undefined) {
          return false
        }
        // if init is set, wait for that assembly to have regions loaded
        if (self.pendingLaunch) {
          const asm = this.initAssembly
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
       * The assembly whose load the spinner is waiting on: the one `init` names
       * before navigation (it isn't in assemblyNames yet), else the first of the
       * displayed assemblies that hasn't finished loading.
       */
      get loadingAssembly() {
        return self.pendingLaunch
          ? this.initAssembly
          : getSession(self).assemblyManager.loadingAssembly(self.assemblyNames)
      },

      /**
       * #getter
       * What the spinner says. The assembly reports which of its files it is
       * downloading, so this is "Downloading chromosome aliases" rather than a bare
       * "Loading" for the part of startup that actually takes time. Falls back
       * once the assembly is loaded and the remaining wait is the init autorun's
       * own navigation, which is local.
       */
      get loadingMessage() {
        return this.showLoading
          ? this.loadingAssembly?.statusMessage || 'Loading'
          : undefined
      },

      /**
       * #getter
       * Determinate fraction for the spinner's bar, when the assembly load
       * reports one (a whole-file download with a Content-Length)
       */
      get loadingProgress() {
        return this.showLoading
          ? this.loadingAssembly?.statusProgress
          : undefined
      },

      /**
       * #getter
       * The URL the assembly load is currently fetching, when the phase named
       * one. Only the stalled-load notice reads it — see
       * {@link ViewLoadingScreen}.
       */
      get loadingSource() {
        return this.showLoading ? this.loadingAssembly?.statusSource : undefined
      },

      /**
       * #getter
       */
      get hasSomethingToShow() {
        return this.hasDisplayedRegions || !!self.pendingLaunch
      },

      /**
       * #getter
       * init is set but its async navigation (the afterAttach autorun) hasn't
       * populated displayedRegions yet. `initialized` can already be true here
       * (it only tracks assembly readiness), so without this the container
       * would mount over empty regions and pxToBp/hover would throw.
       *
       * **Not dotplot's or synteny's `initPending`**, which is the bare
       * `!!self.pendingLaunch` — "an init blob has not been applied" — and which those
       * views read from their `settled` gate rather than from `showLoading`.
       * This one is narrower on purpose: it closes only the window where there
       * is nothing on screen. Once navigation has produced regions the view is
       * usable and gets shown, even though `init` is still set while the tracks
       * and highlights land. Renamed away from the shared spelling because the
       * two predicates disagree exactly there, and the bare name reads as
       * theirs.
       */
      get awaitingInitNavigation() {
        return !!self.pendingLaunch && !this.hasDisplayedRegions
      },

      /**
       * #getter
       * Whether to show a loading indicator instead of the import form or view
       */
      get showLoading() {
        return (
          this.hasSomethingToShow &&
          !this.error &&
          (!this.initialized || this.awaitingInitNavigation)
        )
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
       * Is there anything to draw yet? The gate anything reading block geometry
       * — a ruler, a scalebar, a display — has to pass first, because
       * `width`/`staticBlocks` throw by design before the view has been
       * measured and navigated.
       *
       * **Not `initialized`**, which is the trap this getter exists to close.
       * That one answers "have the assembly's regions loaded", which is only
       * the first of two async steps: navigating then populates
       * `displayedRegions`, and in the window between the two `initialized` is
       * already true while there is still nothing on screen. `showLoading`
       * folds in `awaitingInitNavigation`, the getter that exists for exactly
       * that gap.
       *
       * `error` is the third outcome and is why this is not a bare
       * `!showLoading`: a failed assembly load also ends the loading state, so
       * that alone would mount over the wreckage. Read `error` yourself if you
       * want to draw it.
       */
      get ready() {
        return !this.showLoading && !this.error
      },

      /**
       * #getter
       * The same question as `ready` with the other three outcomes named, for a
       * host that draws its own chrome and has to render all four. See
       * `computeViewStatus`, whose precedence this defers to — and note its
       * `ready` is narrower than the getter above, which is true when nothing
       * has told the view where to look.
       */
      get status(): ViewStatus {
        return computeViewStatus({
          error: this.error,
          hasSomethingToShow: this.hasSomethingToShow,
          loading: () =>
            this.showLoading
              ? {
                  message: this.loadingMessage ?? 'Loading',
                  progress: this.loadingProgress,
                }
              : undefined,
        })
      },

      /**
       * #getter
       */
      get scalebarHeight() {
        return SCALE_BAR_HEIGHT
      },

      /**
       * #getter
       * What TrackContainer puts *above* a track's rendering container: the gap
       * over its Paper, and the Paper's own top border when outlines are on.
       */
      get trackLeadingChrome() {
        return (
          TRACK_TOP_GAP + (self.showTrackOutlines ? TRACK_OUTLINE_BORDER : 0)
        )
      },

      /**
       * #getter
       * ...and what it puts below: the resize divider, plus the matching bottom
       * border.
       */
      get trackTrailingChrome() {
        return (
          RESIZE_HANDLE_HEIGHT +
          (self.showTrackOutlines ? TRACK_OUTLINE_BORDER : 0)
        )
      },

      /**
       * #getter
       * A track's full cost beyond its display height.
       *
       * The track *label* is not counted here: an offset label is an in-flow
       * box whose height is whatever the theme renders a Paper of icon buttons
       * at, so it is measured into `trackLabelBands` per track and added by
       * `trackLabelBand` rather than derived.
       */
      get trackChromeHeight() {
        return this.trackLeadingChrome + this.trackTrailingChrome
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
       * Where the scalebar pins when the view's chrome is sticky: everything
       * stacked above it, which is the view's own title bar plus this view's
       * header. Expressed from `headerHeight` rather than re-summing its
       * constants — the two are the same box, and a second spelling of the sum
       * is free to drift from the first while both typecheck.
       */
      get rubberbandTop() {
        return self.stickyViewHeaders
          ? VIEW_HEADER_HEIGHT + this.headerHeight
          : 0
      },

      /**
       * #getter
       */
      get pinnedTracksTop() {
        return this.rubberbandTop + this.scalebarHeight
      },

      /**
       * #method
       * rendered height of a single track, collapsing to a fixed height when
       * minimized. Shared by trackHeights and getTrackYOffset so the two can't
       * disagree. Reads `activeDisplay` — the display TrackContainer actually
       * mounts — rather than re-picking `displays[0]`, so the view's height math
       * can't diverge from what is on screen.
       */
      trackHeight(track: (typeof self.tracks)[number]) {
        return track.minimized
          ? MINIMIZED_TRACK_HEIGHT
          : track.activeDisplay.height
      },

      /**
       * #method
       * the measured in-flow label band above a track's rendering container,
       * 0 until TrackContainer has measured one or when no label is in flow
       */
      trackLabelBand(track: (typeof self.tracks)[number]) {
        return self.trackLabelBands.get(track.configuration.trackId) ?? 0
      },

      /**
       * #getter
       */
      get trackHeights() {
        return sum(self.tracks.map(t => this.trackHeight(t)))
      },

      /**
       * #getter
       */
      get trackHeightsWithChrome() {
        return (
          this.trackHeights +
          self.tracks.length * this.trackChromeHeight +
          sum(self.tracks.map(t => this.trackLabelBand(t)))
        )
      },

      /**
       * #getter
       */
      get height() {
        if (self.scalebarOnly) {
          return this.headerHeight + this.scalebarHeight
        }
        return (
          this.trackHeightsWithChrome + this.headerHeight + this.scalebarHeight
        )
      },

      /**
       * #method
       * Y offset (in pixels, from the top of the view) where a track's
       * rendering container starts. Walks tracks in DOM render order (pinned
       * first, then unpinned), from the same constants TrackContainer lays its
       * Paper out with. Returns `undefined` if the track is not present.
       *
       * Includes each track's measured label band, this track's own included,
       * since an in-flow label sits above the rendering container inside the
       * same Paper. Exact once TrackContainer has measured; before that it is
       * short by the unmeasured bands.
       */
      getTrackYOffset(trackId: string) {
        let y =
          this.headerHeight + this.scalebarHeight + this.trackLeadingChrome
        for (const t of [...self.pinnedTracks, ...self.unpinnedTracks]) {
          y += this.trackLabelBand(t)
          if (t.configuration.trackId === trackId) {
            return y
          }
          y += this.trackHeight(t) + this.trackChromeHeight
        }
        return undefined
      },

      /**
       * #method
       * the pinned or unpinned sibling list a track renders within; move
       * up/down/top/bottom reorder inside this section rather than the full
       * `tracks` array, since the two sections lay out independently
       */
      trackSection(id: string) {
        return self.tracks.find(t => t.id === id)?.pinned
          ? self.pinnedTracks
          : self.unpinnedTracks
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
      get fitBpPerPx() {
        if (this.totalBp === 0 || self.width === 0) {
          return 1
        }
        // Floor at minBpPerPx so tiny displayed regions (totalBp small enough
        // that the fill-scaled ratio drops below MIN_BP_PER_PX) can't produce
        // maxBpPerPx < minBpPerPx, which would invert the zoom-slider bounds
        // and the clamp() range in zoomTo.
        return Math.max(
          MIN_BP_PER_PX,
          this.totalBp / (self.width * SHOW_ALL_REGIONS_FILL),
        )
      },

      /**
       * #getter
       * The zoom-out limit. This view's own fit, except while a container holds
       * it on a shared scale coarser than that — a small genome next to a large
       * one, drawn short so the two compare by length.
       *
       * Raising the LIMIT is what makes such a scale survive: written past the
       * limit instead, it is undone by the first thing that clamps — a wheel
       * tick, a rubberband, a `setDisplayedRegions` — which is how the dotplot's
       * locked aspect ratio once turned "zoom out" into a zoom in
       * (`axisMaxBpPerPx`). Here every route to a zoom clamps against the same
       * ceiling, so full zoom-out LANDS on the shared scale.
       */
      get maxBpPerPx() {
        return Math.max(this.fitBpPerPx, this.sharedFitBpPerPx)
      },

      /**
       * #getter
       * The zoom-out ceiling a containing comparative view holds this row to,
       * or 0 for a standalone view, a mode that is off, and a stack that cannot
       * answer yet.
       *
       * Pulled rather than pushed down into a volatile: the number is a
       * function of every row's fit, all of which move on a resize, and a
       * stored copy would be stale by the next layout.
       */
      get sharedFitBpPerPx() {
        const fit = sharedScaleContainerOf(self)?.sharedFit
        return fit?.answered ? fit.bpPerPx : 0
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
        if (self.pendingLaunch) {
          // `assembly` is required by InitState, but init is a frozen blob and
          // hand-authored JSON is what fills it, so the type is not a guarantee.
          // Naming the authoring mistake beats the downstream symptom, which is
          // the literal string "Assembly undefined not found".
          if (!self.pendingLaunch.assembly) {
            return 'LinearGenomeView init needs an "assembly"'
          }
          const asm = this.initAssembly
          if (!asm) {
            return `Assembly ${self.pendingLaunch.assembly} not found`
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
        return this.displayedRegionsTotalPx - MAX_OFFSET_PADDING_PX
      },

      /**
       * #getter
       */
      get minOffset() {
        // objectively determined to keep the linear genome on the main screen
        return -self.width + MIN_OFFSET_PADDING_PX
      },

      /**
       * #getter
       * Whether the displayed regions read left-to-right, right-to-left, or
       * some of each. `horizontallyFlip` reverses the order and flips every
       * region at once, so a flipped row is uniformly `reversed` and `mixed`
       * takes going out of your way — the scalebar label menu's per-region
       * "Reverse region". Read off `displayedRegions` rather than off blocks
       * because blocks cover the window and this is a fact about the row.
       */
      get displayedRegionsOrientation() {
        return regionsOrientation(self.displayedRegions)
      },

      /**
       * #getter
       */
      get displayedRegionsTotalPx() {
        return self.bpPerPx === 0 ? 0 : this.totalBp / self.bpPerPx
      },

      /**
       * #getter
       */
      get trackMap() {
        const map = new Map<string, (typeof self.tracks)[number]>()
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
        getSession(self).setScrollZoom(flag)
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
      setShowAminoAcids(flag: boolean) {
        self.showAminoAcids = flag
      },
      /**
       * #action
       */
      setShowCytobands(flag: boolean) {
        self.showCytobands = flag
      },
      /**
       * #action
       */
      // A resize needs no arithmetic: the window is what is stored, so a new
      // width simply divides into it and `bpPerPx` follows. The view keeps the
      // sequence it was framing rather than letting the right edge eat into it.
      //
      // Keeping the scale instead — which is what storing pixels amounted to —
      // was a block-cache optimization: block boundaries are
      // `blockNum * ceil(800 * bpPerPx)` and block keys embed start/end, so
      // holding bpPerPx across a resize kept every block key, and so every
      // fetched region, identical. Rescaling makes a resize a zoom, and a zoom
      // is already a solved case: FetchVisibleRegions' 300ms debounce coalesces
      // the gesture into one refetch, its in-flight guard caps concurrent
      // batches at one, and rpcDataMap is overwritten in place rather than
      // cleared, so nothing blanks (ADR-008, ADR-006).
      setTrackLabelBand(trackId: string, band: number) {
        if (band === 0) {
          self.trackLabelBands.delete(trackId)
        } else {
          self.trackLabelBands.set(trackId, band)
        }
      },

      setWidth(newWidth: number) {
        const unmeasured = self.bpPerPx <= 0
        self.volatileWidth = newWidth
        if (newWidth > 0 && self.windowWidthBp <= 0) {
          // First measure, and nothing has established a window yet: a migrated
          // snapshot names the bpPerPx it was written with (see legacyBpPerPx),
          // and a view with no viewport at all takes the historical default of
          // 1. From here the window is the state and every later width divides
          // into it.
          self.windowWidthBp = (self.legacyBpPerPx || 1) * newWidth
          self.legacyBpPerPx = 0
        }
        if (unmeasured && self.bpPerPx > 0) {
          // The debounced coarse autorun is 500ms out; a restored snapshot's
          // consumers would lay out and fetch at 1 bp/px until then.
          self.coarseBpPerPx = self.bpPerPx
        }
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
        self.windowStartBp = newOffsetPx * self.bpPerPx
        return newOffsetPx
      },

      /**
       * #action
       * `scrollTo`'s bp-space twin: place the window's left edge at a
       * linearized bp coordinate, clamped to the same scroll limits.
       *
       * It exists so a caller that already knows where it wants to be in bp —
       * zoomTo, anchoring the base under the cursor — does not have to convert
       * to pixels and let this convert back. That round trip is lossy once per
       * frame, and a scroll-zoom burst is a few dozen frames, which is enough
       * to walk the base out from under the cursor.
       */
      scrollToBp(startBp: number) {
        const { bpPerPx } = self
        if (bpPerPx > 0) {
          self.windowStartBp = clamp(
            startBp,
            self.minOffset * bpPerPx,
            self.maxOffset * bpPerPx,
          )
        }
        return self.windowStartBp
      },

      /**
       * #action
       */
      zoomTo(bpPerPx: number, offset = self.width / 2) {
        const newBpPerPx = clamp(bpPerPx, self.minBpPerPx, self.maxBpPerPx)
        const oldBpPerPx = self.bpPerPx
        if (Math.abs(oldBpPerPx - newBpPerPx) >= BP_PER_PX_EPSILON) {
          // Anchor the base under the cursor. The window is stored in bp, so
          // this is exact arithmetic in the units the state is already in: the
          // cursor sits at `windowStartBp + offset * oldBpPerPx` before the
          // zoom, and must sit at the same base `offset` pixels in after it.
          //
          // Neither conversion to pixels nor rounding appears, and that is the
          // point — either one loses a fraction of a pixel per frame, which at
          // high bpPerPx is a real number of bases, and a scroll-zoom burst is
          // dozens of frames of it compounding.
          const anchorBp = self.windowStartBp + offset * oldBpPerPx
          // widen/narrow about the left edge, then put the anchor back under
          // the cursor. Guarded on displayedRegions as it always was: with
          // nothing displayed there is no scroll space to place it in.
          self.windowWidthBp = newBpPerPx * self.width
          if (self.displayedRegions.length) {
            this.scrollToBp(anchorBp - offset * newBpPerPx)
          }
        }
        return self.bpPerPx
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
        assemblyName: string,
      ) {
        getDialogHost(self).queueDialog(handleClose => [
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
      showTrack(
        trackId: string,
        initialSnapshot = {},
        displayInitialSnapshot = {},
        inlineConf?: Record<string, unknown>,
      ) {
        return showTrackGeneric(
          self,
          trackId,
          initialSnapshot,
          displayInitialSnapshot,
          inlineConf,
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
       * showTrack for a track whose display state model may be lazily
       * loaded: loads it, then shows
       */
      async launchTrack(
        trackId: string,
        initialSnapshot = {},
        displayInitialSnapshot = {},
        inlineConf?: Record<string, unknown>,
      ) {
        return launchTrackGeneric(
          self,
          trackId,
          initialSnapshot,
          displayInitialSnapshot,
          inlineConf,
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      moveTrackDown(id: string) {
        const section = self.trackSection(id)
        const idx = section.findIndex(t => t.id === id)
        if (idx !== -1 && idx < section.length - 1) {
          this.moveTrack(id, section[idx + 1]!.id)
        }
      },
      /**
       * #action
       */
      moveTrackUp(id: string) {
        const section = self.trackSection(id)
        const idx = section.findIndex(t => t.id === id)
        if (idx > 0) {
          this.moveTrack(id, section[idx - 1]!.id)
        }
      },
      /**
       * #action
       */
      moveTrackToTop(id: string) {
        const section = self.trackSection(id)
        if (section.length && section[0]!.id !== id) {
          this.moveTrack(id, section[0]!.id)
        }
      },
      /**
       * #action
       */
      moveTrackToBottom(id: string) {
        const section = self.trackSection(id)
        const last = section[section.length - 1]
        if (last && last.id !== id) {
          this.moveTrack(id, last.id)
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
       * toggleTrack with launchTrack's loading behavior
       */
      async launchToggleTrack(trackId: string) {
        return launchToggleTrackGeneric(self, trackId)
      },

      /**
       * #action
       */
      setTrackLabels(setting: 'overlapping' | 'offset' | 'hidden') {
        self.trackLabels = setting
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
      activateTrackSelector() {
        const { session, selector } = openTrackSelectorWidget(self)
        session.showWidget(selector)
        return selector
      },

      /**
       * #action
       */
      toggleTrackSelector() {
        const { session, selector } = openTrackSelectorWidget(self)
        if (isTrackSelectorVisible(self)) {
          session.hideWidget(selector)
        } else {
          session.showWidget(selector)
        }
        return selector
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
        const layout = {
          displayedRegions: self.displayedRegions,
          bpPerPx: self.bpPerPx,
          offsetPx: self.offsetPx,
          width: self.width,
          minimumBlockWidth: self.minimumBlockWidth,
        }
        const { bpPerPx, offsetPx: rawOffsetPx } = computeMoveToLayout(
          layout,
          leftOffset,
          rightOffset,
        )
        // mirror Base1DView.scrollTo clamping: raw offsetPx can be far outside
        // the valid range when both offsets are oob on the same side
        const offsetPx = clamp(
          rawOffsetPx,
          self.minOffset,
          self.totalBp / bpPerPx - MAX_OFFSET_PADDING_PX,
        )
        return wholeBaseRegions(
          calculateDynamicBlocks({
            ...layout,
            bpPerPx,
            offsetPx,
          }).contentBlocks,
        )
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
       */
      setLaunch(launch?: LaunchInput<InitState>) {
        self.launch = launch
      },

      /**
       * #method
       * creates an svg export and save using FileSaver
       */
      async exportSvg(opts: ExportSvgOptions = {}) {
        const { renderToSvg } =
          await import('./svgcomponents/SVGLinearGenomeView.tsx')
        const html = await renderToSvg(self as LinearGenomeViewModel, opts)
        const { saveSvgAsImage } =
          await import('@jbrowse/core/svg/saveSvgAsImage')
        await saveSvgAsImage(html, opts)
      },
    }))
    .actions(self => {
      let cancelLastSlide = () => {}
      let cancelLastZoom = () => {}

      // Both animations pass `read`, so the spring yields the moment anything
      // else moves the view: an animation drives zoomTo/scrollTo from its own
      // position for up to a second, and a direct interaction landing in that
      // window — a wheel/pinch zoom, a locstring nav, a rubberband "zoom to
      // region", a click-drag pan — used to be overwritten on the next frame.
      // Only the zoom slider defended itself, via cancelZoomAnimation, and
      // expecting every future call site to remember that is not a workable
      // contract.

      /**
       * #action
       * perform animated slide
       */
      function slide(viewWidths: number) {
        const [animate, cancelAnimation] = springAnimate({
          from: self.offsetPx,
          to: self.offsetPx + self.width * viewWidths,
          read: () => self.offsetPx,
          write: px => {
            self.scrollTo(px)
          },
          tension: 200,
        })
        cancelLastSlide()
        cancelLastSlide = cancelAnimation
        animate()
      }

      /**
       * #action
       * perform animated zoom
       */
      function zoom(targetBpPerPx: number) {
        cancelLastZoom()
        const effectiveTarget = clamp(
          targetBpPerPx,
          self.minBpPerPx,
          self.maxBpPerPx,
        )
        // nothing to animate when already at the limit, or at the target
        if (effectiveTarget !== self.bpPerPx) {
          const [animate, cancelAnimation] = springAnimate({
            from: self.bpPerPx,
            to: effectiveTarget,
            read: () => self.bpPerPx,
            write: bpPerPx => {
              self.zoomTo(bpPerPx)
            },
            tension: 1000,
            friction: 50,
          })
          cancelLastZoom = cancelAnimation
          animate()
        }
      }

      /**
       * #action
       * cancel an in-flight animated zoom. The animation already yields to any
       * other zoom on its own, so this is for stopping it *without* changing the
       * zoom — the slider grabbing the thumb, before it has a value to commit.
       */
      function cancelZoomAnimation() {
        cancelLastZoom()
      }

      return { slide, zoom, cancelZoomAnimation }
    })
    .views(self => ({
      /**
       * #getter
       */
      get showsWholeChromosome() {
        const { displayedRegions } = self
        const region =
          displayedRegions.length === 1 ? displayedRegions[0] : undefined
        const full = region
          ? getSession(self)
              .assemblyManager.get(region.assemblyName)
              ?.getRegionForRefName(region.refName)
          : undefined
        return region && full
          ? region.start === full.start && region.end === full.end
          : false
      },
      /**
       * #getter
       * an ideogram only reads correctly against an entire chromosome: on a
       * sub-region it is a meaningless slice of bands, and the centromere shows
       * up as a lone half-triangle
       */
      get canShowCytobands() {
        return this.showsWholeChromosome && this.anyCytobandsExist
      },
      /**
       * #getter
       * the `showCytobands` setting gated by whether cytobands can be shown at
       * all (whole chromosome + data present) — i.e. actually on screen
       */
      get effectiveShowCytobands() {
        return this.canShowCytobands && self.showCytobands
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
        return this.effectiveShowCytobands
          ? cytobandLabelGutterWidth(self.displayedRegions[0]?.refName || '')
          : 0
      },
      /**
       * #getter
       */
      get isTrackSelectorOpen() {
        return isTrackSelectorVisible(self)
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
       * #method
       * what a plugin can start from the selected region — a synteny view, a
       * consensus call. Extend this rather than `rubberBandMenuItems` so the
       * entries collect under the menu's "Launch" submenu; that grouping is
       * decided once here rather than by whichever contributor runs first, and
       * keeps the rubberband menu itself short as plugins pile on.
       */
      rubberBandLaunchMenuItems(): MenuItem[] {
        return []
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
    }))
    .views(self => {
      let currentlyCalculatedStaticBlocks: BlockSet | undefined
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
          // Hand back the previous BlockSet when the recompute produced the same
          // blocks, so a sideways scroll past the coverage edge doesn't re-render
          // every track. minimumBlockWidth is part of the guard because block
          // keys don't encode ContentBlock-vs-ElidedBlock, so a region can flip
          // type with an unchanged key. Geometry is compared first: on a zoom it
          // always differs, which skips the key walk entirely — the whole-genome
          // view has one block per refName, so joining those keys into a string
          // (as this used to) allocated an array and a string per zoom frame.
          if (
            currentlyCalculatedStaticBlocks === undefined ||
            bpPerPx !== prevBpPerPx ||
            width !== prevWidth ||
            minimumBlockWidth !== prevMinimumBlockWidth ||
            !sameBlockKeys(currentlyCalculatedStaticBlocks, newBlocks)
          ) {
            currentlyCalculatedStaticBlocks = newBlocks
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
         * leading/trailing pixel span of the visible regions projected onto the
         * overviewLayout — the geometry of the overview's "you are here"
         * rectangle, and of the top edge of the polygon drawn under it. Elided
         * regions count: at whole-genome zoom the tail of an assembly is all
         * coalesced tiny contigs, and stopping at the last *content* block left
         * the rectangle short of (or, scrolled onto that tail, absent from) the
         * polygon it sits on.
         */
        get overviewRegionPxSpan() {
          return getOverviewRegionPxSpan({
            overview: self.overviewLayout,
            bpPerPx: self.bpPerPx,
            blocks: this.dynamicBlocks.blocks,
          })
        },
        /**
         * #getter
         * The x shift that maps the **staticBlocks frame** onto the viewport:
         * `translateX(view.staticBlocksTranslateX)` on one container places
         * every `gridlineTicks`, `scalebarLabels` and `paddingSpans` entry at
         * once, and a pan then moves that single transform rather than each
         * child.
         *
         * The frame exists because those three are laid out across every
         * displayed region rather than across the viewport — it overhangs on
         * both sides — so their `x` values are stable under a scroll and only
         * this number moves. `scalebarRefNameLabels` is the exception and says
         * so: its `transform` is already a screen x, because a sticky label's
         * position is a function of the scroll rather than of block geometry.
         *
         * **The subtraction must happen here, in float64, and that is the
         * load-bearing part.** `offsetPx` is a whole-genome pixel coordinate —
         * hg38 chr1 at base resolution is already past 1e10 — and a length that
         * size does not survive the trip through CSS: the transform matrix is
         * float32 by the time it reaches the compositor, where consecutive
         * representable values at 1e10 are ~1024px apart, and layout saturates
         * sooner still (Blink's `LayoutUnit` is int32 at 1/64px, so ±33.5M px).
         * So the shape that looks obvious — lay an overlay out in absolute
         * genome pixels, write `translateX(-view.offsetPx)` — does not lose a
         * subpixel, it puts the row somewhere else entirely, and only on large
         * assemblies at high zoom, which is not where anyone tests. Both
         * operands here are large and their difference is bounded by the
         * overhang (a block or two), so what reaches CSS is small and exact.
         * Same rule as the GPU side, one layer up —
         * `agent-docs/reference/BP_PRECISION.md`.
         *
         * Published because it is the one piece of coordinate arithmetic a host
         * drawing its own chrome would otherwise have to know, and because
         * having it written out at each call site is how the two in-tree copies
         * came to disagree about rounding. Round it where the content is text
         * (a fractional offset blurs a label); leave it alone for paths and
         * boxes.
         */
        get staticBlocksTranslateX() {
          return this.staticBlocks.offsetPx - self.offsetPx
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
          const { blocks, offsetPx: firstBlockOffset } = this.staticBlocks
          const ticks: { x: number; major: boolean }[] = []
          // iterate merged region runs (like scalebarLabels) so a tick on an
          // internal ~800px chunk boundary isn't emitted twice (once as a
          // chunk's right edge, once as the next chunk's left edge)
          for (const run of groupContiguousBlocks(blocks)) {
            const runLeft = run.offsetPx - firstBlockOffset
            for (const { type, x } of makeBlockTicks(run, bpPerPx)) {
              if (x >= 0 && x <= run.widthPx) {
                ticks.push({ x: runLeft + x, major: type === 'major' })
              }
            }
          }
          return ticks
        },
        /**
         * #getter
         * Scalebar coordinate labels (x in the staticBlocks frame + display
         * text). Sibling of gridlineTicks sharing the same makeBlockTicks
         * formula, so labels line up exactly with their gridlines. staticBlocks
         * chop a region into ~800px chunks; groupContiguousBlocks merges them
         * back per region so a label on an internal chunk boundary isn't clipped
         * away by both neighbors — only genuine region edges clip a label.
         *
         * A run that can hold too few labels to make a ruler goes unnumbered
         * (`tickLabelsWorthDrawing`), the same rule the overview scalebar and
         * the dotplot axes apply: with a whole genome displayed each chromosome
         * catches one lone coordinate, which conveys no scale by itself and
         * reads as the same number repeated across the row.
         */
        get scalebarLabels() {
          const { bpPerPx } = self
          const { blocks, offsetPx: firstBlockOffset } = this.staticBlocks
          const labels: { x: number; label: string; key: string }[] = []
          const runs = groupContiguousBlocks(blocks)
          const refNameLabelPx = runRefNameLabelPx(
            runs,
            self.displayedRegionsOrientation,
          )
          for (const [i, run] of runs.entries()) {
            const runLeft = run.offsetPx - firstBlockOffset
            const runLabels = []
            for (const { base, x } of makeBlockTicks(
              run,
              bpPerPx,
              true,
              false,
            )) {
              const label = getTickDisplayStr(base + 1, bpPerPx)
              const w = tickLabelWidth(label)
              // the bold refName label pinned at the run's left edge takes
              // precedence, as it does on the overview scalebar
              if (
                x - w / 2 >= refNameLabelPx[i]! &&
                labelFitsInBlock(x - w / 2, w, run.widthPx)
              ) {
                runLabels.push({
                  x: runLeft + x,
                  label,
                  key: `${run.offsetPx}-${base}`,
                })
              }
            }
            if (tickLabelsWorthDrawing(runLabels.length)) {
              labels.push(...runLabels)
            }
          }
          return labels
        },
        /**
         * #getter
         * The bold refName labels drawn along the scalebar, as plain data:
         * `{key, refName, displayedRegionIndex, lastDisplayedRegionIndex,
         * sticky, transform, maxWidth, paddingLeft, text}` each. One per run of
         * same-refName regions, plus a "sticky" one pinned to the viewport's
         * left edge naming the refName under it, so panning into a chromosome
         * does not scroll its own name off the screen.
         *
         * Three rules live in here that a host drawing region names will
         * otherwise rediscover the hard way, and two of them are invisible until
         * the data is awkward:
         *
         * - the sticky label rides the rightmost run that has scrolled off the
         *   left, not the region's first block — that one is gone from
         *   staticBlocks entirely once you zoom into a region's interior, taking
         *   the chromosome name off screen at exactly the zoom where nothing
         *   else names it.
         * - adjacent regions of the same refName (collapsed introns) get one
         *   label between them, not one each. That label names the whole run and
         *   is fitted to the whole run, and `displayedRegionIndex` /
         *   `lastDisplayedRegionIndex` bracket what it stands for.
         * - a name is drawn whole or not at all, measured against the space its
         *   run leaves. Clipped to its own width, `chr16` reads as `chr1` —
         *   a different chromosome rather than a shortened name, which is why
         *   this is a fit test rather than an ellipsis.
         *
         * **Viewport frame, unlike its siblings.** `transform` is a screen x,
         * already net of `offsetPx`, where gridlineTicks / scalebarLabels /
         * paddingSpans are all in the staticBlocks frame. The sticky label's
         * position is a function of `offsetPx` rather than of block geometry, so
         * it has no fixed position in that frame — and for the same reason this
         * getter recomputes on every scroll frame where those three do not.
         *
         * `caption` accompanies the labels: the chip at the row's left edge,
         * saying which assembly the row is (a container view — synteny — opts
         * into that through `scalebarDisplayPrefix`) and whether it is flipped.
         * A ` [rev]` there is a fact about the ROW; the same marker on a
         * chromosome name means that one region, which only happens under mixed
         * orientation. `captionSpanPx` is the width it takes, which the
         * coordinate numbers stay out from under. The SVG export deliberately
         * calls `getScalebarRefNameLabels` itself with no prefix rather than
         * reading this, since it draws its own assembly name above the ruler.
         */
        get scalebarRefNameLabels() {
          return getScalebarRefNameLabels({
            blocks: this.staticBlocks.blocks,
            offsetPx: self.offsetPx,
            prefix: self.scalebarDisplayPrefix,
            orientation: self.displayedRegionsOrientation,
          })
        },
        /**
         * #getter
         * Every span along the row that is not track data, as plain geometry in
         * the staticBlocks frame — the same frame as gridlineTicks and
         * scalebarLabels, so one `translateX(staticBlocksTranslateX)` places all
         * three. Three kinds, and a host drawing its own chrome needs all of
         * them:
         *
         * - `seam`: the 3px bar at a region's right edge. Displayed regions are
         *   laid out **contiguously** — calculateStaticBlocks emits boundary
         *   padding only before the first region and after the last — so this
         *   bar is the only thing separating two of them. Without it a
         *   two-region view reads as a one-region view scrolled somewhere
         *   strange. `isRightEndOfDisplayedRegion` is what marks it, and the
         *   right edge of the blocks currently *loaded* — which is what block
         *   geometry hands you — is not the same filter.
         * - `elided`: a region too narrow to draw at this zoom. Whole-genome on
         *   a real assembly is mostly these — hg38 has 455 sequences and all
         *   but the 24 chromosomes land sub-pixel — so a host that skips them
         *   renders that tail as nothing at all.
         * - `boundary`: past the start of the first region or the end of the
         *   last. Greying it is what makes the last region's seam read as the
         *   edge of a filled area rather than a rule floating in the track.
         *
         * Elided blocks get no seam even though they carry the flag: at the
         * zoom where regions elide, one bar per region is a solid grey wall.
         *
         * PaddingBlocks is the in-tree consumer. The SVG export is deliberately
         * NOT one: `SVGRegionSeparators` walks dynamicBlocks itself and draws
         * only the seam, because `elided` and `boundary` are chrome for an
         * interactive row rather than information a figure carries — striped
         * grey saying "regions here are too narrow to draw" is noise in a
         * static image, and at whole-genome zoom it would be most of the row.
         * The seam is the one that must survive: regions lay out contiguously,
         * so it is all that separates two of them.
         */
        // Annotated with the shape spelled out rather than as `PaddingSpan`,
        // because the API doc's type column is where a host drawing its own
        // chrome reads the field names, and a named type prints as its name.
        // `spans` and NO_PADDING_SPANS are both `PaddingSpan[]`, so the two
        // cannot drift without failing here.
        get paddingSpans(): readonly {
          key: string
          x: number
          width: number
          kind: 'seam' | 'elided' | 'boundary'
        }[] {
          const { blocks, offsetPx: firstBlockOffset } = this.staticBlocks
          const spans: PaddingSpan[] = []
          for (const block of blocks) {
            const x = block.offsetPx - firstBlockOffset
            if (block.type === 'ContentBlock') {
              if (block.isRightEndOfDisplayedRegion) {
                spans.push({
                  key: `${block.key}-sep`,
                  x: x + block.widthPx - 1,
                  width: 3,
                  kind: 'seam' as const,
                })
              }
            } else {
              spans.push({
                key: block.key,
                x,
                width: block.widthPx,
                kind:
                  block.type === 'ElidedBlock'
                    ? ('elided' as const)
                    : ('boundary' as const),
              })
            }
          }
          // One shared array when there is nothing to draw, so the computed's
          // value repeats and MobX's `===` stops the chain here. This is the
          // COMMON case, not an edge one: a view sitting inside one contig has
          // no region seam, no elision and no boundary, and that is where a
          // reader spends nearly all of a session. A fresh `[]` each frame
          // instead re-rendered a PaddingBlocks per track plus one for the
          // container, every frame of every gesture, to draw nothing.
          return spans.length > 0 ? spans : NO_PADDING_SPANS
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
         * Whether any part of a displayed region actually falls inside the
         * viewport. False both when the view holds no regions at all and when
         * it holds some but is scrolled entirely off them; either way there is
         * no visible span for the scalebar, ruler and refName labels to
         * describe, which is what the SVG export's header checks before drawing
         * one. Distinct from `hasDisplayedRegions`, which only asks whether the
         * view has been given regions, not whether any are on screen.
         */
        get hasVisibleContent() {
          return this.dynamicBlocks.contentBlocks.length > 0
        },

        /**
         * #getter
         * What is on screen, as regions that address whole bases — what a
         * reader means by "the visible region" when they ask to fetch it,
         * bookmark it or read it back in a locString field. `visibleRegions`
         * below is the other half: pixels, and fractional by design.
         */
        get visibleWholeBaseRegions() {
          return wholeBaseRegions(this.dynamicBlocks.contentBlocks)
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
         * Right edge (px, viewport-relative) of the on-screen content, clamped
         * to the track — where a right-pinned overlay such as a wiggle's colour
         * or score legend belongs, rather than out in the empty gutter the
         * regions can leave at whole-genome zoom. `@jbrowse/display-kit`'s
         * `contentRightEdgePx` states the rule; an SVG export applies the same
         * one against the export's canvas width instead of this track's.
         *
         * Published as a SCALAR on purpose. `visibleRegions` rebuilds a fresh
         * array of fresh objects on every pan and zoom frame, so a component
         * that derived this number itself re-rendered on every frame of every
         * gesture — to produce, whenever content fills the track, the unchanged
         * `trackWidthPx`. Reading the scalar lets MobX's `===` stop the chain at
         * this computed instead. Measured over 20 zoom frames: the wiggle
         * family's three body instances fell from 66 renders to 7.
         */
        get contentRightEdgePx() {
          // The `trackWidthPx` rule sends a DISPLAY to `model.canvasWidthPx`
          // so it cannot pick the wrong one of four view getters. This is the
          // view, publishing its own geometry, and `canvasWidthPx` is defined
          // as exactly this host's `trackWidthPx` (MultiRegionDisplayMixin) —
          // the same source of truth, read from the side that owns it.
          // eslint-disable-next-line no-restricted-syntax
          return contentRightEdgePx(this.visibleRegions, self.trackWidthPx)
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
                // orientation rides along with the fetch region, not just with
                // the render blocks: canvas records it on the rpcDataMap entry
                // (`reversedRegions`) because label overhang packs toward lower
                // bp in a flipped region. A flip mutates `displayedRegions`, so
                // DisplayedRegionsChange refetches and the recorded flag can't
                // go stale.
                reversed: vr.reversed,
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
         * **What a debounced consumer clips to**: the coarse blocks once the
         * view has settled at least once, the live ones before that.
         *
         * The coarse blocks exist so a per-bp scan does not recompute on every
         * animation frame during a pan or zoom — wiggle's autoscale domain, the
         * alignments coverage scale and MAF's coverage band are the three — and
         * while they are stale
         * the answer is merely a frame or two old, which is what the debounce
         * means. **Empty is different in kind.** A scan over no blocks yields no
         * entries, and no entries is not a stale domain, it is the fallback one:
         * `[0,1]`, which draws a line plot blank and a density plot saturated.
         * That window is the 500ms between a view initializing and the coarse
         * autorun's first run, and data can now land inside it — the per-region
         * fetch used to be trailing-edge at 600ms, so it never did.
         *
         * One recompute at that transition, against N per frame, which is the
         * trade the guard was making anyway.
         */
        get settledDynamicBlocks(): ContentBlock[] {
          return self.coarseDynamicBlocks.length
            ? self.coarseDynamicBlocks
            : this.dynamicBlocks.contentBlocks
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
        // Consumers diff the coarse blocks by reference (the alignments and
        // wiggle fetch autoruns), so assigning an equivalent array would make
        // them refetch. `settleCoarseBlocks` flushes these on a discrete jump
        // and the debounced autorun then fires once more with the same blocks —
        // that follow-up has to cost nothing. A block's key encodes its
        // assembly/refName/start/end, so keys are enough to compare.
        const next = blocks.contentBlocks
        const same =
          bpPerPx === self.coarseBpPerPx &&
          next.length === self.coarseDynamicBlocks.length &&
          next.every((b, i) => b.key === self.coarseDynamicBlocks[i]!.key)
        if (!same) {
          self.coarseDynamicBlocks = next
          self.coarseTotalBp = blocks.totalBp
          self.coarseBpPerPx = bpPerPx
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Bring the coarse blocks to the viewport as it stands now, for a
       * placement that JUMPED rather than travelled.
       *
       * The coarse blocks are a 500ms throttle, and every consumer trades
       * freshness for not recomputing per animation frame — the location box,
       * canvas's on-screen feature set, and the two per-bp scans behind
       * `settledDynamicBlocks`. That trade is only sound while the answer is a
       * few frames old. **A jump makes it unrelated instead**, because there is
       * nothing to coalesce: the viewport left behind is not an approximation of
       * the new one, it is a different place. Unsettled, the location box reads
       * as a navigation that didn't happen, and wiggle's autoscale domain is
       * computed over the window the user just left — measured at `[0,200]`
       * against a correct `[0,300]` when a 40bp coarse window survived a jump to
       * 4040bp on screen. Only the per-region fetch moving to the leading edge
       * made that reachable: at 600ms the data never landed inside the hole.
       *
       * **The continuous paths deliberately do not come through here.** The
       * spring zoom writes through `zoomTo` per frame and a drag through
       * `scrollTo`, so this adds no per-frame work; the settle is idempotent
       * (`setCoarseDynamicBlocks` compares block keys), so the debounced
       * autorun's own follow-up run costs nothing.
       *
       * Every placer calls it, and `placersSettleCoarseBlocks.test.ts` is what
       * makes that true of the next one — it scans this file for the writes and
       * fails on a placer that reaches neither the settle nor its named list of
       * continuous paths. Two passes by hand missed four.
       */
      settleCoarseBlocks() {
        if (self.initialized) {
          self.setCoarseDynamicBlocks(self.dynamicBlocks, self.bpPerPx)
        }
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
        self.settleCoarseBlocks()
      },

      /**
       * #action
       * Place the viewport by the pair of PIXEL quantities it used to be stored
       * as. Prefer `setWindow`: pixels mean nothing without the width they were
       * measured at, so a round trip through here is only exact while the width
       * holds still. Kept for callers that genuinely have pixels — a wheel
       * gesture, a rubberband — and for reading old snapshots.
       */
      setNewView(bpPerPx: number, offsetPx: number) {
        self.zoomTo(bpPerPx)
        self.scrollTo(offsetPx)
        self.settleCoarseBlocks()
      },

      /**
       * #action
       * Place the viewport by the pair it is actually STORED as: the window's
       * width and left edge, both in bp. `setNewView`'s bp-space twin, and the
       * right one for anything that captures a viewport and puts it back later
       * (an Undo, a saved location) — those two moments can be a window resize
       * apart, and this pair survives one where a pixel pair does not.
       *
       * Still clamped, by the same zoom and scroll limits as every other mover:
       * the regions may have changed under it, and a window the new set can't
       * hold is not restorable however it was spelled.
       */
      setWindow(windowWidthBp: number, windowStartBp: number) {
        this.setWindowFrame(windowWidthBp, windowStartBp)
        self.settleCoarseBlocks()
      },

      /**
       * #action
       * `setWindow` without the settle, for a writer that runs per animation
       * frame. Flushing the coarse blocks sixty times a second is the one thing
       * such a writer must not do: they are a 500ms throttle that a synteny
       * follow pass and two autoscale domains hang off, and settling each frame
       * turns each of those into per-frame work — `positionViewOnSpans` states
       * the same rule for the same reason.
       */
      setWindowFrame(windowWidthBp: number, windowStartBp: number) {
        // via zoomTo (not a bare assignment) for its clamp; `width` cancels, so
        // the bp width in is the bp width out at whatever width is current
        self.zoomTo(windowWidthBp / self.width)
        self.scrollToBp(windowStartBp)
      },

      /**
       * #action
       * The worst jump of them to leave unsettled: the coarse blocks are keyed
       * by `displayedRegionIndex`, so a set that outlives the region list has a
       * consumer reading one contig's data against another's blocks.
       */
      setDisplayedRegions(regions: Region[]) {
        self.displayedRegions = cast(regions)
        // new regions move both bounds: zoomTo re-clamps bpPerPx into the new
        // [minBpPerPx, maxBpPerPx], scrollTo re-clamps offsetPx into the new
        // [minOffset, maxOffset]. scrollTo is called explicitly rather than
        // left to zoomTo's internal scrollTo, which is skipped when bpPerPx
        // is already in range — shrinking the region set would otherwise
        // strand the view scrolled past the end, on blank space.
        self.zoomTo(self.bpPerPx)
        self.scrollTo(self.offsetPx)
        self.settleCoarseBlocks()
      },

      /**
       * #action
       * Re-assert `maxBpPerPx` over the current zoom, for a container whose
       * shared ceiling just fell — otherwise the view is stranded above it with
       * zoom-out disabled and the slider's min past its value. Goes through
       * `zoomTo` so the clamp keeps one definition, and settles because a
       * ceiling drop moves the window in one step.
       *
       * Requires an `initialized` view; the caller checks, since an MST action
       * reads untracked and a guard here would never re-run once the row
       * arrived.
       */
      clampZoomToCeiling() {
        self.zoomTo(self.bpPerPx)
        self.settleCoarseBlocks()
      },

      /**
       * #action
       */
      showAllRegions() {
        self.windowWidthBp = self.maxBpPerPx * self.width
        self.scrollTo(
          getCenteredOffsetPx(self.displayedRegionsTotalPx, self.width),
        )
        self.settleCoarseBlocks()
      },

      /**
       * #action
       * Fit the displayed regions to the width exactly, edge to edge.
       *
       * Not the same as `showAllRegions`, which goes to `maxBpPerPx` — the
       * zoom-out LIMIT, where `SHOW_ALL_REGIONS_FILL` deliberately keeps a 10%
       * margin so the whole genome doesn't sit flush against both edges. That
       * margin is right for "show me everything" and wrong for a caller that
       * named the regions it wants: it draws them at 1/0.9 of fit-to-width,
       * centered, which is a silent 11% scale difference from the
       * single-region path (`moveTo`, span/width) reached through the same
       * location box.
       *
       * The scale comes from `fitAllRegionsWindow`, which is where the rule is
       * written — a snapshot builder that cannot call an action needs the same
       * answer, and the two agreeing matters more than either being local. Where
       * it clamps up to `minBpPerPx` the content is narrower than the view, and
       * the centering is what frames it.
       */
      fitAllRegions() {
        // The window IS the displayed regions, which is what fitting them means.
        // Nothing is fitted into a width of zero, where the pixel form was
        // equally meaningless.
        if (self.width) {
          self.windowWidthBp = fitAllRegionsWindow(
            self.totalBp,
            self.width,
            self.minBpPerPx,
          ).windowWidthBp
        }
        // Deliberately not the helper's `windowStartBp`: this is the same
        // centering, but going through scrollTo gets the scroll clamp with it,
        // and getCenteredOffsetPx is already the one definition of it in pixels.
        self.scrollTo(
          getCenteredOffsetPx(self.displayedRegionsTotalPx, self.width),
        )
        self.settleCoarseBlocks()
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
        self.scrollTo(self.displayedRegionsTotalPx - self.offsetPx - self.width)
        self.settleCoarseBlocks()
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      showAllRegionsInAssembly(assemblyName?: string) {
        const session = getSession(self)
        const { assemblyManager } = session
        const { assemblyNames } = self
        if (!assemblyName && assemblyNames.length > 1) {
          session.notify(
            `Can't perform operation with multiple assemblies currently`,
          )
        } else {
          const resolvedName = assemblyName ?? assemblyNames[0]
          const regions = resolvedName
            ? assemblyManager.get(resolvedName)?.regions
            : undefined
          if (regions) {
            self.setDisplayedRegions(regions)
            self.showAllRegions()
          }
        }
      },

      /**
       * #action
       * this "clears the view" and makes the view return to the import form
       */
      clearView() {
        self.setDisplayedRegions([])
        self.tracks.clear()
        // it is necessary to run these after setting displayed regions empty
        // or else model.offsetPx gets set to Infinity and breaks
        // @jbrowse/mobx-state-tree snapshot
        self.scrollTo(0)
        self.zoomTo(10)
        // after them, not through setDisplayedRegions, whose own settle ran at
        // the intermediate viewport these two lines exist to leave
        self.settleCoarseBlocks()
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
        const common = {
          assemblyManager,
          defaultAssemblyName,
          displayedRegions,
          grow,
        }
        self.moveTo(
          resolveNavEndpoint({
            ...common,
            location: firstLocation,
            side: 'left',
          }),
          resolveNavEndpoint({
            ...common,
            location: lastLocation,
            side: 'right',
          }),
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Replace the region list and place the viewport in one step. The pair is
       * the unit a coarse-block consumer can act on: called separately they
       * publish the viewport in between, and post-await in `navToLocations`
       * they are two transactions, so a per-bp scan runs over a window that was
       * never on screen.
       *
       * With no location named it fits the regions rather than going through
       * `showAllRegions`: the caller named the regions it wants, so it gets the
       * width, where showAllRegions goes to the zoom-out LIMIT and its 10%
       * margin is dead frame for a named subset.
       */
      showRegions(regions: Region[], location?: NavLocation) {
        self.setDisplayedRegions(regions)
        if (location) {
          self.navTo(location)
        } else {
          self.fitAllRegions()
        }
      },
    }))
    .actions(self => ({
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
       * @param opts - `showHitTrack: false` keeps a text-search hit from also
       * showing the track its index was built from
       * @returns whether the view moved. A multi-hit search raises the picker
       * instead of navigating, and both resolve — see `handleSelectedRegion`.
       */
      // annotated, not inferred: the same type cycle `showTrack` names. Left to
      // infer, the `boolean` reaches this model's type through `self` and 180
      // unrelated files lose their parameter types to it.
      async navToLocString(
        input: string,
        optAssemblyName?: string,
        grow?: number,
        opts?: { showHitTrack?: boolean },
      ): Promise<boolean> {
        const { assemblyNames } = self
        const session = getSession(self)
        const { assemblyManager } = session
        const assemblyName = optAssemblyName || assemblyNames[0]!
        if (assemblyName) {
          await assemblyManager.waitForAssembly(assemblyName)
        }
        if (!isAlive(self)) {
          return false
        }
        return handleSelectedRegion({
          input,
          assemblyName,
          grow,
          showHitTrack: opts?.showHitTrack,
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
        // an empty parse (e.g. blank/whitespace locstring) must not fall
        // through to the multi-region branch below, which would call
        // setDisplayedRegions([]) and blank the view
        if (regions.length === 0) {
          return
        }
        const { assemblyManager } = getSession(self)
        await when(() => self.volatileWidth !== undefined)

        // Generate locations from the parsed regions
        const locations = await generateLocations({
          regions,
          assemblyManager,
          assemblyName,
          grow,
        })

        // the view may have been closed/detached while the assembly loaded
        if (!isAlive(self)) {
          return
        }
        if (locations.length === 0) {
          return
        }

        // Handle single location case
        if (locations.length === 1) {
          const location = locations[0]!
          const { reversed, parentRegion, start, end } = location

          // Clamped into the parentRegion bounds, whose lower bound is
          // parentRegion.start and not 0: the region being displayed IS
          // parentRegion, so a start below it fails navTo's containment check
          // wherever the parentRegion doesn't begin at 0.
          self.showRegions([{ ...parentRegion, reversed }], {
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
        // Handle multiple locations case. Each region is built from
        // parentRegion (not the parsed location) so it carries the canonical
        // refName rather than whatever alias/casing the user typed, doesn't
        // drag the whole nested parentRegion object into the persisted
        // displayedRegions, and stays clamped to the chromosome bounds that
        // `grow` may have pushed it past.
        else {
          self.showRegions(
            locations.map(({ start, end, reversed, parentRegion }) =>
              start === undefined || end === undefined
                ? { ...parentRegion, reversed }
                : {
                    ...parentRegion,
                    reversed,
                    start: clamp(start, parentRegion.start, parentRegion.end),
                    end: clamp(end, parentRegion.start, parentRegion.end),
                  },
            ),
          )
        }
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
        return buildRubberBandMenuItems(
          self as LinearGenomeViewModel,
          self.rubberBandLaunchMenuItems(),
        )
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
          self.settleCoarseBlocks()
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
    .actions(self => {
      let cancelLastFlight = () => {}
      // Where a flight in progress is going, and nothing while none is. A
      // flight's frames are presentation: the viewport the view has COMMITTED
      // to is the destination, and a reader that wants "the zoom this view is
      // on" wants that rather than whatever the arc is passing through. Without
      // it a second click landing mid-flight framed its mate at the apex's
      // zoom, which is a whole chromosome wide for no reason the reader can see.
      let heading: FlightViewport | undefined

      /**
       * #action
       * Travel to a window rather than appear in it: the Van Wijk arc from
       * where the view is to where it is going, played over its own duration.
       *
       * WHAT LANDS IS WHAT `setWindow` WOULD HAVE LANDED — only the path in
       * between is new. That is what lets a caller offer an Undo, a snackbar or
       * a follow anchor around this exactly as it did around the instant move.
       *
       * It YIELDS to anything else that moves the view, by reading back what it
       * wrote and stopping the moment the view holds something else: a wheel
       * zoom, a drag, a locstring nav, or the Undo on the very snackbar the
       * flight was launched with. Compared against what was WRITTEN rather than
       * what was asked for, because the write clamps — an arc that pulls back
       * past `maxBpPerPx` reads its own clamped result back, and treating that
       * as interference would end the flight one frame in. `springAnimate`
       * defends the same value the same way.
       */
      function flyTo(centerBp: number, windowWidthBp: number) {
        cancelLastFlight()
        cancelLastFlight = () => {}
        const flight = planFlight(
          {
            centerBp: self.windowStartBp + self.windowWidthBp / 2,
            windowWidthBp: self.windowWidthBp,
          },
          { centerBp, windowWidthBp },
        )
        if (flight.durationMs > 0 && self.width > 0) {
          heading = { centerBp, windowWidthBp }
          const startedAt = performance.now()
          let frameId: number | undefined
          let written: { widthBp: number; startBp: number } | undefined
          cancelLastFlight = () => {
            if (frameId !== undefined) {
              cancelAnimationFrame(frameId)
            }
          }
          function place(t: number) {
            const at = flight.at(t)
            self.setWindowFrame(
              at.windowWidthBp,
              at.centerBp - at.windowWidthBp / 2,
            )
            written = {
              widthBp: self.windowWidthBp,
              startBp: self.windowStartBp,
            }
          }
          function frame() {
            // Liveness before any read: a row can be removed mid-flight — the
            // level holding it closed, the track detached — and every read
            // below throws on a dead node, in a callback with nobody to catch
            // it.
            if (isAlive(self)) {
              const moved =
                written !== undefined &&
                (self.windowWidthBp !== written.widthBp ||
                  self.windowStartBp !== written.startBp)
              if (!moved) {
                const t = (performance.now() - startedAt) / flight.durationMs
                if (t < 1) {
                  place(t)
                  frameId = requestAnimationFrame(frame)
                } else {
                  place(1)
                  self.settleCoarseBlocks()
                  heading = undefined
                }
              } else {
                heading = undefined
              }
            }
          }
          frame()
        } else {
          heading = undefined
          self.setWindow(windowWidthBp, centerBp - windowWidthBp / 2)
        }
      }

      return {
        flyTo,

        /**
         * #action
         * `centerAt`'s animated twin: the same destination, reached along the
         * arc instead of jumped to, at the zoom the view is already on.
         */
        flyToCenter(coord: number, refName: string) {
          // `bpToLinearBp` rather than `bpToPx`, which rounds to a whole pixel
          // at the current zoom: mid-flight that zoom is a point on somebody
          // else's arc, and a destination quantized against it moves with it.
          const centerBp = bpToLinearBp({
            refName,
            coord,
            displayedRegions: self.displayedRegions,
          })
          if (centerBp !== undefined) {
            flyTo(
              centerBp,
              heading ? heading.windowWidthBp : self.windowWidthBp,
            )
          }
        },
      }
    })
    .actions(self => ({
      afterCreate() {
        setupKeyboardHandler(self as LinearGenomeViewModel)
      },

      afterAttach() {
        doAfterAttach(self as LinearGenomeViewModel)
      },
    }))

  return withLaunchInput(model, lgvLaunchKeys)
    .preProcessSnapshot((snap: Record<string, unknown> | undefined) => {
      if (!snap) {
        return snap
      }
      // The cytobands setting has been `showCytobandsSetting` and (briefly)
      // `cytobandsVisible`; both now persist as the bare `showCytobands` prop
      // (the capability-gated getter is `effectiveShowCytobands`).
      const {
        highlight,
        showCytobandsSetting,
        cytobandsVisible,
        offsetPx,
        bpPerPx,
        ...rest
      } = snap
      const legacyShowCytobands = showCytobandsSetting ?? cytobandsVisible
      return {
        highlight:
          Array.isArray(highlight) || highlight === undefined
            ? highlight
            : [highlight],
        ...(legacyShowCytobands !== undefined
          ? { showCytobands: legacyShowCytobands }
          : {}),
        // The viewport used to persist as pixels. Half of that converts
        // exactly and needs no width — the left edge in bp is offsetPx *
        // bpPerPx — and half of it cannot convert at all, because the width
        // those pixels were measured at was never written down. So bpPerPx
        // rides to the first measure as `legacyBpPerPx` and is adopted at
        // whatever width arrives, which is precisely what the old code did.
        // An old link therefore keeps its old behavior instead of being
        // reinterpreted, and anything authored since restores its window.
        //
        // Also the path for the several places that BUILD a view from a
        // snapshot naming bpPerPx/offsetPx (a synteny row, a split view) —
        // they get the same treatment as a saved session, so none of them had
        // to change.
        ...(typeof bpPerPx === 'number' &&
        bpPerPx > 0 &&
        rest.windowWidthBp === undefined
          ? {
              legacyBpPerPx: bpPerPx,
              windowStartBp:
                (typeof offsetPx === 'number' ? offsetPx : 0) * bpPerPx,
            }
          : {}),
        ...rest,
      }
    })
    .postProcessSnapshot(snap => {
      // launch is transient, never persisted. showCenterLine is
      // purely a localStorage-backed preference (see setupLocalStorageAutorun
      // in afterAttach.ts) and is never persisted into session snapshots. The
      // remaining fields are also localStorage-backed, but still persist when
      // non-default: their strip baseline is the universal default (hardcoded
      // here), not the localStorage-derived creation default, so a
      // localStorage-set value stays portable across browsers.
      const {
        launch,
        showCenterLine,
        showCytobands,
        trackLabels,
        colorByCDS,
        showAminoAcids,
        showTrackOutlines,
        ...rest
      } = snap

      return {
        ...rest,
        // keep the launch state until displayedRegions exist, so a snapshot
        // taken before the launch autorun navigates (e.g. autosave firing
        // mid-load) can still rebuild the view instead of dropping to the
        // import form. displayedRegions is stripDefault, so it's absent (not
        // []) when empty — the optional chain is runtime-necessary despite the
        // non-nullish type.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        ...(launch && !snap.displayedRegions?.length ? { launch } : {}),
        ...(!showCytobands ? { showCytobands } : {}),
        ...(trackLabels ? { trackLabels } : {}),
        ...(colorByCDS ? { colorByCDS } : {}),
        ...(!showAminoAcids ? { showAminoAcids } : {}),
        ...(!showTrackOutlines ? { showTrackOutlines } : {}),
      }
    })
}

export type LinearGenomeViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearGenomeViewModel = Instance<LinearGenomeViewStateModel>

// #region registry
declare module '@jbrowse/core/PluginManager' {
  interface ViewTypeRegistry {
    LinearGenomeView: LinearGenomeViewStateModel
  }
}
// #endregion
