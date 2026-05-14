import { readConfObject } from '@jbrowse/core/configuration'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { getSession } from '@jbrowse/core/util'
import { parseGFA } from '@jbrowse/graph-core'
import { addDisposer, flow, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { layoutGFA } from '../layout/gfaToTubeMap.ts'

import type { TubeMapLayout } from '../layout/types.ts'

const MIN_ZOOM = 0.05
const MAX_ZOOM = 20
export const CANVAS_HEIGHT = 500

// Hard size cap shared with GraphGenomeView (adr-027). `vg find` subgraph
// extraction is sub-second up to ~100 kb; past this the view declines with a
// "zoom in" message rather than attempting a degraded render.
const MAX_GRAPH_REGION_BP = 100_000

interface GraphRegion {
  refName: string
  assemblyName: string
  start: number
  end: number
}

function clampZoom(zoom: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

export default function stateModelFactory() {
  return types
    .compose(
      'TubeMapView',
      BaseViewModel,
      types.model({
        type: types.literal('TubeMapView'),
        // Persisted so a track-launched view can refetch its subgraph after a
        // session reload — the layout itself is volatile (Sets, typed arrays).
        loadedTrackId: types.optional(types.string, ''),
        loadedRegion: types.maybe(types.frozen<GraphRegion>()),
      }),
    )
    .volatile(() => ({
      layout: undefined as TubeMapLayout | undefined,
      graphName: '',
      error: undefined as string | undefined,
      statusMessage: '',
      isLoading: false,
      scale: 1,
      translateX: 0,
      translateY: 0,
      hoveredNode: null as number | null,
      hoveredTrack: null as number | null,
      selectedNode: null as number | null,
      widthPerBp: 10,
      // Set once the user pans/zooms; suppresses the auto zoom-to-fit autorun
      // so a resize doesn't snap the view back.
      hasManualTransform: false,
    }))
    .views(self => ({
      get hasLayout() {
        return self.layout !== undefined
      },
      get nodeCount() {
        return self.layout?.nodes.length ?? 0
      },
      get trackCount() {
        return self.layout?.tracks.length ?? 0
      },
    }))
    .actions(self => ({
      setError(error: unknown) {
        self.error = error === undefined ? undefined : `${error}`
        self.isLoading = false
      },
      setStatusMessage(message: string) {
        self.statusMessage = message
      },
      setHoveredNode(idx: number | null) {
        self.hoveredNode = idx
      },
      setHoveredTrack(idx: number | null) {
        self.hoveredTrack = idx
      },
      setSelectedNode(idx: number | null) {
        self.selectedNode = idx
      },
      setTransform(s: number, tx: number, ty: number) {
        self.scale = clampZoom(s)
        self.translateX = tx
        self.translateY = ty
        self.hasManualTransform = true
      },
      zoom(factor: number, centerX: number, centerY: number) {
        const newScale = clampZoom(self.scale * factor)
        const ratio = newScale / self.scale
        self.scale = newScale
        self.translateX = centerX - (centerX - self.translateX) * ratio
        self.translateY = centerY - (centerY - self.translateY) * ratio
        self.hasManualTransform = true
      },
      zoomToFit(containerHeight: number) {
        if (self.layout && self.layout.maxX > 0 && self.layout.maxY > 0) {
          const padding = 40
          const scaleX = (self.width - padding * 2) / self.layout.maxX
          const scaleY = (containerHeight - padding * 2) / self.layout.maxY
          const newScale = clampZoom(Math.min(scaleX, scaleY))
          self.scale = newScale
          self.translateX =
            padding +
            (self.width - padding * 2 - self.layout.maxX * newScale) / 2
          self.translateY =
            padding +
            (containerHeight - padding * 2 - self.layout.maxY * newScale) / 2
        }
      },
      clearGraph() {
        self.layout = undefined
        self.graphName = ''
        self.error = undefined
        self.statusMessage = ''
        self.isLoading = false
        self.hoveredNode = null
        self.hoveredTrack = null
        self.selectedNode = null
        self.hasManualTransform = false
        self.loadedTrackId = ''
        self.loadedRegion = undefined
      },
    }))
    .actions(self => {
      // Parse + lay out a GFA string on the main thread. The tube-map lane
      // layout is a handful of array passes (unlike GraphGenomeView's OGDF
      // force-directed layout, which needs a worker), so it stays inline.
      function applyGFA(text: string, name: string) {
        self.graphName = name
        self.layout = layoutGFA(parseGFA(text), self.widthPerBp)
        self.hasManualTransform = false
        self.error = undefined
        self.statusMessage = ''
        self.isLoading = false
      }

      function* doSubgraphLoad(
        adapterConfig: Record<string, unknown>,
        region: GraphRegion,
        opts: { context?: number } = {},
      ) {
        const regionSize = region.end - region.start
        if (regionSize > MAX_GRAPH_REGION_BP) {
          self.layout = undefined
          self.error = `Region too large (${Math.round(regionSize / 1000)} kb) — zoom in to view graph (max ${MAX_GRAPH_REGION_BP / 1000} kb)`
          self.isLoading = false
          return
        }
        self.isLoading = true
        self.error = undefined
        self.statusMessage = 'Fetching subgraph'
        try {
          const { rpcManager } = getSession(self)
          const sessionId = 'tube-map'
          const gfaText = (yield rpcManager.call(sessionId, 'GetSubgraph', {
            adapterConfig,
            region,
            sessionId,
            opts: { context: opts.context },
          })) as string
          if (!gfaText) {
            throw new Error(
              'Adapter returned no GFA — region may be outside indexed data or the adapter does not implement getSubgraph',
            )
          }
          applyGFA(
            gfaText,
            `${region.refName}:${region.start.toLocaleString()}-${region.end.toLocaleString()}`,
          )
        } catch (e) {
          console.error('[TubeMapView.loadFromTabixSubgraph]', e)
          self.error = `${e}`
          self.isLoading = false
        }
      }

      return {
        loadGFA(text: string, name = 'Imported GFA') {
          self.loadedTrackId = ''
          self.loadedRegion = undefined
          self.isLoading = true
          self.error = undefined
          try {
            applyGFA(text, name)
          } catch (e) {
            console.error('[TubeMapView.loadGFA]', e)
            self.error = `${e}`
            self.isLoading = false
          }
        },
        loadFromTabixSubgraph: flow(function* (
          adapterConfig: Record<string, unknown>,
          region: GraphRegion,
          opts: { context?: number; trackId?: string } = {},
        ) {
          self.loadedTrackId = opts.trackId ?? ''
          self.loadedRegion = opts.trackId ? region : undefined
          yield* doSubgraphLoad(adapterConfig, region, opts)
        }),
        refetchIfNeeded: flow(function* () {
          if (!self.loadedTrackId || !self.loadedRegion || self.layout) {
            return
          }
          const track = getSession(self).tracks.find(
            t => t.trackId === self.loadedTrackId,
          )
          if (track) {
            const adapterConfig = readConfObject(track, 'adapter')
            yield* doSubgraphLoad(adapterConfig, self.loadedRegion, {})
          } else {
            self.error = `Track '${self.loadedTrackId}' no longer exists in this session — reload the track to view this graph`
            self.isLoading = false
          }
        }),
      }
    })
    .actions(self => ({
      afterAttach() {
        // Auto zoom-to-fit once a layout exists and the view has a real width.
        // loadGFA is called with the default 800px width before the view is
        // measured; re-running on width changes catches the real width, while
        // hasManualTransform stops it once the user has panned/zoomed.
        addDisposer(
          self,
          autorun(() => {
            const { layout, width, hasManualTransform } = self
            if (layout && width > 0 && !hasManualTransform) {
              self.zoomToFit(CANVAS_HEIGHT)
            }
          }),
        )
        void self.refetchIfNeeded()
      },
    }))
}

export type TubeMapViewModel = ReturnType<
  ReturnType<typeof stateModelFactory>['create']
>
