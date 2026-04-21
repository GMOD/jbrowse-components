import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { flow, types } from '@jbrowse/mobx-state-tree'

import { convertGFAToGraph } from '../gfa/gfaConverter.ts'
import { parseGFA } from '../gfa/gfaParser.ts'

import type { VertexRange } from '../renderer/types.ts'
import type {
  ColorScheme,
  Graph,
  GraphNode,
  LayoutResult,
} from '../types.ts'

const MIN_ZOOM = 0.001
const MAX_ZOOM = 100

function clampZoom(zoom: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

export default function stateModelFactory() {
  return types
    .compose(
      'GraphGenomeView',
      BaseViewModel,
      types.model({
        type: types.literal('GraphGenomeView'),
      }),
    )
    .volatile(() => ({
      graph: undefined as Graph | undefined,
      layoutResult: undefined as LayoutResult | undefined,
      error: undefined as unknown,
      isLoading: false,
      statusMessage: '',
      layoutQuality: 1,
      linearLayout: false,
      colorScheme: 'uniform' as ColorScheme,
      contigThickness: 10,
      connectorThickness: 4,
      darkMode: false,
      hoveredNode: null as string | null,
      hoveredEdge: null as number | null,
      selectedNode: null as string | null,
      scale: 1,
      translateX: 0,
      translateY: 0,
      drawPaths: false,
      viewportDirty: 0,
      nodeVertexRanges: undefined as Map<string, VertexRange> | undefined,
      edgeVertexRanges: undefined as Map<number, VertexRange> | undefined,
      arrowVertexRanges: undefined as Map<number, VertexRange> | undefined,
      baseNodeColors: undefined as Uint32Array | undefined,
      baseEdgeColors: undefined as Uint32Array | undefined,
      baseArrowColors: undefined as Uint32Array | undefined,
    }))
    .views(self => ({
      get nodeById(): Map<string, GraphNode> | undefined {
        if (!self.graph) {
          return undefined
        }
        const map = new Map<string, GraphNode>()
        for (const n of self.graph.nodes) {
          map.set(n.id, n)
        }
        return map
      },
      get nodeCount() {
        return self.graph?.nodes.length ?? 0
      },
      get edgeCount() {
        return self.graph?.edges.length ?? 0
      },
      get pathCount() {
        return self.graph?.paths?.length ?? 0
      },
      get hasGraph() {
        return self.graph !== undefined
      },
      get nodePositions() {
        return self.layoutResult?.nodePositions
      },
      get zoomPercent() {
        return `${(self.scale * 100).toFixed(1)}%`
      },
    }))
    .actions(self => ({
      setError(error: unknown) {
        self.error = error
        self.isLoading = false
      },
      setStatusMessage(message: string) {
        self.statusMessage = message
      },
      setLayoutQuality(quality: number) {
        self.layoutQuality = quality
      },
      setLinearLayout(linear: boolean) {
        self.linearLayout = linear
      },
      setDrawPaths(draw: boolean) {
        self.drawPaths = draw
      },
      setColorScheme(scheme: ColorScheme) {
        self.colorScheme = scheme
      },
      setHoveredNode(nodeId: string | null) {
        self.hoveredNode = nodeId
      },
      setHoveredEdge(edgeIdx: number | null) {
        self.hoveredEdge = edgeIdx
      },
      setSelectedNode(nodeId: string | null) {
        self.selectedNode = nodeId
      },
      setTransform(s: number, tx: number, ty: number) {
        self.scale = clampZoom(s)
        self.translateX = tx
        self.translateY = ty
      },
      zoom(factor: number, centerX: number, centerY: number) {
        const newScale = clampZoom(self.scale * factor)
        const ratio = newScale / self.scale
        self.scale = newScale
        self.translateX = centerX - (centerX - self.translateX) * ratio
        self.translateY = centerY - (centerY - self.translateY) * ratio
      },
      setViewportDirty() {
        self.viewportDirty++
      },
      storeRenderBatchMeta(
        nodeVertexRanges: Map<string, VertexRange>,
        edgeVertexRanges: Map<number, VertexRange>,
        arrowVertexRanges: Map<number, VertexRange>,
        baseNodeColors: Uint32Array,
        baseEdgeColors: Uint32Array,
        baseArrowColors: Uint32Array,
      ) {
        self.nodeVertexRanges = nodeVertexRanges
        self.edgeVertexRanges = edgeVertexRanges
        self.arrowVertexRanges = arrowVertexRanges
        self.baseNodeColors = baseNodeColors
        self.baseEdgeColors = baseEdgeColors
        self.baseArrowColors = baseArrowColors
      },
      zoomToFit(canvasHeight: number) {
        if (!self.layoutResult) {
          return
        }
        const positions = self.layoutResult.nodePositions
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const segments of Object.values(positions)) {
          for (const seg of segments) {
            minX = Math.min(minX, seg.x)
            minY = Math.min(minY, seg.y)
            maxX = Math.max(maxX, seg.x)
            maxY = Math.max(maxY, seg.y)
          }
        }
        const graphWidth = maxX - minX
        const graphHeight = maxY - minY
        if (graphWidth <= 0 || graphHeight <= 0) {
          return
        }
        const padding = 40
        const scaleX = (self.width - padding * 2) / graphWidth
        const scaleY = (canvasHeight - padding * 2) / graphHeight
        const newScale = clampZoom(Math.min(scaleX, scaleY))
        self.scale = newScale
        self.translateX =
          padding -
          minX * newScale +
          (self.width - padding * 2 - graphWidth * newScale) / 2
        self.translateY =
          padding -
          minY * newScale +
          (canvasHeight - padding * 2 - graphHeight * newScale) / 2
      },
      clearGraph() {
        self.graph = undefined
        self.layoutResult = undefined
        self.error = undefined
        self.isLoading = false
        self.statusMessage = ''
        self.hoveredNode = null
        self.hoveredEdge = null
        self.selectedNode = null
        self.nodeVertexRanges = undefined
        self.edgeVertexRanges = undefined
        self.arrowVertexRanges = undefined
        self.baseNodeColors = undefined
        self.baseEdgeColors = undefined
        self.baseArrowColors = undefined
      },
    }))
    .actions(self => {
      function callLayout(graph: Graph) {
        const session = getSession(self)
        const { rpcManager } = session
        const sessionId = getRpcSessionId(self)
        return rpcManager.call(sessionId, 'GraphComputeLayout', {
          sessionId,
          graph: { nodes: graph.nodes, edges: graph.edges },
          options: {
            quality: self.layoutQuality,
            linearLayout: self.linearLayout,
          },
          statusCallback: (message: string) => {
            self.setStatusMessage(message)
          },
        }) as Promise<{ result: LayoutResult }>
      }

      return {
        loadGFA: flow(function* (text: string, name = 'Imported GFA') {
          self.isLoading = true
          self.error = undefined
          self.setStatusMessage('Parsing GFA')
          const gfaGraph = parseGFA(text)
          const graph = convertGFAToGraph(gfaGraph, name)
          self.graph = graph
          self.setStatusMessage('Computing layout')

          try {
            const { result } = yield callLayout(graph)
            if (self.graph === graph) {
              self.layoutResult = result
            }
          } catch (e) {
            console.error('[GraphGenomeView.loadGFA] Layout error:', e)
            self.error = e
          } finally {
            self.isLoading = false
          }
        }),
        recomputeLayout: flow(function* () {
          const graph = self.graph
          if (!graph) {
            return
          }
          self.isLoading = true
          self.setStatusMessage('Computing layout')

          try {
            const { result } = yield callLayout(graph)
            if (self.graph === graph) {
              self.layoutResult = result
            }
          } catch (e) {
            self.error = e
          } finally {
            self.isLoading = false
          }
        }),
      }
    })
}

export type GraphGenomeViewModel = ReturnType<
  ReturnType<typeof stateModelFactory>['create']
>
