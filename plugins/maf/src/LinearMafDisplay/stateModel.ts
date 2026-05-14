import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
  getSession,
  max,
  measureText,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { GpuBackendLifecycleSlotMixin } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { addDisposer, cast, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  assignDepthY,
  eachAfter,
  hierarchy,
  leaves,
  maxLength,
  setBrLength,
  sort,
  sum,
} from '@jbrowse/tree-sidebar'
import deepEqual from 'fast-deep-equal'
import { autorun, observable, untracked } from 'mobx'

import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { computeNodeDescendantNames } from './util'
import { getColorBaseMap } from '../LinearMafRenderer/util.ts'
import { normalize } from '../util'

import type { HierarchyNode, NodeWithIds, Sample } from './types'
import type { MafBackend, MafGPURenderState, MafRegionData } from '../LinearMafRenderer/mafBackendTypes.ts'
import type { InstallGpuDisplayCallbacks } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { SessionWithWidgets } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'
import type { ExportSvgDisplayOptions, LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const defaultRowHeight = 15
const defaultRowProportion = 0.8
const defaultShowAllLetters = false
const defaultMismatchRendering = true
const defaultShowBranchLen = false
const defaultTreeAreaWidth = 80
const defaultShowAsUpperCase = true
const defaultShowSidebar = true

const SetRowHeightDialog = lazy(
  () => import('./components/SetRowHeightDialog/SetRowHeightDialog'),
)

/**
 * #stateModel LinearMafDisplay
 * extends LinearBasicDisplay
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
  pluginManager: PluginManager,
) {
  const LinearGenomePlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as LinearGenomeViewPlugin
  const { BaseLinearDisplay } = LinearGenomePlugin.exports

  return types
    .compose(
      'LinearMafDisplay',
      BaseLinearDisplay,
      GpuBackendLifecycleSlotMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearMafDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        rowHeight: defaultRowHeight,
        /**
         * #property
         */
        rowProportion: defaultRowProportion,
        /**
         * #property
         */
        showAllLetters: defaultShowAllLetters,
        /**
         * #property
         */
        mismatchRendering: defaultMismatchRendering,

        /**
         * #property
         */
        showBranchLen: defaultShowBranchLen,

        /**
         * #property
         */
        treeAreaWidth: defaultTreeAreaWidth,
        /**
         * #property
         */
        showAsUpperCase: defaultShowAsUpperCase,
        /**
         * #property
         */
        showSidebar: defaultShowSidebar,
        /**
         * #property
         */
        subtreeFilter: types.maybe(types.array(types.string)),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      rpcDataMap: observable.map<
        number,
        { instanceBuffer: ArrayBuffer; instanceCount: number; regionData: MafRegionData }
      >(),
      /**
       * #volatile
       */
      loadedRegions: observable.map<
        number,
        { refName: string; start: number; end: number }
      >(),
      /**
       * #volatile
       */
      hoveredInfo: undefined as Record<string, unknown> | undefined,
      /**
       * #volatile
       */
      prefersOffset: true,
      /**
       * #volatile
       */
      volatileSamples: undefined as Sample[] | undefined,
      /**
       * #volatile
       */
      volatileTree: undefined as NodeWithIds | undefined,
      /**
       * #volatile
       */
      highlightedRowNames: undefined as string[] | undefined,
      /**
       * #volatile
       */
      hoveredTreeNode: undefined as { x: number; y: number } | undefined,
      /**
       * #volatile
       */
      treeMenuAnchor: undefined as
        | { x: number; y: number; names: string[] }
        | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setHoveredInfo(arg?: Record<string, unknown>) {
        self.hoveredInfo = arg
      },
      /**
       * #action
       */
      setRowHeight(n: number) {
        self.rowHeight = n
      },
      /**
       * #action
       */
      setRowProportion(n: number) {
        self.rowProportion = n
      },
      /**
       * #action
       */
      setShowAllLetters(f: boolean) {
        self.showAllLetters = f
      },
      /**
       * #action
       */
      setMismatchRendering(f: boolean) {
        self.mismatchRendering = f
      },
      /**
       * #action
       */
      setSamples({
        samples,
        tree,
      }: {
        samples: Sample[]
        tree: NodeWithIds | undefined
      }) {
        if (!deepEqual(samples, self.volatileSamples)) {
          self.volatileSamples = samples
        }
        if (!deepEqual(tree, self.volatileTree)) {
          self.volatileTree = tree
        }
      },
      /**
       * #action
       */
      setShowAsUpperCase(arg: boolean) {
        self.showAsUpperCase = arg
      },
      /**
       * #action
       */
      setTreeAreaWidth(width: number) {
        self.treeAreaWidth = width
      },
      /**
       * #action
       */
      setShowSidebar(arg: boolean) {
        self.showSidebar = arg
      },
      /**
       * #action
       */
      setHighlightedRowNames(
        names?: string[],
        nodePosition?: { x: number; y: number },
      ) {
        self.highlightedRowNames = names
        self.hoveredTreeNode = nodePosition
      },
      /**
       * #action
       */
      setSubtreeFilter(names?: string[]) {
        self.subtreeFilter = cast(names)
      },
      /**
       * #action
       */
      setTreeMenuAnchor(anchor?: { x: number; y: number; names: string[] }) {
        self.treeMenuAnchor = anchor
      },
      /**
       * #action
       */
      showInsertionSequenceDialog(insertionData: {
        sequence: string
        sampleLabel: string
        chr: string
        pos: number
      }) {
        const { sequence, sampleLabel, chr, pos } = insertionData
        const session = getSession(self) as SessionWithWidgets
        const featureWidget = session.addWidget(
          'BaseFeatureWidget',
          'baseFeature',
          {
            featureData: {
              uniqueId: `insertion-${chr}-${pos}-${sampleLabel}`,
              type: 'insertion',
              refName: chr,
              start: pos,
              end: pos + 1,
              sample: sampleLabel,
              insertionLength: sequence.length,
              sequence: self.showAsUpperCase
                ? sequence.toUpperCase()
                : sequence.toLowerCase(),
            },
            view: getContainingView(self),
            track: getContainingTrack(self),
          },
        )

        session.showWidget(featureWidget)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rendererTypeName() {
        return 'LinearMafRenderer'
      },

      /**
       * #getter
       */
      get rendererConfig(): AnyConfigurationModel {
        const configBlob = getConf(self, ['renderer']) || {}
        const config = configBlob as Omit<typeof configBlob, symbol>
        const { rendererType } = self
        if (!rendererType) {
          throw new Error('LinearMafRenderer renderer type not found')
        }
        return rendererType.configSchema.create(
          {
            ...config,
            type: 'LinearMafRenderer',
          },
          getEnv(self),
        )
      },
    }))

    .views(self => ({
      /**
       * #getter
       */
      get root() {
        if (!self.volatileTree) {
          return undefined
        }

        let treeData = self.volatileTree

        // If subtree filter is active, find the subtree node
        if (self.subtreeFilter && self.subtreeFilter.length > 0) {
          const filterSet = new Set(self.subtreeFilter)

          const getLeafNames = (n: NodeWithIds): string[] =>
            !n.children?.length
              ? n.name
                ? [n.name]
                : []
              : n.children.flatMap(child => getLeafNames(child))

          const findSubtreeRoot = (
            node: NodeWithIds,
          ): NodeWithIds | undefined => {
            const leafNames = getLeafNames(node)
            if (
              leafNames.length === filterSet.size &&
              leafNames.every(name => filterSet.has(name))
            ) {
              return node
            }
            for (const child of node.children ?? []) {
              const found = findSubtreeRoot(child)
              if (found) {
                return found
              }
            }
            return undefined
          }

          const subtreeRoot = findSubtreeRoot(self.volatileTree)
          if (subtreeRoot) {
            treeData = subtreeRoot
          }
        }

        const root = hierarchy(treeData, d => d.children)
        sum(root, d => (d.children?.length ? 0 : 1))
        sort(root, (a, b) => (a.data.length || 1) - (b.data.length || 1))
        return root
      },
    }))
    .views(self => ({
      /**
       * #getter
       * generates a new tree that is clustered with x,y positions
       */
      get hierarchy(): HierarchyNode | undefined {
        const r = self.root
        if (!r) {
          return undefined
        }

        const width = self.treeAreaWidth

        // Assign y positions based on depth (root=0, leaves=width)
        assignDepthY(r, width)

        // Assign x positions for leaves at exact rowHeight multiples so they
        // align with the renderer's row positioning
        const leafNodes = leaves(r)
        for (let i = 0; i < leafNodes.length; i++) {
          leafNodes[i]!.x = i * self.rowHeight + self.rowHeight / 2
        }
        // Recompute internal node x as midpoint of first/last child (bottom-up)
        eachAfter(r, node => {
          if (node.children?.length) {
            node.x =
              (node.children[0]!.x! +
                node.children[node.children.length - 1]!.x!) /
              2
          }
        })

        r.data.length = 0
        setBrLength(r, 0, width / maxLength(r))
        return r
      },
      /**
       * #getter
       */
      get samples() {
        let samples: Sample[] | undefined
        if (this.rowNames) {
          const volatileSamplesMap = self.volatileSamples
            ? Object.fromEntries(self.volatileSamples.map(e => [e.id, e]))
            : undefined
          samples = normalize(this.rowNames).map(r => ({
            ...r,
            label: volatileSamplesMap?.[r.id]?.label ?? r.label,
            color: volatileSamplesMap?.[r.id]?.color ?? r.color,
          }))
        } else {
          samples = self.volatileSamples
        }

        if (samples && self.subtreeFilter) {
          const filterSet = new Set(self.subtreeFilter)
          return samples.filter(s => filterSet.has(s.id))
        }
        return samples
      },

      /**
       * #getter
       */
      get totalHeight() {
        return this.samples ? this.samples.length * self.rowHeight : 1
      },
      /**
       * #getter
       * Override BaseLinearDisplay.height so the track container matches the
       * rendering canvas height exactly (samples × rowHeight).
       */
      get height() {
        return this.totalHeight
      },
      /**
       * #getter
       */
      get leaves() {
        return self.root ? leaves(self.root) : undefined
      },
      /**
       * #getter
       */
      get leafMap() {
        return new Map(this.leaves?.map(leaf => [leaf.data.name, leaf]))
      },
      /**
       * #getter
       * Precomputed map from hierarchy node to its descendant leaf names
       */
      get nodeDescendantNames() {
        if (this.hierarchy) {
          return computeNodeDescendantNames(this.hierarchy)
        }
        return new Map<HierarchyNode, string[]>()
      },
      /**
       * #getter
       */
      get rowNames(): string[] | undefined {
        return this.leaves?.map(n => n.data.name)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Render state passed to GPU/Canvas2D backend each frame.
       */
      get mafRenderState(): MafGPURenderState | undefined {
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized || !self.samples) {
          return undefined
        }
        return {
          canvasWidth: view.width,
          canvasHeight: self.totalHeight,
          rowHeight: self.rowHeight,
          rowProportion: self.rowProportion,
          showAllLetters: self.showAllLetters,
          mismatchRendering: self.mismatchRendering,
          showAsUpperCase: self.showAsUpperCase,
        }
      },
      /**
       * #getter
       * Render blocks for the current viewport (one per visible displayed region).
       * visibleRegions has offsetPx in absolute timeline coords; subtract
       * view.offsetPx to get canvas-relative screen positions.
       */
      get renderBlocks() {
        const view = getContainingView(self) as LinearGenomeViewModel
        const viewOffsetPx = view.offsetPx
        return buildRenderBlocks(
          view.visibleRegions.map(b => ({
            displayedRegionIndex: b.displayedRegionIndex,
            start: b.start,
            end: b.end,
            screenStartPx: b.offsetPx - viewOffsetPx,
            screenEndPx: b.offsetPx + b.widthPx - viewOffsetPx,
            reversed: b.reversed,
          })),
        )
      },
      /**
       * #method
       * User-controlled rendering settings; used as cache keys to trigger
       * refetch when settings change. Must not include fetch-result derivatives.
       */
      rpcProps() {
        return {
          showAllLetters: self.showAllLetters,
          mismatchRendering: self.mismatchRendering,
          showAsUpperCase: self.showAsUpperCase,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get visibleLabels() {
        const state = self.mafRenderState
        return state
          ? computeVisibleLabels(self.renderBlocks, self.rpcDataMap, state)
          : []
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,

        renderProps: superRenderProps,
      } = self
      return {
        /**
         * #getter
         */
        get treeWidth() {
          return self.hierarchy ? self.treeAreaWidth : 0
        },
        /**
         * #method
         */
        renderProps() {
          const s = superRenderProps()
          return {
            ...s,
            notReady:
              (!self.volatileSamples && !self.volatileTree) || s.notReady,
          }
        },
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Set feature height',
              type: 'subMenu',
              subMenu: [
                {
                  label: 'Normal',
                  onClick: () => {
                    self.setRowHeight(15)
                    self.setRowProportion(0.8)
                  },
                },
                {
                  label: 'Compact',
                  onClick: () => {
                    self.setRowHeight(8)
                    self.setRowProportion(0.9)
                  },
                },
                {
                  label: 'Manually set height',
                  onClick: () => {
                    getSession(self).queueDialog(handleClose => [
                      SetRowHeightDialog,
                      {
                        model: self,
                        handleClose,
                      },
                    ])
                  },
                },
              ],
            },
            {
              label: 'Show...',
              type: 'subMenu',
              subMenu: [
                {
                  label: 'Letters at all positions',
                  type: 'checkbox',
                  checked: self.showAllLetters,
                  onClick: () => {
                    self.setShowAllLetters(!self.showAllLetters)
                  },
                },
                {
                  label: 'Mismatches colored by base',
                  type: 'checkbox',
                  checked: self.mismatchRendering,
                  onClick: () => {
                    self.setMismatchRendering(!self.mismatchRendering)
                  },
                },
                {
                  label: 'Letters as uppercase',
                  type: 'checkbox',
                  checked: self.showAsUpperCase,
                  onClick: () => {
                    self.setShowAsUpperCase(!self.showAsUpperCase)
                  },
                },
                {
                  label: 'Sidebar with tree and labels',
                  type: 'checkbox',
                  checked: self.showSidebar,
                  onClick: () => {
                    self.setShowSidebar(!self.showSidebar)
                  },
                },
              ],
            },
            ...(self.subtreeFilter
              ? [
                  {
                    label: 'Clear subtree filter',
                    onClick: () => {
                      self.setSubtreeFilter(undefined)
                    },
                  },
                ]
              : []),
          ]
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * Get highlight regions from connected MSA views
       */
      get msaHighlights() {
        const session = getSession(self)
        const view = getContainingView(self)
        const highlights: { refName: string; start: number; end: number }[] = []

        // Find MSA views that are connected to our parent view
        for (const v of session.views) {
          if (
            (v as { type?: string }).type === 'MsaView' &&
            (v as { connectedViewId?: string }).connectedViewId === view.id
          ) {
            const msaView = v as {
              connectedHighlights?: {
                refName: string
                start: number
                end: number
              }[]
            }
            if (msaView.connectedHighlights) {
              for (const h of msaView.connectedHighlights) {
                highlights.push(h)
              }
            }
          }
        }
        return highlights
      },
      /**
       * #getter
       */
      get svgFontSize() {
        return Math.min(Math.max(self.rowHeight, 8), 14)
      },
      /**
       * #getter
       */
      get canDisplayLabel() {
        return self.rowHeight >= 7
      },
      /**
       * #getter
       */
      get labelWidth() {
        const minWidth = 20
        return max(
          self.samples
            ?.map(s => measureText(s.label, this.svgFontSize))
            .map(width => (this.canDisplayLabel ? width : minWidth)) || [],
          0,
        )
      },
      /**
       * #getter
       */
      get sidebarWidth() {
        return self.showSidebar ? this.labelWidth + 5 + self.treeWidth : 0
      },
    }))
    .actions(self => ({
      setRpcData(
        regionIndex: number,
        data: { instanceBuffer: ArrayBuffer; instanceCount: number; regionData: MafRegionData },
      ) {
        self.rpcDataMap.set(regionIndex, data)
      },
      setLoadedRegion(
        regionIndex: number,
        region: { refName: string; start: number; end: number },
      ) {
        self.loadedRegions.set(regionIndex, region)
      },
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
        self.loadedRegions.clear()
        self.resetCanvasDrawn()
      },
      // Override base setHeight: distribute the new total height across rows so
      // the resize handle and programmatic setHeight both work.
      setHeight(newHeight: number) {
        const sampleCount = (self as unknown as { samples?: { length: number } | undefined }).samples?.length
        if (sampleCount) {
          self.rowHeight = Math.max(1, Math.floor(newHeight / sampleCount))
        }
      },
      startGpuBackendLifecycle(backend: MafBackend) {
        const perKeyDisposers = new Map<number, () => void>()
        addDisposer(self, () => {
          for (const dispose of perKeyDisposers.values()) {
            dispose()
          }
        })
        const gpuSelf = self as unknown as {
          installGpuDisplay: <B>(b: B, cbs: InstallGpuDisplayCallbacks<B>) => void
          currentGpuBackend: unknown
          renderNow: () => void
          renderBlocks: ReturnType<typeof buildRenderBlocks>
          mafRenderState: MafGPURenderState | undefined
          rpcDataMap: typeof self.rpcDataMap
        }
        gpuSelf.installGpuDisplay<MafBackend>(backend, {
          upload: b => {
            const active: number[] = []
            for (const key of gpuSelf.rpcDataMap.keys()) {
              active.push(key)
              if (!perKeyDisposers.has(key)) {
                perKeyDisposers.set(
                  key,
                  autorun(() => {
                    const data = gpuSelf.rpcDataMap.get(key)
                    const current = gpuSelf.currentGpuBackend as MafBackend | undefined
                    if (data !== undefined && current !== undefined) {
                      current.uploadRegion(
                        key,
                        data.instanceBuffer,
                        data.instanceCount,
                        data.regionData,
                      )
                      gpuSelf.renderNow()
                    }
                  }),
                )
              }
            }
            const activeSet = new Set(active)
            for (const [key, dispose] of perKeyDisposers) {
              if (!activeSet.has(key)) {
                dispose()
                perKeyDisposers.delete(key)
              }
            }
            b.pruneRegions(active)
          },
          render: b => {
            const state = gpuSelf.mafRenderState
            const blocks = gpuSelf.renderBlocks
            if (!state) {
              return false
            }
            b.renderBlocks(blocks, state)
            return true
          },
        })
      },
    }))
    .actions(self => ({
      afterCreate() {
        // Fetch samples and tree structure on mount.
        addDisposer(
          self,
          autorun(async () => {
            try {
              const { rpcManager } = getSession(self)
              const sessionId = getRpcSessionId(self)
              self.setSamples(
                (await rpcManager.call(sessionId, 'MafGetSamples', {
                  sessionId,
                  adapterConfig: self.adapterConfig,
                  statusCallback: (message: string) => {
                    if (isAlive(self)) {
                      self.setStatusMessage(message)
                    }
                  },
                })) as { samples: Sample[]; tree: NodeWithIds | undefined },
              )
            } catch (e) {
              console.error(e)
              getSession(self).notifyError(`${e}`, e)
            }
          }),
        )

        // Clear cached region data when displayed regions change (chromosome nav).
        addDisposer(
          self,
          autorun(
            () => {
              const view = getContainingView(self) as LinearGenomeViewModel
              if (!view.initialized) {
                return
              }
              for (const r of view.displayedRegions) {
                void r.refName
                void r.start
                void r.end
              }
              self.clearDisplaySpecificData()
            },
            { name: 'DisplayedRegionsChange' },
          ),
        )

        // Clear and refetch when user-controlled rendering settings change.
        addDisposer(
          self,
          autorun(
            () => {
              const view = getContainingView(self) as LinearGenomeViewModel
              if (!view.initialized) {
                return
              }
              void self.rpcProps()
              self.clearDisplaySpecificData()
            },
            { name: 'SettingsInvalidate' },
          ),
        )

        // Fetch alignment data for each visible region (600ms debounce).
        addDisposer(
          self,
          autorun(
            async () => {
              const view = getContainingView(self) as LinearGenomeViewModel
              if (!view.initialized) {
                return
              }

              // Read all observables synchronously before any awaits.
              const samples = self.samples
              const showAllLetters = self.showAllLetters
              const mismatchRendering = self.mismatchRendering
              const showAsUpperCase = self.showAsUpperCase
              const adapterConfig = self.adapterConfig
              const blocks = view.coarseDynamicBlocks.filter(
                b => b.displayedRegionIndex !== undefined,
              )

              if (!samples || blocks.length === 0) {
                return
              }

              const { rpcManager } = getSession(self)
              const sessionId = getRpcSessionId(self)
              const colorForBase = getColorBaseMap(createJBrowseTheme())

              // Fetch only regions not already loaded at this exact range.
              const needed = blocks.filter(b => {
                const loaded = untracked(() =>
                  self.loadedRegions.get(b.displayedRegionIndex!),
                )
                return !(
                  loaded?.refName === b.refName &&
                  Math.floor(b.start) >= loaded.start &&
                  Math.ceil(b.end) <= loaded.end
                )
              })

              if (needed.length === 0) {
                return
              }

              await Promise.all(
                needed.map(async block => {
                  const regionIndex = block.displayedRegionIndex!
                  const region = {
                    refName: block.refName,
                    start: Math.floor(block.start),
                    end: Math.ceil(block.end),
                    assemblyName: block.assemblyName,
                  }
                  try {
                    const result = (await rpcManager.call(
                      sessionId,
                      'LinearMafGetAlignmentData',
                      {
                        sessionId,
                        adapterConfig,
                        region,
                        samples: samples.map(s => ({ id: s.id })),
                        colorForBase,
                        showAllLetters,
                        mismatchRendering,
                        showAsUpperCase,
                      },
                    )) as {
                      regionData: MafRegionData
                      instanceBuffer: ArrayBuffer
                      instanceCount: number
                    }

                    if (isAlive(self)) {
                      self.setRpcData(regionIndex, result)
                      self.setLoadedRegion(regionIndex, region)
                    }
                  } catch (e) {
                    console.error('LinearMafGetAlignmentData error:', e)
                  }
                }),
              )
            },
            { delay: 600, name: 'FetchVisibleRegions' },
          ),
        )
      },
    }))
    .actions(self => {
      const { renderSvg: superRenderSvg } = self
      return {
        /**
         * #action
         */
        async renderSvg(opts: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg')
          return renderSvg(self, opts, superRenderSvg)
        },
      }
    })
    .postProcessSnapshot(snap => {
      const {
        rowHeight,
        rowProportion,
        showAllLetters,
        mismatchRendering,
        showBranchLen,
        treeAreaWidth,
        showAsUpperCase,
        showSidebar,
        subtreeFilter,
        ...rest
      } = snap as typeof snap & {
        rowHeight?: number
        rowProportion?: number
        showAllLetters?: boolean
        mismatchRendering?: boolean
        showBranchLen?: boolean
        treeAreaWidth?: number
        showAsUpperCase?: boolean
        showSidebar?: boolean
        subtreeFilter?: string[]
      }
      return {
        ...(rest as Omit<typeof rest, symbol>),
        ...(rowHeight !== defaultRowHeight ? { rowHeight } : {}),
        ...(rowProportion !== defaultRowProportion ? { rowProportion } : {}),
        ...(showAllLetters !== defaultShowAllLetters ? { showAllLetters } : {}),
        ...(mismatchRendering !== defaultMismatchRendering
          ? { mismatchRendering }
          : {}),
        ...(showBranchLen !== defaultShowBranchLen ? { showBranchLen } : {}),
        ...(treeAreaWidth !== defaultTreeAreaWidth ? { treeAreaWidth } : {}),
        ...(showAsUpperCase !== defaultShowAsUpperCase
          ? { showAsUpperCase }
          : {}),
        ...(showSidebar !== defaultShowSidebar ? { showSidebar } : {}),
        ...(subtreeFilter && subtreeFilter.length > 0 ? { subtreeFilter } : {}),
      }
    })
}

export type LinearMafDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearMafDisplayModel = Instance<LinearMafDisplayStateModel>
