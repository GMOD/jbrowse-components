import { GpuBackendLifecycleSlotMixin } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'
import { addDisposer, flow, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import { convertGFAToGraph } from '../gfa/gfaConverter.ts'
import { parseGFA } from '../gfa/gfaParser.ts'
import {
  brightenColors,
  buildGeometry,
  extractColorSlice,
} from '../renderer/GeometryBuilder.ts'

import type { GraphRenderer } from '../renderer/GraphRenderer.ts'
import type { SubBatchKey, VertexRange } from '../renderer/types.ts'
import type { ColorScheme, Graph, LayoutResult } from '../types.ts'

const DEFAULT_CANVAS_HEIGHT = 600
const HOVER_BRIGHTEN = 1.4
const SELECT_BRIGHTEN = 1.6
const VIEWPORT_DEBOUNCE_MS = 150

const MIN_ZOOM = 0.001
const MAX_ZOOM = 100

function clampZoom(zoom: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

function computeViewportBounds(model: {
  translateX: number
  translateY: number
  width: number
  scale: number
  canvasHeight: number
}) {
  const padding = 0.2
  const minX = -model.translateX / model.scale
  const minY = -model.translateY / model.scale
  const maxX = (model.width - model.translateX) / model.scale
  const maxY = (model.canvasHeight - model.translateY) / model.scale
  const w = maxX - minX
  const h = maxY - minY
  return {
    minX: minX - w * padding,
    minY: minY - h * padding,
    maxX: maxX + w * padding,
    maxY: maxY + h * padding,
  }
}

function restoreVertexColors<K extends string | number>(
  renderer: GraphRenderer,
  target: SubBatchKey,
  ranges: Map<K, VertexRange> | undefined,
  baseColors: Uint32Array | undefined,
  key: K | null,
) {
  if (key !== null && ranges && baseColors) {
    const range = ranges.get(key)
    if (range) {
      renderer.updateSubBatchColors(
        target,
        extractColorSlice(baseColors, range),
        range.start,
      )
    }
  }
}

function brightenVertexColors<K extends string | number>(
  renderer: GraphRenderer,
  target: SubBatchKey,
  ranges: Map<K, VertexRange> | undefined,
  baseColors: Uint32Array | undefined,
  key: K | null,
  factor: number,
) {
  if (key !== null && ranges && baseColors) {
    const range = ranges.get(key)
    if (range) {
      renderer.updateSubBatchColors(
        target,
        brightenColors(baseColors, range, factor),
        range.start,
      )
    }
  }
}

export default function stateModelFactory() {
  return types
    .compose(
      'GraphGenomeView',
      BaseViewModel,
      GpuBackendLifecycleSlotMixin(),
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
      canvasHeight: DEFAULT_CANVAS_HEIGHT,
      viewportDirty: 0,
      nodeVertexRanges: undefined as Map<string, VertexRange> | undefined,
      edgeVertexRanges: undefined as Map<number, VertexRange> | undefined,
      arrowVertexRanges: undefined as Map<number, VertexRange> | undefined,
      baseNodeColors: undefined as Uint32Array | undefined,
      baseEdgeColors: undefined as Uint32Array | undefined,
      baseArrowColors: undefined as Uint32Array | undefined,
      draggingNode: null as string | null,
      viewportDirtyTimer: undefined as
        | ReturnType<typeof setTimeout>
        | undefined,
    }))
    .views(self => ({
      get nodeById() {
        return self.graph
          ? new Map(self.graph.nodes.map(n => [n.id, n] as const))
          : undefined
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
      setDraggingNode(nodeId: string | null) {
        self.draggingNode = nodeId
      },
      showNodeDetails(nodeId: string) {
        const node = self.nodeById?.get(nodeId)
        if (node) {
          const session = getSession(self)
          if (isSessionModelWithWidgets(session)) {
            session.showWidget(
              session.addWidget('BaseFeatureWidget', 'baseFeature', {
                featureData: {
                  id: node.id,
                  name: node.name,
                  length: node.length,
                  depth: node.depth,
                },
              }),
            )
          }
        }
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
      setCanvasHeight(height: number) {
        self.canvasHeight = height
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
      zoomToFit() {
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
        const scaleY = (self.canvasHeight - padding * 2) / graphHeight
        const newScale = clampZoom(Math.min(scaleX, scaleY))
        self.scale = newScale
        self.translateX =
          padding -
          minX * newScale +
          (self.width - padding * 2 - graphWidth * newScale) / 2
        self.translateY =
          padding -
          minY * newScale +
          (self.canvasHeight - padding * 2 - graphHeight * newScale) / 2
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
    .actions(self => ({
      moveNode(nodeId: string, dx: number, dy: number) {
        const positions = self.layoutResult?.nodePositions
        if (positions?.[nodeId]) {
          for (const seg of positions[nodeId]) {
            seg.x += dx
            seg.y += dy
          }
          self.setViewportDirty()
        }
      },
      scheduleViewportDirty() {
        clearTimeout(self.viewportDirtyTimer)
        self.viewportDirtyTimer = setTimeout(() => {
          if (isAlive(self)) {
            self.setViewportDirty()
          }
        }, VIEWPORT_DEBOUNCE_MS)
      },
    }))
    .actions(self => ({
      startGpuBackendLifecycle(backend: GraphRenderer) {
        if (!self.gpuAutorunsInstalled) {
          // Autorun: zoom to fit when a new layout result arrives (skip first run)
          let firstLayout = true
          addDisposer(
            self,
            autorun(() => {
              const lr = self.layoutResult
              if (firstLayout) {
                firstLayout = false
              } else if (lr) {
                self.zoomToFit()
              }
            }),
          )

          // Autorun: debounce viewport dirty flag on pan/zoom (skip first run)
          let firstViewport = true
          addDisposer(
            self,
            autorun(() => {
              void self.scale
              void self.translateX
              void self.translateY
              if (firstViewport) {
                firstViewport = false
              } else {
                self.scheduleViewportDirty()
              }
            }),
          )

          // Autorun: hover/select color-only updates — no geometry rebuild
          let prevHoveredNode: string | null = null
          let prevHoveredEdge: number | null = null
          let prevSelectedNode: string | null = null
          addDisposer(
            self,
            autorun(() => {
              const b = self.currentGpuBackend as GraphRenderer | undefined
              const hoveredNode = self.hoveredNode
              const hoveredEdge = self.hoveredEdge
              const selectedNode = self.selectedNode
              if (b) {
                restoreVertexColors(
                  b,
                  'nodes',
                  self.nodeVertexRanges,
                  self.baseNodeColors,
                  prevHoveredNode,
                )
                if (prevSelectedNode !== prevHoveredNode) {
                  restoreVertexColors(
                    b,
                    'nodes',
                    self.nodeVertexRanges,
                    self.baseNodeColors,
                    prevSelectedNode,
                  )
                }
                restoreVertexColors(
                  b,
                  'edges',
                  self.edgeVertexRanges,
                  self.baseEdgeColors,
                  prevHoveredEdge,
                )
                restoreVertexColors(
                  b,
                  'arrows',
                  self.arrowVertexRanges,
                  self.baseArrowColors,
                  prevHoveredEdge,
                )

                brightenVertexColors(
                  b,
                  'nodes',
                  self.nodeVertexRanges,
                  self.baseNodeColors,
                  selectedNode,
                  SELECT_BRIGHTEN,
                )
                if (hoveredNode !== selectedNode) {
                  brightenVertexColors(
                    b,
                    'nodes',
                    self.nodeVertexRanges,
                    self.baseNodeColors,
                    hoveredNode,
                    HOVER_BRIGHTEN,
                  )
                }
                brightenVertexColors(
                  b,
                  'edges',
                  self.edgeVertexRanges,
                  self.baseEdgeColors,
                  hoveredEdge,
                  HOVER_BRIGHTEN,
                )
                brightenVertexColors(
                  b,
                  'arrows',
                  self.arrowVertexRanges,
                  self.baseArrowColors,
                  hoveredEdge,
                  HOVER_BRIGHTEN,
                )

                prevHoveredNode = hoveredNode
                prevHoveredEdge = hoveredEdge
                prevSelectedNode = selectedNode

                self.renderNow()
              }
            }),
          )
        }

        self.installGpuDisplay<GraphRenderer>(backend, {
          // Autorun: rebuild geometry when graph data or display options change.
          // scale/translate are untracked so they don't trigger a full rebuild —
          // only the debounced viewportDirty flag does.
          upload: b => {
            const start = performance.now()
            b.resize(self.width, self.canvasHeight)
            const nodeById = self.nodeById
            if (self.nodePositions && self.graph && nodeById) {
              void self.viewportDirty
              const buildStart = performance.now()
              const batch = buildGeometry({
                nodePositions: self.nodePositions,
                graph: self.graph,
                nodeById,
                colorScheme: self.colorScheme,
                contigThickness: self.contigThickness,
                connectorThickness: self.connectorThickness,
                drawPaths: self.drawPaths,
                scale: self.scale,
                viewportBounds: untracked(() => computeViewportBounds(self)),
              })

              const buildEnd = performance.now()

              self.storeRenderBatchMeta(
                batch.nodeVertexRanges,
                batch.edgeVertexRanges,
                batch.arrowVertexRanges,
                batch.nodes.colors,
                batch.edges.colors,
                batch.arrows.colors,
              )

              const uploadStart = performance.now()
              b.uploadGeometry(batch)
              const uploadEnd = performance.now()

              if (self.draggingNode) {
                console.log(
                  `[Graph Performance] Rebuilding geometry for DRAG. ` +
                    `Nodes: ${self.nodeCount}, Edges: ${self.edgeCount}. ` +
                    `Build: ${(buildEnd - buildStart).toFixed(2)}ms, ` +
                    `Upload: ${(uploadEnd - uploadStart).toFixed(2)}ms, ` +
                    `Total: ${(performance.now() - start).toFixed(2)}ms`,
                )
              }
            }
          },
          // Autorun: re-render on pan/zoom/darkMode without rebuilding geometry
          render: b => {
            if (!self.nodePositions) {
              return false
            }
            const dpr = window.devicePixelRatio || 1
            b.updateTransform({
              scaleX: self.scale * dpr,
              scaleY: self.scale * dpr,
              translateX: self.translateX * dpr,
              translateY: self.translateY * dpr,
              viewportWidth: self.width * dpr,
              viewportHeight: self.canvasHeight * dpr,
            })
            b.render(self.darkMode ? [0.12, 0.12, 0.12, 1] : [1, 1, 1, 1])
            return true
          },
        })
      },
    }))
    .actions(self => {
      function callLayout(graph: Graph) {
        const session = getSession(self)
        const { rpcManager } = session
        const sessionId = 'graph' // getRpcSessionId(self) no 'rpcSessionId' getter
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

      function* parseAndLayout(text: string, name: string) {
        self.setStatusMessage('Parsing GFA')
        const gfaGraph = parseGFA(text)
        const graph = convertGFAToGraph(gfaGraph, name)
        self.graph = graph
        self.setStatusMessage('Computing layout')
        const { result } = (yield callLayout(graph)) as { result: LayoutResult }
        if (self.graph === graph) {
          self.layoutResult = result
        }
      }

      return {
        loadGFA: flow(function* (text: string, name = 'Imported GFA') {
          self.isLoading = true
          self.error = undefined
          try {
            yield* parseAndLayout(text, name)
          } catch (e) {
            console.error('[GraphGenomeView.loadGFA]', e)
            self.error = e
          } finally {
            self.isLoading = false
          }
        }),
        loadFromTabixSubgraph: flow(function* (
          adapterConfig: Record<string, unknown>,
          region: {
            refName: string
            assemblyName: string
            start: number
            end: number
          },
        ) {
          self.isLoading = true
          self.error = undefined
          self.setStatusMessage('Fetching subgraph')
          try {
            const session = getSession(self)
            const { rpcManager } = session
            const sessionId = 'graph' // getRpcSessionId(self) no rpcSessionId getter
            const gfaText = (yield rpcManager.call(sessionId, 'GetSubgraph', {
              adapterConfig,
              region,
              sessionId,
            })) as string
            if (!gfaText) {
              throw new Error(
                'Adapter returned no GFA — region may be outside indexed data or the adapter does not implement getSubgraph',
              )
            }
            const label = `${region.refName}:${region.start.toLocaleString()}-${region.end.toLocaleString()}`
            yield* parseAndLayout(gfaText, label)
          } catch (e) {
            console.error('[GraphGenomeView.loadFromTabixSubgraph]', e)
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
