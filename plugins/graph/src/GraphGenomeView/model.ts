import { readConfObject } from '@jbrowse/core/configuration'
import { GpuBackendLifecycleSlotMixin } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'
import { addDisposer, flow, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import { convertGFAToGraph } from './gfa/gfaConverter.ts'
import { parseGFA } from './gfa/gfaParser.ts'
import {
  brightenColors,
  buildGeometry,
  extractColorSlice,
} from './renderer/GeometryBuilder.ts'
import { COLOR_SCHEMES } from './types.ts'

import type { GraphRenderer } from './renderer/GraphRenderer.ts'
import type { RenderBatch, SubBatchKey, VertexRange } from './renderer/types.ts'
import type { ColorScheme, Graph, GraphNode, LayoutResult } from './types.ts'

export interface SyntenyBlock {
  refStart: number
  refEnd: number
  mateRefName: string
  mateStart: number
  mateEnd: number
  strand: number
  identity: number
}

interface BandageScaleOpts {
  nodeLengthPerMegabase?: number
  minimumNodeLength?: number
  nodeSegmentLength?: number
  edgeLength?: number
}

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
        layoutQuality: types.optional(types.number, 1),
        linearLayout: types.optional(types.boolean, false),
        colorScheme: types.optional(
          types.enumeration([...COLOR_SCHEMES]),
          'uniform',
        ),
        contigThickness: types.optional(types.number, 10),
        connectorThickness: types.optional(types.number, 4),
        darkMode: types.optional(types.boolean, false),
        scale: types.optional(types.number, 1),
        translateX: types.optional(types.number, 0),
        translateY: types.optional(types.number, 0),
        drawPaths: types.optional(types.boolean, false),
        canvasHeight: types.optional(types.number, DEFAULT_CANVAS_HEIGHT),
        loadedTrackId: types.optional(types.string, ''),
        loadedRegion: types.maybe(
          types.frozen<{
            refName: string
            assemblyName: string
            start: number
            end: number
          }>(),
        ),
      }),
    )
    .volatile(() => ({
      graph: undefined as Graph | undefined,
      layoutResult: undefined as LayoutResult | undefined,
      syntenyBlocks: undefined as [string, SyntenyBlock[]][] | undefined,
      largeModeRegion: undefined as
        | { refName: string; start: number; end: number }
        | undefined,

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      error: undefined as unknown,
      isLoading: false,
      statusMessage: '',
      hoveredNode: null as string | null,
      hoveredEdge: null as number | null,
      selectedNode: null as string | null,
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
        if (self.graph) {
          const m = new Map<string, GraphNode>()
          for (const n of self.graph.nodes) {
            m.set(n.id, n)
          }
          return m
        }
        return undefined
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
      storeRenderBatchMeta(batch: RenderBatch) {
        self.nodeVertexRanges = batch.nodeVertexRanges
        self.edgeVertexRanges = batch.edgeVertexRanges
        self.arrowVertexRanges = batch.arrowVertexRanges
        self.baseNodeColors = batch.nodes.colors
        self.baseEdgeColors = batch.edges.colors
        self.baseArrowColors = batch.arrows.colors
      },
      zoomToFit() {
        if (!self.layoutResult) {
          return
        }
        const positions: Record<string, { x: number; y: number }[]> =
          self.layoutResult.nodePositions
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
        self.syntenyBlocks = undefined
        self.largeModeRegion = undefined
        self.error = undefined
        self.isLoading = false
        self.statusMessage = ''
        self.hoveredNode = null
        self.hoveredEdge = null
        self.selectedNode = null
        self.draggingNode = null
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
    .actions(self => {
      function callLayout(graph: Graph, extraOpts?: BandageScaleOpts) {
        const session = getSession(self)
        const { rpcManager } = session
        const sessionId = 'graph' // getRpcSessionId(self) no 'rpcSessionId' getter
        return rpcManager.call(sessionId, 'GraphComputeLayout', {
          sessionId,
          graph: { nodes: graph.nodes, edges: graph.edges },
          options: {
            quality: self.layoutQuality,
            linearLayout: self.linearLayout,
            ...extraOpts,
          },
          statusCallback: (message: string) => {
            self.setStatusMessage(message)
          },
        }) as Promise<{ result: LayoutResult }>
      }

      function* parseAndLayout(
        text: string,
        name: string,
        scaleOpts?: BandageScaleOpts,
      ) {
        self.setStatusMessage('Parsing GFA')
        const gfaGraph = parseGFA(text)
        const graph = convertGFAToGraph(gfaGraph, name)
        self.graph = graph
        self.setStatusMessage('Computing layout')
        const { result } = (yield callLayout(graph, scaleOpts)) as {
          result: LayoutResult
        }
        if (self.graph === graph) {
          self.layoutResult = result
        }
      }

      function* loadFromTabixLarge(
        adapterConfig: Record<string, unknown>,
        region: {
          refName: string
          assemblyName: string
          start: number
          end: number
        },
        bpPerPx?: number,
      ) {
        self.isLoading = true
        self.error = undefined
        self.graph = undefined
        self.layoutResult = undefined
        self.setStatusMessage('Fetching synteny overview')
        try {
          const session = getSession(self)
          const { rpcManager } = session
          const sessionId = 'graph'
          const blocks = (yield rpcManager.call(sessionId, 'GetSyntenyBlocks', {
            adapterConfig,
            region,
            sessionId,
            bpPerPx,
          })) as [string, SyntenyBlock[]][]
          self.syntenyBlocks = blocks
          self.largeModeRegion = {
            refName: region.refName,
            start: region.start,
            end: region.end,
          }
        } catch (e) {
          console.error('[GraphGenomeView.loadFromTabixLarge]', e)
          self.error = e
        } finally {
          self.isLoading = false
        }
      }

      // Inner loading logic shared by loadFromTabixSubgraph and refetchIfNeeded
      function* doSubgraphLoad(
        adapterConfig: Record<string, unknown>,
        region: {
          refName: string
          assemblyName: string
          start: number
          end: number
        },
        opts: {
          maxPathsEmitted?: number
          context?: number
          bpPerPx?: number
        } = {},
      ) {
        const regionSize = region.end - region.start
        if (regionSize > 100_000) {
          yield* loadFromTabixLarge(adapterConfig, region, opts.bpPerPx)
          return
        }
        self.isLoading = true
        self.error = undefined
        self.syntenyBlocks = undefined
        self.largeModeRegion = undefined
        self.setStatusMessage('Fetching subgraph')
        try {
          const session = getSession(self)
          const { rpcManager } = session
          const sessionId = 'graph' // getRpcSessionId(self) no rpcSessionId getter
          // Default cap: at HPRC chr20 scale, 1 Mbp emits ~219k subwalks
          // and 5 Mbp ~434k. Past ~50k the browser geometry rebuild stalls
          // and the user gains no detail; truncate emission with a comment.
          const subgraphOpts = {
            maxPathsEmitted: opts.maxPathsEmitted ?? 50000,
            context: opts.context,
          }
          const gfaText = (yield rpcManager.call(sessionId, 'GetSubgraph', {
            adapterConfig,
            region,
            sessionId,
            opts: subgraphOpts,
          })) as string
          if (!gfaText) {
            throw new Error(
              'Adapter returned no GFA — region may be outside indexed data or the adapter does not implement getSubgraph',
            )
          }
          const label = `${region.refName}:${region.start.toLocaleString()}-${region.end.toLocaleString()}`
          // Pangenome-tuned bandage scaling. Default 1000 units/Mbp clamps
          // every node <1kb to minimumNodeLength (1.0), making SNPs and
          // longer contigs render at identical visual lengths. 1 unit/bp
          // makes node length proportional to bp; nodeSegmentLength=5
          // caps OGDF subnode count per node to keep FMMM layout fast.
          yield* parseAndLayout(gfaText, label, {
            nodeLengthPerMegabase: 1_000_000,
            minimumNodeLength: 0.5,
            nodeSegmentLength: 5,
          })
        } catch (e) {
          console.error('[GraphGenomeView.loadFromTabixSubgraph]', e)
          self.error = e
        } finally {
          self.isLoading = false
        }
      }

      return {
        loadGFA: flow(function* (text: string, name = 'Imported GFA') {
          self.loadedTrackId = ''
          self.loadedRegion = undefined
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
          opts: {
            maxPathsEmitted?: number
            context?: number
            bpPerPx?: number
            trackId?: string
          } = {},
        ) {
          self.loadedTrackId = opts.trackId ?? ''
          self.loadedRegion = opts.trackId ? region : undefined
          yield* doSubgraphLoad(adapterConfig, region, opts)
        }),
        refetchIfNeeded: flow(function* () {
          if (!self.loadedTrackId || !self.loadedRegion || self.graph) {
            return
          }
          const session = getSession(self)
          const track = session.tracks.find(
            t => t.trackId === self.loadedTrackId,
          )
          if (!track) {
            return
          }
          // Save pan/zoom — zoomToFit autorun fires when layoutResult is set,
          // overriding the persisted transform; we restore it afterward.
          const savedScale = self.scale
          const savedTx = self.translateX
          const savedTy = self.translateY
          const adapterConfig = readConfObject(track, 'adapter')
          yield* doSubgraphLoad(adapterConfig, self.loadedRegion, {})
          self.scale = savedScale
          self.translateX = savedTx
          self.translateY = savedTy
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
            console.error('[GraphGenomeView.recomputeLayout]', e)
            self.error = e
          } finally {
            self.isLoading = false
          }
        }),
      }
    })
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

          void self.refetchIfNeeded()
        }

        self.installGpuDisplay<GraphRenderer>(backend, {
          // Autorun: rebuild geometry when graph data or display options
          // change. scale/translate are untracked so they don't trigger a full
          // rebuild — only the debounced viewportDirty flag does.
          upload: b => {
            b.resize(self.width, self.canvasHeight)
            const nodeById = self.nodeById
            if (self.nodePositions && self.graph && nodeById) {
              void self.viewportDirty
              const batch = buildGeometry({
                nodePositions: self.nodePositions,
                graph: self.graph,
                nodeById,
                colorScheme: self.colorScheme,
                contigThickness: self.contigThickness,
                connectorThickness: self.connectorThickness,
                drawPaths: self.drawPaths,
                scale: self.scale,
                linearLayout: self.linearLayout,
                viewportBounds: untracked(() => computeViewportBounds(self)),
              })
              b.uploadGeometry(batch)
              self.storeRenderBatchMeta(batch)
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
}

export type GraphGenomeViewModel = ReturnType<
  ReturnType<typeof stateModelFactory>['create']
>
