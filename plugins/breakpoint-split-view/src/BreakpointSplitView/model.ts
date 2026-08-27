import { lazy } from 'react'

import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import {
  avg,
  createStatusChannel,
  getDialogHost,
  getNotificationSink,
  getSession,
  notEmpty,
} from '@jbrowse/core/util'
import { layoutBpToPx } from '@jbrowse/core/util/Base1DUtils'
import { fanOutStatus, makeFetchContext } from '@jbrowse/core/util/fetchContext'
import { installClearHoverOnSurfaceMove } from '@jbrowse/core/util/installClearHoverOnSurfaceMove'
import { installFetch } from '@jbrowse/core/util/installFetch'
import { addDisposer, cast, types } from '@jbrowse/mobx-state-tree'
import { installLinkedViewSync } from '@jbrowse/plugin-linear-genome-view'
import CropFreeIcon from '@mui/icons-material/CropFree'
import PhotoCamera from '@mui/icons-material/PhotoCamera'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { autorun } from 'mobx'

import {
  classifyVariantFeatures,
  getBadlyPairedAlignments,
  getClipLengthAtStartOfRead,
  getMatchedAlignmentFeatures,
  getMatchedBreakendFeatures,
  getMatchedPairedFeatures,
  getMatchedTranslocationFeatures,
  hasPairedReads,
  markHiddenSegments,
  readChainSegments,
} from './featureMatching.ts'
import {
  VIEW_DIVIDER_HEIGHT,
  calc,
  computeOverlayY,
  findFeatureViewLevel,
  getBlockFeatures,
  intersect,
  layoutUnknown,
  makeOffscreenLayout,
} from './util.ts'

import type {
  BreakpointSplitViewInitView,
  ExportSvgOptions,
  LayoutRecord,
  MatchedChunks,
  OverlayLevel,
  OverlayHover,
  OverlayMatch,
} from './types.ts'
import type { OverlayTrack } from './util.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, StatusChannel } from '@jbrowse/core/util'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog.tsx'))

/**
 * #stateModel BreakpointSplitView
 * #category view
 *
 * #example
 * Hand-authored under `defaultSession.views`. `init` is an array — one entry
 * per stacked panel — each declaring the `assembly`, a `loc`, and the `tracks`
 * to show. The two panels flank a structural-variant breakpoint:
 * ```js
 * {
 *   type: 'BreakpointSplitView',
 *   init: [
 *     { assembly: 'hg38', loc: 'chr1:1,000,000-1,100,000', tracks: ['alignments'] },
 *     { assembly: 'hg38', loc: 'chr5:2,000,000-2,100,000', tracks: ['alignments'] },
 *   ],
 * }
 * ```
 * Each `tracks` entry can also be a `{ trackId, displaySnapshot }` object to
 * set per-panel display options (e.g. a shorter alignments height).
 */
export default function stateModelFactory(pluginManager: PluginManager) {
  const defaultHeight = 400
  return types
    .compose(
      'BreakpointSplitView',
      BaseViewModel,
      types.model({
        /**
         * #property
         */
        type: types.literal('BreakpointSplitView'),
        /**
         * #property
         * the height of the whole view in pixels, panels and overlay together
         */
        height: types.stripDefault(types.number, defaultHeight),
        /**
         * #property
         * draw the links whose two ends land in the same panel, as well as the
         * ones that cross between panels
         */
        showIntraviewLinks: types.stripDefault(types.boolean, true),
        /**
         * #property
         * sync scroll and zoom across the panels, so panning one pans them all
         */
        linkViews: types.stripDefault(types.boolean, false),
        /**
         * #property
         * make the alignment squiggles drawn between the panels clickable,
         * rather than a static overlay
         */
        interactiveOverlay: types.stripDefault(types.boolean, true),
        /**
         * #property
         * show the view's own header bar, above the panels' own
         */
        showHeader: types.stripDefault(types.boolean, true),
        /**
         * #property
         */
        views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        ),
        /**
         * #property
         * declarative child panels (loc/assembly/tracks) resolved into `views`
         * once the view has a width; used for initializing from a session
         * snapshot. Transient — stripped by postProcessSnapshot.
         */
        init: types.frozen<BreakpointSplitViewInitView[] | undefined>(),
      }),
    )
    .volatile<{
      width: number
      matchedTrackFeatures: Record<string, Feature[][]>
      reloadCounter: number
      fetchStatus: StatusChannel
      hoveredOverlay: OverlayHover | undefined
    }>(() => ({
      /**
       * #volatile
       */
      width: 800,
      /**
       * #volatile
       */

      matchedTrackFeatures: {},
      /**
       * #volatile
       * The pure "go again" signal the shared fetch skeleton reads above every
       * gate, bumped by `reload()`: after a failure every other input of the
       * overlay fetch is unchanged, so nothing else can rewake it. The Retry on
       * the failure notification is what spends it.
       */
      reloadCounter: 0,
      /**
       * #volatile
       * What the overlay-feature fetch is doing, for the corner chip. A
       * `StatusChannel` rather than the `statusMessage`/`statusProgress`/
       * `setStatusMessage` trio a display declares: this is a view with one
       * operation to narrate, and the trio is a status vocabulary it has no
       * other use for.
       */
      fetchStatus: createStatusChannel(),
      /**
       * #volatile
       * Which overlay curve the pointer is on, and the reason it lives here
       * rather than in each overlay's React state: a hover the viewport can
       * invalidate needs one place to be cleared from, which is what
       * `overlayTransformKey` and the `afterAttach` reaction give it.
       */
      hoveredOverlay: undefined,
    }))
    .views(self => ({
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
      get hasSomethingToShow() {
        return self.views.length > 0 || self.init !== undefined
      },

      /**
       * #getter
       */
      get initialized() {
        return self.views.length > 0 && self.views.every(v => v.initialized)
      },

      /**
       * #getter
       * Resolved, like LGV's and linear-comparative's: it folds in the
       * sub-views, whose assemblies are what `initialized` waits on. Without
       * them a failed assembly leaves `initialized` false forever with nothing
       * to report, and an SVG export waiting on it hangs behind the dialog's
       * spinner instead of raising the error (see `awaitViewInitialized`).
       */
      get error(): unknown {
        return self.views.find(v => v.error)?.error
      },

      /**
       * #getter
       * Spinner instead of content, i.e. sub-views exist but haven't loaded their
       * assemblies yet. Named to match LGV/dotplot/synteny/circular, which is what
       * ViewContainer reads to publish `data-view-phase`.
       */
      get showLoading() {
        return this.hasSomethingToShow && !this.initialized && !this.error
      },

      /**
       * #getter
       * The assembly whose load the spinner is waiting on. Delegated to the
       * first sub-view that hasn't initialized, since each LGV already resolves
       * this for itself; before the sub-views exist, `init` is what names them.
       */
      get loadingAssembly() {
        return self.views.length > 0
          ? self.views.find(v => !v.initialized)?.loadingAssembly
          : getSession(self).assemblyManager.loadingAssembly(
              self.init?.map(v => v.assembly) ?? [],
            )
      },

      /**
       * #getter
       * What the spinner says: which of the assembly's files is downloading,
       * rather than a bare "Loading" for the slow part of startup. See
       * agent-docs/reference/PROGRESS_REPORTING.md.
       */
      get loadingMessage() {
        return this.showLoading
          ? this.loadingAssembly?.statusMessage || 'Loading'
          : undefined
      },

      /**
       * #getter
       * Determinate fraction for the spinner's bar, when the assembly load
       * reports one
       */
      get loadingProgress() {
        return this.showLoading
          ? this.loadingAssembly?.statusProgress
          : undefined
      },
      /**
       * #getter
       * The URL the assembly load is currently fetching, when the phase named
       * one. Only the stalled-load notice reads it — see `ViewLoadingScreen`.
       */
      get loadingSource() {
        return this.showLoading ? this.loadingAssembly?.statusSource : undefined
      },

      /**
       * #getter
       * A failed assembly counts: the views it left behind never initialize, so
       * there is nothing to show and no second attempt coming in this session.
       * The form — which reports `error` in its banner — is then the only way
       * forward, matching LGV/synteny/dotplot/circular rather than spinning on a
       * `showLoading` that can never resolve.
       */
      get showImportForm() {
        return !this.hasSomethingToShow || !!this.error
      },

      /**
       * #getter
       * One assembly per row, index-aligned with `views`.
       *
       * Per row and not one for the view, because the rows are independently
       * assembly-picked (the import form has an assembly selector per row, and
       * `init` carries one per entry). Resolving every row's refNames through
       * row 0's assembly is right only while they all name the same one: on a
       * genuinely cross-assembly view the strict resolver answers `undefined`
       * for every contig belonging to any other row, and the overlay drew NO
       * connectors at all.
       *
       * A row whose assembly has not loaded is `undefined` rather than a hole,
       * so a level index stays a level index; its features drop, which is what
       * an unresolvable refName does anyway.
       */
      get assemblies() {
        const { assemblyManager } = getSession(self)
        return self.views.map(view => {
          const name = view.assemblyNames[0]
          return name ? assemblyManager.get(name) : undefined
        })
      },
    }))
    .views(self => ({
      /**
       * #method
       * creates an svg export and save using FileSaver
       */
      async exportSvg(opts: ExportSvgOptions = {}) {
        const { renderToSvg } =
          await import('./svgcomponents/SVGBreakpointSplitView.tsx')
        const html = await renderToSvg(self as BreakpointViewModel, opts)
        const { saveSvgAsImage } =
          await import('@jbrowse/core/svg/saveSvgAsImage')
        await saveSvgAsImage(html, opts)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Find all track ids that match across multiple views, or return just
       * the single view's track if only a single row is used
       */
      // The OverlayTrack annotation is load-bearing: `view.tracks` is an MST
      // pluggable union TS widens to `any`, so without it every field read
      // through this getter is unchecked. A `display.notReady?.()` guard against
      // a method no display defines survived here for exactly that reason.
      get matchedTracks(): OverlayTrack[] {
        return self.views.length === 1
          ? self.views[0]!.tracks
          : intersect(
              elt => elt.configuration.trackId,
              ...self.views.map(view => view.tracks as OverlayTrack[]),
            )
      },

      /**
       * #getter
       * Same name and same meaning as `FetchMixin.fetchInert`, on a view rather
       * than a display: with nothing matched across the rows there is nothing
       * for the overlay fetch to ask for, so `prepare` declines instead of
       * running an empty fetch and commit on every pan.
       */
      get fetchInert(): boolean {
        return this.matchedTracks.length === 0
      },

      /**
       * #getter
       * Every number that moves the overlay under a stationary cursor, in one
       * value — what `installClearHoverOnSurfaceMove` watches.
       *
       * Per row, `offsetPx` and `bpPerPx`, which covers a pan or a zoom from
       * any entry point: the wheel, the header buttons, a locstring search, or
       * a `linkViews` echo of the row next to it. Per matched track and per
       * row, the body's `scrollTop` and `height`, since a pileup scrolls and a
       * track resizes under a pointer that never moved, plus `regionTooLarge`,
       * whose flip swaps the body for the banner and back.
       *
       * Scoped to the matched tracks rather than every track in the view: an
       * unrelated track finishing its first render resizes nothing the overlay
       * draws on, and clearing the hover for it would read as a flicker.
       */
      get overlayTransformKey() {
        const parts: (number | boolean)[] = []
        for (const view of self.views) {
          parts.push(view.offsetPx, view.bpPerPx)
        }
        for (const { configuration } of this.matchedTracks) {
          for (const track of this.getMatchedTracks(configuration.trackId)) {
            const d = track.displays[0]
            parts.push(
              d?.scrollTop ?? 0,
              d?.height ?? 0,
              d?.regionTooLarge ?? false,
            )
          }
        }
        return parts.join(' ')
      },

      /**
       * #method
       * Get tracks with a given trackId across multiple views. Callers that
       * index the result by view level (getTrackOverlayData,
       * getMatchedFeaturesInLayout) rely on it staying aligned with `views` —
       * which holds only because overlays are driven by `overlayMatches`, whose
       * trackIds come from `matchedTracks` (the intersect across all views), so
       * the track is present in every view and `filter` drops nothing. Don't
       * level-index the result for an arbitrary trackId.
       */
      getMatchedTracks(trackConfigId: string): OverlayTrack[] {
        return self.views
          .map(view => view.getTrack(trackConfigId))
          .filter(notEmpty)
      },

      /**
       * #method
       * Per-render precompute for an overlay track. Resolves an OverlayLevel of
       * geometry per view level, then returns getX/getY closures for converting
       * feature layout records to SVG coordinates.
       *
       * `yOffsetsOverride` — SVG export: fixed track tops, scrollTops zeroed.
       * `domYOffsets` — live rendering: DOM-measured track tops (relative to
       * the overlay SVG), scrollTops still read from model.
       */
      getTrackOverlayData(
        trackId: string,
        yOffsetsOverride?: number[],
        domYOffsets?: (number | undefined)[],
      ) {
        const { views } = self
        const tracks = this.getMatchedTracks(trackId)
        const levels: OverlayLevel[] = []
        // Plain-object projection of each view, snapshotted once per render.
        // getX resolves a bpToPx per connection endpoint and isReversed a
        // pxToBp; routing those through the MST view re-reads
        // displayedRegions/bpPerPx/offsetPx through MobX observable getters on
        // every single call, which dominated the overlay's render profile on
        // alignments tracks. Reading them once here is equivalent — this whole
        // function already re-runs per render inside the caller's observer (see
        // the 'use no memo' note in overlayUtils), which is exactly what makes
        // the offsetPx snapshot below correct too.
        const layouts: ViewLayout[] = []

        let viewTop = 0
        for (const [level, view] of views.entries()) {
          // Every read here is plain layout state, valid whether or not the view
          // has initialized, so no level is skipped: a gap would read back as
          // NaN coordinates and would drop that level's height from viewTop,
          // shifting every level below it. An uninitialized view resolves no
          // bpToPx, so getX already returns undefined and callers drop the
          // connection.
          const d = tracks[level]!.displays[0]!
          levels.push({
            yOffset:
              yOffsetsOverride?.[level] ??
              domYOffsets?.[level] ??
              viewTop + (view.getTrackYOffset(trackId) ?? 0),
            height: d.height,
            coverageOffset: d.coverageDisplayHeight ?? 0,
            scrollTop: yOffsetsOverride ? 0 : (d.scrollTop ?? 0),
            offsetPx: view.offsetPx,
            linksReads: d.linkedReads !== undefined && d.linkedReads !== 'off',
          })
          layouts.push({
            displayedRegions: view.displayedRegions,
            bpPerPx: view.bpPerPx,
            offsetPx: view.offsetPx,
            width: view.width,
            minimumBlockWidth: view.minimumBlockWidth,
          })
          viewTop += view.height + VIEW_DIVIDER_HEIGHT
        }

        function getY(level: number, layout: LayoutRecord) {
          return computeOverlayY({ ...levels[level]!, layout })
        }

        function getX(level: number, refName: string, coord: number) {
          const offsetPx = layoutBpToPx(layouts[level]!, { refName, coord })
          return offsetPx === undefined
            ? undefined
            : offsetPx - levels[level]!.offsetPx
        }

        return { tracks, levels, layouts, getX, getY }
      },

      getMatchedFeaturesInLayout(trackConfigId: string, features: Feature[][]) {
        const tracks = this.getMatchedTracks(trackConfigId)
        const { views } = self
        return features.map(c =>
          c
            .map(feature => {
              const clipLengthAtStartOfRead =
                getClipLengthAtStartOfRead(feature)
              for (const [level, track] of tracks.entries()) {
                const layout = calc(track, feature)
                if (layout) {
                  return { feature, layout, level, clipLengthAtStartOfRead }
                }
              }
              // No row in any track's layout: the display keeps none (paired/arc
              // displays), or the worker dropped the read (filterBy and friends).
              // Synthesize an off-display record so the connection still draws to
              // the bottom edge. NOT the maxHeight case — see makeOffscreenLayout.
              const start = feature.get('start')
              // bpToPx matches displayedRegions by exact refName, so the raw
              // adapter refName is canonicalized per level — against that row's
              // own assembly — or an aliased one (bedpe 'A' vs the view's
              // 'ctgA') resolves to no level and the feature is dropped. The
              // drawing side canonicalizes the same way, via
              // getCanonicalRefPair.
              const level = findFeatureViewLevel(
                views,
                self.assemblies,
                feature.get('refName'),
                start,
              )
              return level === undefined || tracks.some(layoutUnknown)
                ? undefined
                : {
                    feature,
                    layout: makeOffscreenLayout(start, feature.get('end')),
                    level,
                    clipLengthAtStartOfRead,
                  }
            })
            .filter(notEmpty),
        )
      },

      /**
       * #getter
       * Classifies each matched track and pairs its features, keyed by trackId.
       * Everything here is a function of the fetched features alone, so it is
       * deliberately kept out of `overlayMatches`, which additionally reads each
       * track's layout: the layout reads invalidate on a track resize or a
       * compactness change, and fusing the two would re-run this whole pass —
       * including the SA-chain parse, the expensive part — on every drag frame.
       */
      get matchedTrackChunks(): Map<string, MatchedChunks> {
        const result = new Map<string, MatchedChunks>()
        for (const track of this.matchedTracks) {
          const trackId = track.configuration.trackId
          const featureArrays = self.matchedTrackFeatures[trackId]
          if (!featureArrays) {
            continue
          }
          const allFeatures = new Map(
            featureArrays.flat().map(f => [f.id(), f] as const),
          )
          const type = track.type
          if (type === 'AlignmentsTrack') {
            // Paired-vs-split is decided per track-match here (any PAIRED flag
            // ⇒ treat the whole match as paired). Consequence: a paired read
            // that is ALSO SA-split has its split junctions drawn with the
            // paired endpoint rule (both 3' edges, no 5'-leading foldback) in
            // AlignmentConnections. The alignments-track linked-read overlay
            // resolves this per-connection instead (readGroupConnections emits
            // both the split junctions and the mate link). Unifying would mean
            // porting sub-read chaining into this match resolution.
            const paired = hasPairedReads(allFeatures)
            const matched = paired
              ? getBadlyPairedAlignments(allFeatures)
              : getMatchedAlignmentFeatures(allFeatures)
            result.set(trackId, {
              kind: 'alignment',
              allFeatures,
              matched,
              hasPairedReads: paired,
              chains: paired ? undefined : matched.map(readChainSegments),
            })
          } else if (type === 'VariantTrack') {
            const kind = classifyVariantFeatures(allFeatures)
            result.set(trackId, {
              kind,
              allFeatures,
              matched:
                kind === 'translocation'
                  ? getMatchedTranslocationFeatures(allFeatures)
                  : kind === 'paired'
                    ? getMatchedPairedFeatures(allFeatures)
                    : getMatchedBreakendFeatures(allFeatures),
            })
          }
        }
        return result
      },

      /**
       * #getter
       * Zero-arg cached getter: resolves each matched chunk's features to layout
       * rectangles, returning a Map keyed by trackId. Mobx caches this across
       * renders and only invalidates when the underlying feature or layout reads
       * change — so scrolling within already-loaded data does NOT trigger a
       * re-lookup.
       */
      get overlayMatches(): Map<string, OverlayMatch> {
        const result = new Map<string, OverlayMatch>()
        for (const [trackId, chunk] of this.matchedTrackChunks) {
          const { kind, allFeatures, matched, hasPairedReads, chains } = chunk
          const layoutMatches = this.getMatchedFeaturesInLayout(
            trackId,
            matched,
          )
          if (chains) {
            for (const [i, m] of layoutMatches.entries()) {
              m.sort(
                (a, b) => a.clipLengthAtStartOfRead - b.clipLengthAtStartOfRead,
              )
              markHiddenSegments(m, chains[i]!)
            }
          }
          result.set(trackId, {
            kind,
            allFeatures,
            layoutMatches,
            hasPairedReads,
          })
        }
        return result
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setWidth(newWidth: number) {
        self.width = newWidth
        for (const v of self.views) {
          v.setWidth(newWidth)
        }
      },

      /**
       * #action
       * `undefined` when the pointer leaves a curve, and when the picture moves
       * out from under it — see `overlayTransformKey`.
       */
      setHoveredOverlay(arg: OverlayHover | undefined) {
        self.hoveredOverlay = arg
      },

      /**
       * #action
       */
      setInteractiveOverlay(arg: boolean) {
        self.interactiveOverlay = arg
      },

      /**
       * #action
       */
      setShowIntraviewLinks(arg: boolean) {
        self.showIntraviewLinks = arg
      },

      /**
       * #action
       */
      setLinkViews(arg: boolean) {
        self.linkViews = arg
      },

      /**
       * #action
       */
      setScrollZoom(arg: boolean) {
        getSession(self).setScrollZoom(arg)
      },

      /**
       * #action
       */
      setShowHeader(arg: boolean) {
        self.showHeader = arg
      },

      /**
       * #action
       */
      setMatchedTrackFeatures(obj: Record<string, Feature[][]>) {
        self.matchedTrackFeatures = obj
      },
      /**
       * #action
       * Re-run the overlay-feature fetch with no input change — what the Retry
       * on its failure notification calls.
       */
      reload() {
        self.reloadCounter += 1
      },
      /**
       * #action
       */
      reverseViewOrder() {
        self.views.reverse()
      },

      /**
       * #action
       */
      squareView() {
        const average = avg(self.views.map(v => v.bpPerPx))
        for (const view of self.views) {
          const center = view.pxToBp(view.width / 2)
          view.setNewView(average, view.offsetPx)
          if (center.refName) {
            view.centerAt(center.coord0, center.refName, center.index)
          }
        }
      },

      /**
       * #action
       */
      setInit(init?: BreakpointSplitViewInitView[]) {
        self.init = init
      },

      /**
       * #action
       */
      setViews(viewInits: BreakpointSplitViewInitView[]) {
        self.views = cast(
          viewInits.map(({ loc, assembly, tracks }) => ({
            type: 'LinearGenomeView' as const,
            hideHeader: true,
            init: { loc, assembly, tracks },
          })),
        )
      },
    }))
    .actions(self => ({
      afterAttach() {
        // The overlay is one SVG over every row, so the view owns the hover
        // and the view answers for invalidating it. The pointer handlers cover
        // the pointer moving; this covers the picture moving instead, which
        // fires no pointer event at all. It replaced a `window` wheel listener
        // per overlay track, which caught the one axis its author had in hand
        // and left a header zoom, a locstring search, a pileup scroll and the
        // too-large banner naming a junction the cursor was no longer on.
        installClearHoverOnSurfaceMove(self, {
          transform: () => self.overlayTransformKey,
          clear: () => {
            self.setHoveredOverlay(undefined)
          },
          name: 'BreakpointSplitViewClearHoverOnOverlayMove',
        })
        installLinkedViewSync(self, [
          'horizontalScroll',
          'zoomTo',
          'showTrack',
          'toggleTrack',
          'hideTrack',
          'setTrackLabels',
          'setShowCenterLine',
        ])
        addDisposer(
          self,
          autorun(
            function breakpointSplitViewInitAutorun() {
              const { init, width } = self
              if (!width || !init) {
                return
              }

              self.setViews(init)
              self.setInit(undefined)
            },
            { name: 'BreakpointSplitViewInit' },
          ),
        )
        // The shared fetch skeleton, which this fetch reached last: it was a
        // hand-rolled `fetchGeneration` counter and nothing else, which ordered
        // the commits and left the losers running — panning away kept both
        // views' `BreakpointGetFeatures` calls, and their downloads, going to
        // completion for a viewport nobody was looking at. What the skeleton
        // brings beyond the rotation is the leading edge (the first overlay
        // fetch no longer waits out a full second), the currency-guarded error
        // rule, the retired status slot, and the two dev-only contract checks.
        installFetch(self, {
          name: 'BreakpointFeatureFetcher',
          delay: 1000,
          report: self.fetchStatus,
          contract: "BreakpointSplitView's overlay fetch",
          // A foundation-level skip rather than a `prepare` decline: the views
          // being measured is not this fetch's own gate, and `initialized` is
          // observable, so the body re-runs the moment it flips.
          gate: () => self.views.every(view => view.initialized),
          prepare: () => {
            if (self.fetchInert) {
              return undefined
            }
            // Skipped per track, not for the whole view: where the banner has
            // replaced the features there is nothing to match against, but that
            // says nothing about the other matched tracks, and dropping the key
            // also clears any features left from before the track went over its
            // limit.
            const tracks = self.matchedTracks.filter(
              track => !track.displays[0]!.regionTooLarge,
            )
            // THE READ THAT MAKES A PAN REFETCH, and it belongs here rather
            // than in `getBlockFeatures` where it used to sit. Reached from
            // there it tracked only because the `tracks.map` below runs its
            // async bodies as far as their first await synchronously, so the
            // read landed inside the tracked window from two files away — and
            // one hoisted await anywhere along that chain would have stopped
            // every refetch on pan with nothing failing. `prepare` is where the
            // skeleton promises the reads are tracked.
            //
            // Guarded on `tracks.length` to keep the dependency exactly as
            // narrow as it was: with every matched track over its limit there is
            // nothing to fetch, and a pan should not spin the rotation to fetch
            // it.
            const regionsPerView = tracks.length
              ? self.views.map(view => view.staticBlocks.contentBlocks)
              : []
            return { tracks, regionsPerView }
          },
          // One fan-out slot per track, so the N of them aggregate into one bar
          // rather than the first to finish blanking the label.
          //
          // **Each slot is then rebuilt as a context on its own TRACK**, and
          // that is not decoration: `rpcSessionId` is declared by
          // `BaseTrackModel` and by nothing above it, so `callRpc` on the
          // context the skeleton hands a VIEW has no session id to resolve and
          // throws. A view-level fetch reaching an RPC has to root its context
          // on the track it is fetching for.
          run: async (
            { tracks, regionsPerView },
            ctx,
          ): Promise<Record<string, Feature[][]>> => {
            const perTrack = fanOutStatus(ctx, tracks.length)
            return Object.fromEntries(
              await Promise.all(
                tracks.map(
                  async (track, i) =>
                    [
                      track.configuration.trackId,
                      await getBlockFeatures(
                        track,
                        regionsPerView,
                        makeFetchContext(track, perTrack[i]!),
                      ),
                    ] as const,
                ),
              ),
            )
          },
          commit: fetched => {
            self.setMatchedTrackFeatures(fetched)
          },
          // This view holds no error slot, so a failure is a session
          // notification — carrying the Retry that makes `reload()` the real
          // thing the skeleton's `reloadCounter` read exists for. `getSession`
          // also throws on a dead node, which is why only a current run's real
          // failure reaches here at all.
          setError: error => {
            if (error !== undefined) {
              getNotificationSink(self).notifyError(
                `${error}`,
                error,
                undefined,
                {
                  name: 'Retry',
                  onClick: () => {
                    self.reload()
                  },
                },
              )
            }
          },
        })
      },

      /**
       * #method
       */
      menuItems() {
        return [
          ...self.views.map((view, idx) => ({
            label: `Row ${idx + 1} view menu`,
            subMenu: view.menuItems(),
          })),

          ...(self.views.length > 1
            ? [
                {
                  label: 'Reverse view order',
                  onClick: () => {
                    self.reverseViewOrder()
                  },
                },
                {
                  label: 'Square view',
                  icon: CropFreeIcon,
                  onClick: () => {
                    if (self.initialized) {
                      self.squareView()
                    }
                  },
                },
              ]
            : []),
          {
            label: 'Show...',
            icon: VisibilityIcon,
            subMenu: [
              {
                label: 'Show header',
                type: 'checkbox',
                checked: self.showHeader,
                // opts out of the checkbox "stay open" default: this menu is
                // rendered by a button in the very header the row hides, so
                // staying open would leave it anchored to a removed node
                keepMenuOpen: false,
                onClick: () => {
                  self.setShowHeader(!self.showHeader)
                },
              },
              {
                label: 'Show intra-view links',
                type: 'checkbox',
                checked: self.showIntraviewLinks,
                onClick: () => {
                  self.setShowIntraviewLinks(!self.showIntraviewLinks)
                },
              },
              {
                label: 'Allow clicking alignment squiggles',
                type: 'checkbox',
                checked: self.interactiveOverlay,
                onClick: () => {
                  self.setInteractiveOverlay(!self.interactiveOverlay)
                },
              },
            ],
          },
          {
            label: 'Export SVG',
            icon: PhotoCamera,
            onClick: () => {
              getDialogHost(self).queueDialog(handleClose => [
                ExportSvgDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
        ]
      },

      /**
       * #method
       */
      rubberBandMenuItems() {
        return [
          {
            label: 'Zoom to region(s)',
            onClick: () => {
              for (const view of self.views) {
                const { leftOffset, rightOffset } = view
                if (leftOffset && rightOffset) {
                  view.moveTo(leftOffset, rightOffset)
                }
              }
            },
          },
        ]
      },
    }))
    .postProcessSnapshot(snap => {
      // init is transient: redundant once views materialize, so strip it then.
      // But while views is still empty (a snapshot taken before the init
      // autorun runs setViews) init is the only thing that can rebuild the view
      // -> keep it so a reload/restore resumes instead of dropping to the
      // import form.
      if (snap.views.length) {
        const { init, ...rest } = snap
        return rest
      }
      return snap
    })
}

export type BreakpointViewStateModel = ReturnType<typeof stateModelFactory>
export type BreakpointViewModel = Instance<BreakpointViewStateModel>
