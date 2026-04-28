import { lazy } from 'react'

import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { avg, getSession, notEmpty } from '@jbrowse/core/util'
import {
  addDisposer,
  addMiddleware,
  cast,
  getPath,
  types,
} from '@jbrowse/mobx-state-tree'
import CropFreeIcon from '@mui/icons-material/CropFree'
import PhotoCamera from '@mui/icons-material/PhotoCamera'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { autorun } from 'mobx'

import {
  classifyVariantFeatures,
  getBadlyPairedAlignments,
  getMatchedAlignmentFeatures,
  getMatchedBreakendFeatures,
  getMatchedPairedFeatures,
  getMatchedTranslocationFeatures,
  hasPairedReads,
} from './components/util.ts'
import {
  VIEW_DIVIDER_HEIGHT,
  calc,
  getBlockFeatures,
  intersect,
} from './util.ts'

type Compactness = 'normal' | 'compact' | 'super-compact'

// SYNC: plugins/linear-genome-view/src/LinearGenomeView/menuItems.ts, plugins/linear-comparative-view/src/LinearComparativeView/model.ts
function buildCompactAllTracksMenu(tracks: { displays: unknown[] }[]) {
  const hasAny = tracks.some(t =>
    t.displays.some(
      d => d !== null && typeof d === 'object' && 'setCompactness' in d,
    ),
  )
  if (!hasAny) {
    return []
  }
  function applyCompactness(level: Compactness) {
    for (const track of tracks) {
      for (const display of track.displays) {
        if (
          display !== null &&
          typeof display === 'object' &&
          'setCompactness' in display
        ) {
          ;(
            display as { setCompactness: (v: Compactness) => void }
          ).setCompactness(level)
        }
      }
    }
  }
  return [
    {
      label: 'Compact all tracks',
      subMenu: [
        {
          label: 'Normal',
          onClick: () => {
            applyCompactness('normal')
          },
        },
        {
          label: 'Compact',
          onClick: () => {
            applyCompactness('compact')
          },
        },
        {
          label: 'Super-compact',
          onClick: () => {
            applyCompactness('super-compact')
          },
        },
      ],
    },
  ]
}

import type {
  BreakpointSplitViewInit,
  ExportSvgOptions,
  LayoutRecord,
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
 * extends
 * - [BaseViewModel](../baseviewmodel)
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
        height: types.optional(types.number, defaultHeight),
        /**
         * #property
         */
        trackSelectorType: 'hierarchical',
        /**
         * #property
         */
        showIntraviewLinks: true,
        /**
         * #property
         */
        linkViews: false,
        /**
         * #property
         */
        interactiveOverlay: true,
        /**
         * #property
         */
        showHeader: true,
        /**
         * #property
         */
        views: types.array(
          pluginManager.getViewType('LinearGenomeView')!
            .stateModel as LinearGenomeViewStateModel,
        ),
        /**
         * #property
         * used for initializing the view from a session snapshot
         */
        init: types.frozen<BreakpointSplitViewInit | undefined>(),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      width: 800,
      /**
       * #volatile
       */

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      matchedTrackFeatures: {} as Record<string, Feature[][]>,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get hasSomethingToShow() {
        return self.views.length > 0 || !!self.init
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
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const { saveAs } = await import('file-saver-es')

        if (opts.format === 'png') {
          const img = new Image()
          const svgBlob = new Blob([html], { type: 'image/svg+xml' })
          const url = URL.createObjectURL(svgBlob)
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const canvas = document.createElement('canvas')
              canvas.width = img.width
              canvas.height = img.height
              const ctx = canvas.getContext('2d')!
              ctx.drawImage(img, 0, 0)
              URL.revokeObjectURL(url)
              canvas.toBlob(blob => {
                if (blob) {
                  saveAs(blob, opts.filename || 'image.png')
                  resolve()
                } else {
                  reject(
                    new Error(
                      `Failed to create PNG. The image may be too large (${img.width}x${img.height}). Try reducing the view size or use SVG format.`,
                    ),
                  )
                }
              }, 'image/png')
            }
            img.onerror = () => {
              URL.revokeObjectURL(url)
              reject(new Error('Failed to load SVG for PNG conversion'))
            }
            img.src = url
          })
        } else {
          saveAs(
            new Blob([html], { type: 'image/svg+xml' }),
            opts.filename || 'image.svg',
          )
        }
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
       * Get tracks with a given trackId across multiple views
       */
      getMatchedTracks(trackConfigId: string) {
        return self.views
          .map(view => view.getTrack(trackConfigId))
          .filter(notEmpty)
      },

      /**
       * #method
       * Get a composite map of featureId-\>feature map for a track across
       * multiple views
       */
      getTrackFeatures(trackConfigId: string) {
        return new Map(
          self.matchedTrackFeatures[trackConfigId]
            ?.flat()
            .map(f => [f.id(), f] as const),
        )
      },

      /**
       * #method
       * Per-render precompute for an overlay track: in a single O(views ×
       * tracks) pass, gathers every reactive value the overlay loop needs
       * (per-level track top, scroll top, display height, coverage offset,
       * view offsetPx) into plain arrays, plus closures that do the hot-path
       * math with array indexing only. Call once at the top of an observer
       * render; the observer subscribes to every reactive read performed here
       * so re-renders fire on any relevant change.
       *
       * Pass `yOffsetsOverride` during SVG export to substitute fixed track
       * tops and disable scroll compensation.
       */
      getTrackOverlayData(trackId: string, yOffsetsOverride?: number[]) {
        const { views } = self
        const tracks = this.getMatchedTracks(trackId)
        const n = views.length
        const scrollTops = new Array(n)
        const heights = new Array(n)
        const coverageOffsets = new Array(n)
        const viewOffsetPxs = new Array(n)
        const yOffsets = yOffsetsOverride ?? new Array(n)

        let viewTop = 0
        for (let level = 0; level < n; level++) {
          const view = views[level]!
          const d = tracks[level]!.displays[0]!
          scrollTops[level] = yOffsetsOverride ? 0 : (d.scrollTop ?? 0)
          heights[level] = d.height
          coverageOffsets[level] = d.coverageDisplayHeight ?? 0
          viewOffsetPxs[level] = view.offsetPx

          if (!yOffsetsOverride) {
            yOffsets[level] = viewTop + (view.getTrackYOffset(trackId) ?? 0)
          }
          if (level < n - 1) {
            viewTop += view.height + VIEW_DIVIDER_HEIGHT
          }
        }

        function getY(level: number, c: LayoutRecord) {
          const off = coverageOffsets[level]
          const top = c[1]
          const bot = c[3]
          const mid = top - scrollTops[level] + (bot - top) / 2 + off
          const max = heights[level]
          return yOffsets[level] + (mid < off ? off : Math.min(mid, max))
        }

        function getX(level: number, refName: string, coord: number) {
          const offsetPx = views[level]!.bpToPx({ refName, coord })?.offsetPx
          return offsetPx !== undefined
            ? offsetPx - viewOffsetPxs[level]
            : undefined
        }

        return { tracks, yOffsets, heights, getX, getY }
      },

      getMatchedFeaturesInLayout(trackConfigId: string, features: Feature[][]) {
        const tracks = this.getMatchedTracks(trackConfigId)
        return features.map(c =>
          c
            .map(feature => {
              for (const [level, track] of tracks.entries()) {
                const layout = calc(track, feature)
                if (layout) {
                  return {
                    feature,
                    layout,
                    level,
                    clipLengthAtStartOfRead:
                      feature.get('clipLengthAtStartOfRead') ?? 0,
                  }
                }
              }
              return undefined
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
            view.centerAt(center.coord, center.refName, center.index)
          }
        }
      },

      /**
       * #action
       */
      setInit(init?: BreakpointSplitViewInit) {
        self.init = init
      },

      /**
       * #action
       */
      setViews(
        viewInits: {
          loc?: string
          assembly: string
          tracks?: string[]
        }[],
      ) {
        self.views = cast(
          viewInits.map(viewInit => ({
            type: 'LinearGenomeView' as const,
            hideHeader: true,
            init: viewInit,
          })),
        )
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          addMiddleware(self, (rawCall, next) => {
            if (rawCall.type === 'action' && rawCall.id === rawCall.rootId) {
              const syncActions = [
                'horizontalScroll',
                'zoomTo',
                'showTrack',
                'toggleTrack',
                'hideTrack',
                'setTrackLabels',
                'toggleCenterLine',
              ]

              if (self.linkViews && syncActions.includes(rawCall.name)) {
                const sourcePath = getPath(rawCall.context)
                next(rawCall)
                for (const view of self.views) {
                  const viewPath = getPath(view)
                  if (viewPath !== sourcePath) {
                    // @ts-expect-error
                    view[rawCall.name](rawCall.args[0])
                  }
                }
                return
              }
            }
            next(rawCall)
          }),
        )
        addDisposer(
          self,
          autorun(
            function breakpointSplitViewInitAutorun() {
              const { init, width } = self
              if (!width || !init) {
                return
              }

              self.setViews(init.views)
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
        const allTracks = self.views.flatMap(v => v.tracks)
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
                    self.squareView()
                  },
                },
              ]
            : []),
          {
            label: 'Show...',
            icon: VisibilityIcon,
            subMenu: [
              ...buildCompactAllTracksMenu(allTracks),
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        init,
        height,
        trackSelectorType,
        showIntraviewLinks,
        linkViews,
        interactiveOverlay,
        showHeader,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(height !== 400 ? { height } : {}),
        ...(trackSelectorType !== 'hierarchical' ? { trackSelectorType } : {}),
        ...(!showIntraviewLinks ? { showIntraviewLinks } : {}),
        ...(linkViews ? { linkViews } : {}),
        ...(!interactiveOverlay ? { interactiveOverlay } : {}),
        ...(!showHeader ? { showHeader } : {}),
      } as typeof snap
    })
}

export type BreakpointViewStateModel = ReturnType<typeof stateModelFactory>
export type BreakpointViewModel = Instance<BreakpointViewStateModel>
