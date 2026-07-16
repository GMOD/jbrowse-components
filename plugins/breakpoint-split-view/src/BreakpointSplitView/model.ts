import { lazy } from 'react'

import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { avg, getSession, notEmpty } from '@jbrowse/core/util'
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
} from './components/util.ts'
import {
  VIEW_DIVIDER_HEIGHT,
  calc,
  computeOverlayY,
  findFeatureViewLevel,
  getBlockFeatures,
  intersect,
  makeOffscreenLayout,
} from './util.ts'

import type {
  BreakpointSplitViewInitView,
  ExportSvgOptions,
  LayoutRecord,
  OverlayLevel,
  OverlayMatch,
} from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'
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
        trackSelectorType: types.stripDefault(types.string, 'hierarchical'),
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
      get matchedTracks() {
        return self.views.length === 1
          ? self.views[0]!.tracks
          : intersect(
              elt => elt.configuration.trackId,
              ...self.views.map(
                view => view.tracks as { configuration: { trackId: string } }[],
              ),
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
      getMatchedTracks(trackConfigId: string) {
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
          })
          viewTop += view.height + VIEW_DIVIDER_HEIGHT
        }

        function getY(level: number, layout: LayoutRecord) {
          return computeOverlayY({ ...levels[level]!, layout })
        }

        function getX(level: number, refName: string, coord: number) {
          const offsetPx = views[level]!.bpToPx({ refName, coord })?.offsetPx
          return offsetPx === undefined
            ? undefined
            : offsetPx - levels[level]!.offsetPx
        }

        return { tracks, levels, getX, getY }
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
              // Feature wasn't found in any track's pileup layout — usually the
              // display keeps no layout at all (the paired/arc displays),
              // filterBy excluded it, the alignments display's maxHeight pushed
              // it off the bottom, or it hasn't loaded yet. Synthesize an
              // off-display LayoutRecord so the connection still draws to the
              // track's bottom edge (see makeOffscreenLayout / getY).
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
              return level === undefined
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
       * Zero-arg cached getter: classifies each matched track, pairs its
       * features, looks up layout rectangles, and returns a Map keyed by
       * trackId. Mobx caches this across renders and only invalidates when
       * the underlying feature or layout reads change — so horizontal/vertical
       * scrolling and track resizing do NOT trigger re-pairing or re-lookup.
       */
      get overlayMatches(): Map<string, OverlayMatch> {
        const result = new Map<string, OverlayMatch>()
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
            const layoutMatches = this.getMatchedFeaturesInLayout(
              trackId,
              matched,
            )
            if (!paired) {
              for (const m of layoutMatches) {
                m.sort(
                  (a, b) =>
                    a.clipLengthAtStartOfRead - b.clipLengthAtStartOfRead,
                )
                markHiddenSegments(m)
              }
            }
            result.set(trackId, {
              kind: 'alignment',
              allFeatures,
              layoutMatches,
              hasPairedReads: paired,
            })
          } else if (type === 'VariantTrack') {
            const kind = classifyVariantFeatures(allFeatures)
            const matched =
              kind === 'translocation'
                ? getMatchedTranslocationFeatures(allFeatures)
                : kind === 'paired'
                  ? getMatchedPairedFeatures(allFeatures)
                  : getMatchedBreakendFeatures(allFeatures)
            result.set(trackId, {
              kind,
              allFeatures,
              layoutMatches: this.getMatchedFeaturesInLayout(trackId, matched),
            })
          }
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
        addDisposer(
          self,
          autorun(
            async () => {
              try {
                if (!self.views.every(view => view.initialized)) {
                  return
                }
                if (
                  self.matchedTracks.some(track => {
                    const display = track.displays[0]
                    return display.notReady?.() || display.regionTooLarge
                  })
                ) {
                  return
                }

                self.setMatchedTrackFeatures(
                  Object.fromEntries(
                    await Promise.all(
                      self.matchedTracks.map(async track => [
                        track.configuration.trackId,
                        await getBlockFeatures(self, track),
                      ]),
                    ),
                  ),
                )
              } catch (e) {
                console.error(e)
                getSession(self).notifyError(`${e}`, e)
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
