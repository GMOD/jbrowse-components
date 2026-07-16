import { lazy } from 'react'

import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { avg, getSession, notEmpty } from '@jbrowse/core/util'
import { layoutBpToPx } from '@jbrowse/core/util/Base1DUtils'
import { addDisposer, cast, isAlive, types } from '@jbrowse/mobx-state-tree'
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
} from './components/util.ts'
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
  OverlayMatch,
} from './types.ts'
import type { OverlayTrack } from './util.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'
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
         */
        height: types.stripDefault(types.number, defaultHeight),
        /**
         * #property
         */
        showIntraviewLinks: types.stripDefault(types.boolean, true),
        /**
         * #property
         */
        linkViews: types.stripDefault(types.boolean, false),
        /**
         * #property
         */
        interactiveOverlay: types.stripDefault(types.boolean, true),
        /**
         * #property
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
    }>(() => ({
      /**
       * #volatile
       */
      width: 800,
      /**
       * #volatile
       */

      matchedTrackFeatures: {},
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
       */
      get showImportForm() {
        return !this.hasSomethingToShow
      },

      /**
       * #getter
       */
      get assembly() {
        const name = self.views[0]?.assemblyNames[0]
        if (name) {
          return getSession(self).assemblyManager.get(name)
        }
        return undefined
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
        const { saveSvgAsImage } = await import('@jbrowse/core/util')
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
        domYOffsets?: number[],
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
              // adapter refName has to be canonicalized first or an aliased
              // one (bedpe 'A' vs the view's 'ctgA') resolves to no level and
              // the feature is dropped. The drawing side canonicalizes too,
              // via getCanonicalRefPair.
              const level = findFeatureViewLevel(
                views,
                self.assembly?.getCanonicalRefName(feature.get('refName')) ??
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
        getSession(self).setScrollZoom?.(arg)
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
        // Staleness epoch for the fetcher below — FetchMixin's `isStale` shape,
        // reimplemented because a view can't compose that display mixin. RPC
        // latency varies with viewport size, so two runs can resolve out of
        // order and the loser would commit features for a viewport already left.
        // The 1s debounce spaces runs out; it doesn't order their completions.
        let fetchGeneration = 0
        addDisposer(
          self,
          autorun(
            async () => {
              const generation = ++fetchGeneration
              // superseded by a later run, or the view closed mid-fetch
              const isStale = () =>
                generation !== fetchGeneration || !isAlive(self)
              try {
                if (!self.views.every(view => view.initialized)) {
                  return
                }
                // the banner has replaced the features, so there's nothing to
                // match against
                if (
                  self.matchedTracks.some(
                    track => track.displays[0]!.regionTooLarge,
                  )
                ) {
                  return
                }

                const fetched = Object.fromEntries(
                  await Promise.all(
                    self.matchedTracks.map(async track => [
                      track.configuration.trackId,
                      await getBlockFeatures(self, track),
                    ]),
                  ),
                )
                if (!isStale()) {
                  self.setMatchedTrackFeatures(fetched)
                }
              } catch (e) {
                console.error(e)
                // a superseded run's result is discarded either way, so its
                // failure isn't the user's problem — an aborted RPC for a
                // viewport already left would otherwise raise a toast for a
                // fetch nobody is waiting on. getSession also throws on a dead
                // node, turning a handled error into an unhandled one.
                if (!isStale()) {
                  getSession(self).notifyError(`${e}`, e)
                }
              }
            },
            {
              name: 'BreakpointFeatureFetcher',
              delay: 1000,
            },
          ),
        )
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
              getSession(self).queueDialog(handleClose => [
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
