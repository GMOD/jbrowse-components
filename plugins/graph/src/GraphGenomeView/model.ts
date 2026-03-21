import { types } from '@jbrowse/mobx-state-tree'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'

import { parseGFA } from '../gfa/gfaParser.ts'
import { convertGFAToGraph } from '../gfa/gfaConverter.ts'

import type { Graph, LayoutResult, ColorScheme, NodeSegment } from '../types.ts'

const MIN_ZOOM = 0.001
const MAX_ZOOM = 100.0

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
      error: undefined as string | undefined,
      isLoading: false,
      colorScheme: 'uniform' as ColorScheme,
      contigThickness: 5,
      connectorThickness: 1.5,
      darkMode: false,
      hoveredNode: null as string | null,
      hoveredEdge: null as number | null,
      selectedNode: null as string | null,
      scale: 1,
      translateX: 0,
      translateY: 0,
      drawPaths: true,
    }))
    .views(self => ({
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
      get nodePositions(): Record<string, NodeSegment[]> | undefined {
        return self.layoutResult?.nodePositions
      },
      get zoomPercent() {
        return `${(self.scale * 100).toFixed(1)}%`
      },
    }))
    .actions(self => ({
      setGraph(graph: Graph) {
        self.graph = graph
        self.error = undefined
      },
      setLayoutResult(result: LayoutResult) {
        self.layoutResult = result
        self.isLoading = false
      },
      setError(error: string) {
        self.error = error
        self.isLoading = false
      },
      setLoading(loading: boolean) {
        self.isLoading = loading
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
      zoomToFit(canvasHeight: number) {
        if (!self.layoutResult) {
          return
        }
        const positions = self.layoutResult.nodePositions
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity
        for (const segments of Object.values(positions)) {
          for (const seg of segments) {
            if (seg.x < minX) {
              minX = seg.x
            }
            if (seg.y < minY) {
              minY = seg.y
            }
            if (seg.x > maxX) {
              maxX = seg.x
            }
            if (seg.y > maxY) {
              maxY = seg.y
            }
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
          padding - minX * newScale + (self.width - padding * 2 - graphWidth * newScale) / 2
        self.translateY =
          padding - minY * newScale + (canvasHeight - padding * 2 - graphHeight * newScale) / 2
      },
      loadGFA(text: string, name = 'Imported GFA') {
        self.isLoading = true
        self.error = undefined
        const gfaGraph = parseGFA(text)
        self.graph = convertGFAToGraph(gfaGraph, name)
      },
      clearGraph() {
        self.graph = undefined
        self.layoutResult = undefined
        self.error = undefined
        self.hoveredNode = null
        self.hoveredEdge = null
        self.selectedNode = null
      },
    }))
}

export type GraphGenomeViewModel = ReturnType<
  ReturnType<typeof stateModelFactory>['create']
>
