import { lazy } from 'react'

import { fromNewick } from '@gmod/hclust'
import { getConf } from '@jbrowse/core/configuration'
import { set1 as colors } from '@jbrowse/core/ui/colors'
import {
  getContainingView,
  getSession,
  max,
  measureText,
} from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { cast, isAlive, types } from '@jbrowse/mobx-state-tree'
import EqualizerIcon from '@mui/icons-material/Equalizer'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { ascending } from '@mui/x-charts-vendor/d3-array'
import deepEqual from 'fast-deep-equal'

import { cluster, hierarchy } from '../d3-hierarchy2/index.ts'
import SharedWiggleMixin from '../shared/SharedWiggleMixin.ts'
import axisPropsFromTickScale from '../shared/axisPropsFromTickScale.ts'
import { YSCALEBAR_LABEL_OFFSET, getScale } from '../util.ts'

import type { Source } from '../util.ts'
import type {
  ClusterHierarchyNode,
  HoveredTreeNode,
} from './components/treeTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { AnyReactComponentType, Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

const randomColor = () =>
  '#000000'.replaceAll('0', () => (~~(Math.random() * 16)).toString(16))

// lazies
const Tooltip = lazy(() => import('./components/Tooltip.tsx'))
const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))
const WiggleClusterDialog = lazy(
  () => import('./components/WiggleClusterDialog/WiggleClusterDialog.tsx'),
)

// using a map because it preserves order
const rendererTypes = new Map([
  ['xyplot', 'MultiXYPlotRenderer'],
  ['multirowxy', 'MultiRowXYPlotRenderer'],
  ['multirowdensity', 'MultiDensityRenderer'],
  ['multiline', 'MultiLineRenderer'],
  ['multirowline', 'MultiRowLineRenderer'],
])

/**
 * #stateModel MultiLinearWiggleDisplay
 * extends
 * - [SharedWiggleMixin](../sharedwigglemixin)
 */
export function stateModelFactory(
  _pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'MultiLinearWiggleDisplay',
      SharedWiggleMixin(configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('MultiLinearWiggleDisplay'),

        /**
         * #property
         */
        layout: types.optional(types.frozen<Source[]>(), []),
        /**
         * #property
         */
        showSidebar: true,
        /**
         * #property
         */
        clusterTree: types.maybe(types.string),
        /**
         * #property
         */
        treeAreaWidth: types.optional(types.number, 80),
        /**
         * #property
         * When undefined, defaults to true
         */
        showTreeSetting: types.maybe(types.boolean),
        /**
         * #property
         * Filter to show only a subtree of samples
         */
        subtreeFilter: types.maybe(types.array(types.string)),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      sourcesLoadingStopToken: undefined as StopToken | undefined,
      /**
       * #volatile
       */
      featureUnderMouseVolatile: undefined as Feature | undefined,
      /**
       * #volatile
       */
      sourcesVolatile: undefined as Source[] | undefined,
      /**
       * #volatile
       */
      hoveredTreeNode: undefined as HoveredTreeNode | undefined,
      /**
       * #volatile
       */
      treeCanvas: undefined as HTMLCanvasElement | undefined,
      /**
       * #volatile
       */
      mouseoverCanvas: undefined as HTMLCanvasElement | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setShowSidebar(arg: boolean) {
        self.showSidebar = arg
      },
      /**
       * #action
       */
      setSourcesLoading(str: StopToken) {
        if (self.sourcesLoadingStopToken) {
          stopStopToken(self.sourcesLoadingStopToken)
        }
        self.sourcesLoadingStopToken = str
      },
      /**
       * #action
       */
      setLayout(layout: Source[], clearTree = true) {
        const orderChanged =
          clearTree &&
          self.clusterTree &&
          self.layout.length === layout.length &&
          self.layout.some(
            (source: Source, idx: number) => source.name !== layout[idx]?.name,
          )

        self.layout = layout
        if (orderChanged) {
          self.clusterTree = undefined
        }
      },
      /**
       * #action
       */
      clearLayout() {
        self.layout = []
        self.clusterTree = undefined
      },
      /**
       * #action
       */
      setClusterTree(tree?: string) {
        self.clusterTree = tree
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
      setShowTree(arg: boolean) {
        self.showTreeSetting = arg
      },
      /**
       * #action
       */
      setSubtreeFilter(names?: string[]) {
        self.subtreeFilter = names ? cast(names) : undefined
      },
      /**
       * #action
       */
      setHoveredTreeNode(node?: HoveredTreeNode) {
        self.hoveredTreeNode = node
      },
      /**
       * #action
       */
      setTreeCanvasRef(ref: HTMLCanvasElement | null) {
        self.treeCanvas = ref || undefined
      },
      /**
       * #action
       */
      setMouseoverCanvasRef(ref: HTMLCanvasElement | null) {
        self.mouseoverCanvas = ref || undefined
      },

      /**
       * #action
       */
      setSources(sources: Source[]) {
        if (!deepEqual(sources, self.sourcesVolatile)) {
          self.sourcesVolatile = sources
        }
      },

      /**
       * #action
       */
      setFeatureUnderMouse(f?: Feature) {
        self.featureUnderMouseVolatile = f
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get featureUnderMouse() {
        return self.featureUnderMouseVolatile
      },
      /**
       * #getter
       */
      get TooltipComponent() {
        return Tooltip as AnyReactComponentType
      },

      /**
       * #getter
       */
      get rendererTypeName() {
        const name = self.rendererTypeNameSimple
        const rendererType = rendererTypes.get(name)
        if (!rendererType) {
          throw new Error(`unknown renderer ${name}`)
        }
        return rendererType
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get graphType() {
        return (
          self.rendererTypeName === 'MultiXYPlotRenderer' ||
          self.rendererTypeName === 'MultiRowXYPlotRenderer' ||
          self.rendererTypeName === 'MultiLineRenderer' ||
          self.rendererTypeName === 'MultiRowLineRenderer'
        )
      },
      /**
       * #getter
       */
      get needsFullHeightScalebar() {
        return (
          self.rendererTypeName === 'MultiXYPlotRenderer' ||
          self.rendererTypeName === 'MultiLineRenderer'
        )
      },
      /**
       * #getter
       */
      get isMultiRow() {
        return (
          self.rendererTypeName === 'MultiRowXYPlotRenderer' ||
          self.rendererTypeName === 'MultiRowLineRenderer' ||
          self.rendererTypeName === 'MultiDensityRenderer'
        )
      },

      /**
       * #getter
       */
      get canHaveFill() {
        return (
          self.rendererTypeName === 'MultiXYPlotRenderer' ||
          self.rendererTypeName === 'MultiRowXYPlotRenderer'
        )
      },
      /**
       * #getter
       * can be used to give it a "color scale" like a R heatmap, not
       * implemented like this yet but flag can be used for this
       */
      get needsCustomLegend() {
        return self.rendererTypeName === 'MultiDensityRenderer'
      },

      /**
       * #getter
       * the multirowxy and multiline don't need to use colors on the legend
       * boxes since their track is drawn with the color. sort of a stylistic
       * choice
       */
      get renderColorBoxes() {
        return !(
          self.rendererTypeName === 'MultiRowLineRenderer' ||
          self.rendererTypeName === 'MultiRowXYPlotRenderer'
        )
      },
      /**
       * #getter
       * positions multi-row below the tracklabel even if using overlap
       * tracklabels for everything else
       */
      get prefersOffset() {
        return this.isMultiRow
      },

      /**
       * #getter
       */
      get sourcesWithoutLayout() {
        const sources = Object.fromEntries(
          self.sourcesVolatile?.map(s => [s.name, s]) || [],
        )
        const iter = self.sourcesVolatile
        return iter
          ?.map(s => ({
            ...sources[s.name],
            ...s,
          }))
          .map((s, i) => ({
            ...s,
            color:
              s.color ||
              (!this.isMultiRow ? colors[i] || randomColor() : 'blue'),
          }))
      },

      /**
       * #getter
       */
      get sources() {
        const sources = Object.fromEntries(
          self.sourcesVolatile?.map(s => [s.name, s]) || [],
        )
        const iter = self.layout.length ? self.layout : self.sourcesVolatile
        let result = iter
          ?.map(s => ({
            ...sources[s.name],
            ...s,
          }))
          .map((s, i) => ({
            ...s,
            color:
              s.color ||
              (!this.isMultiRow ? colors[i] || randomColor() : 'blue'),
          }))

        // Filter to subtree if filter is active
        if (result && self.subtreeFilter?.length) {
          const filterSet = new Set(self.subtreeFilter)
          result = result.filter(s => filterSet.has(s.name))
        }
        return result
      },
      /**
       * #getter
       */
      get quantitativeStatsReady() {
        const view = getContainingView(self) as LinearGenomeViewModel
        return (
          view.initialized &&
          self.featureDensityStatsReadyAndRegionNotTooLarge &&
          !self.error
        )
      },
    }))

    .views(self => ({
      /**
       * #getter
       */
      get showTree() {
        return self.showTreeSetting ?? true
      },
      /**
       * #getter
       */
      get rowHeight() {
        const { sources, height, isMultiRow } = self
        return isMultiRow ? height / (sources?.length || 1) : height
      },
      /**
       * #getter
       */
      get rowHeightTooSmallForScalebar() {
        return this.rowHeight < 70
      },

      /**
       * #getter
       */
      get useMinimalTicks() {
        return (
          (getConf(self, 'minimalTicks') as boolean) ||
          this.rowHeightTooSmallForScalebar
        )
      },
      /**
       * #getter
       */
      get root() {
        const newick = self.clusterTree
        if (!newick) {
          return undefined
        }
        const tree = fromNewick(newick)
        let root = hierarchy(tree, (d: ClusterHierarchyNode) => d.children)
          .sum((d: ClusterHierarchyNode) => (d.children ? 0 : 1))
          .sort((a: ClusterHierarchyNode, b: ClusterHierarchyNode) =>
            ascending(a.data.height || 1, b.data.height || 1),
          )

        // If subtree filter is active, find the matching subtree
        if (self.subtreeFilter?.length) {
          const filterSet = new Set(self.subtreeFilter)
          const getLeafNames = (node: ClusterHierarchyNode): string[] => {
            if (!node.children?.length) {
              return [node.data.name]
            }
            return node.children.flatMap(child => getLeafNames(child))
          }
          const findSubtree = (
            node: ClusterHierarchyNode,
          ): ClusterHierarchyNode | undefined => {
            const leafNames = getLeafNames(node)
            if (
              leafNames.length === filterSet.size &&
              leafNames.every(name => filterSet.has(name))
            ) {
              return node
            }
            if (node.children) {
              for (const child of node.children) {
                const found = findSubtree(child)
                if (found) {
                  return found
                }
              }
            }
            return undefined
          }
          const subtree = findSubtree(root)
          if (subtree) {
            root = subtree
          }
        }
        return root
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get totalHeight() {
        return self.rowHeight * (self.sources?.length || 1)
      },
      /**
       * #getter
       */
      get hierarchy() {
        const r = self.root
        if (!r || !self.sources?.length) {
          return undefined
        }
        const clust = cluster()
        clust.size([self.rowHeight * self.sources.length, self.treeAreaWidth])
        clust.separation(() => 1)
        clust(r)
        return r
      },
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #method
         */
        adapterProps() {
          const superProps = superRenderProps()
          return {
            ...superProps,
            config: self.rendererConfig,
            filters: self.filters,
            resolution: self.resolution,
            sources: self.sources,
          }
        },
        /**
         * #getter
         */
        get ticks() {
          const { scaleType, domain, isMultiRow, rowHeight, useMinimalTicks } =
            self

          if (!domain) {
            return undefined
          }

          const offset = isMultiRow ? 0 : YSCALEBAR_LABEL_OFFSET
          const ticks = axisPropsFromTickScale(
            getScale({
              scaleType,
              domain,
              range: [rowHeight - offset, offset],
              inverted: getConf(self, 'inverted') as boolean,
            }),
            4,
          )
          return useMinimalTicks ? { ...ticks, values: domain } : ticks
        },

        /**
         * #getter
         */
        get colors() {
          return [
            'red',
            'blue',
            'green',
            'orange',
            'purple',
            'cyan',
            'pink',
            'darkblue',
            'darkred',
            'pink',
          ]
        },
        /**
         * #getter
         * unused currently
         */
        get quantitativeStatsRelevantToCurrentZoom() {
          const view = getContainingView(self) as LinearGenomeViewModel
          return self.stats?.currStatsBpPerPx === view.bpPerPx
        },
      }
    })
    .views(self => ({
      get legendFontSize() {
        return Math.min(self.rowHeight, 8)
      },

      get canDisplayLegendLabels() {
        return self.rowHeight > 7
      },

      get labelWidth() {
        const minWidth = 20
        return max(
          self.sources
            ?.map(s => measureText(s.name, this.legendFontSize))
            .map(width => (this.canDisplayLegendLabels ? width : minWidth)) ||
            [],
        )
      },
      /**
       * #method
       */
      renderProps() {
        const superProps = self.adapterProps()
        return {
          ...superProps,
          notReady: superProps.notReady || !self.sources || !self.stats,
          displayCrossHatches: self.displayCrossHatches,
          height: self.height,
          ticks: self.ticks,
          stats: self.stats,
          scaleOpts: self.scaleOpts,
          offset: self.isMultiRow ? 0 : YSCALEBAR_LABEL_OFFSET,
        }
      },
      /**
       * #method
       */
      renderingProps() {
        return {
          displayModel: self,
        }
      },

      /**
       * #getter
       */
      get hasResolution() {
        return self.adapterCapabilities.includes('hasResolution')
      },

      /**
       * #getter
       */
      get hasGlobalStats() {
        return self.adapterCapabilities.includes('hasGlobalStats')
      },

      /**
       * #getter
       */
      get fillSetting() {
        if (self.filled) {
          return 0
        } else if (self.minSize === 1) {
          return 1
        } else {
          return 2
        }
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      const hasRenderings = getConf(self, 'defaultRendering')
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Show...',
              icon: VisibilityIcon,
              subMenu: [
                {
                  label: 'Show tooltips',
                  type: 'checkbox',
                  checked: self.showTooltipsEnabled,
                  onClick: () => {
                    self.setShowTooltips(!self.showTooltipsEnabled)
                  },
                },
                {
                  label: 'Show sidebar',
                  type: 'checkbox',
                  checked: self.showSidebar,
                  onClick: () => {
                    self.setShowSidebar(!self.showSidebar)
                  },
                },
                ...(self.isMultiRow
                  ? [
                      {
                        label: `Show tree${!self.clusterTree ? ' (run clustering first)' : ''}`,
                        type: 'checkbox',
                        checked: self.showTree,
                        disabled: !self.clusterTree,
                        onClick: () => {
                          self.setShowTree(!self.showTree)
                        },
                      },
                      ...(self.subtreeFilter?.length
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
                  : []),
                ...(self.graphType
                  ? [
                      {
                        type: 'checkbox',
                        label: 'Show cross hatches',
                        checked: self.displayCrossHatchesSetting,
                        onClick: () => {
                          self.toggleCrossHatches()
                        },
                      },
                    ]
                  : []),
              ],
            },
            {
              label: 'Score',
              icon: EqualizerIcon,
              subMenu: self.scoreTrackMenuItems(),
            },

            ...(self.canHaveFill
              ? [
                  {
                    label: 'Fill mode',
                    subMenu: ['filled', 'no fill', 'no fill w/ emphasis'].map(
                      (elt, idx) => ({
                        label: elt,
                        type: 'radio',
                        checked: self.fillSetting === idx,
                        onClick: () => {
                          self.setFill(idx)
                        },
                      }),
                    ),
                  },
                ]
              : []),
            ...(hasRenderings
              ? [
                  {
                    label: 'Renderer type',
                    subMenu: [
                      'xyplot',
                      'multirowxy',
                      'multirowdensity',
                      'multiline',
                      'multirowline',
                    ].map(key => ({
                      label: key,
                      type: 'radio',
                      checked: self.rendererTypeNameSimple === key,
                      onClick: () => {
                        self.setRendererType(key)
                      },
                    })),
                  },
                ]
              : []),
            ...(self.isMultiRow
              ? [
                  {
                    label: 'Cluster rows by score',
                    onClick: () => {
                      getSession(self).queueDialog(handleClose => [
                        WiggleClusterDialog,
                        {
                          model: self,
                          handleClose,
                        },
                      ])
                    },
                  },
                ]
              : []),
            {
              label: 'Edit colors/arrangement...',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SetColorDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ]
        },
      }
    })
    .actions(self => {
      const { renderSvg: superRenderSvg } = self
      return {
        afterAttach() {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            try {
              const [
                { getMultiWiggleSourcesAutorun },
                { getQuantitativeStatsAutorun },
                { setupTreeDrawingAutorun },
              ] = await Promise.all([
                import('../getMultiWiggleSourcesAutorun.ts'),
                import('../getQuantitativeStatsAutorun.ts'),
                import('./treeDrawingAutorun.ts'),
              ])
              getQuantitativeStatsAutorun(self)
              getMultiWiggleSourcesAutorun(self)
              setupTreeDrawingAutorun(self)
            } catch (e) {
              if (isAlive(self)) {
                console.error(e)
                getSession(self).notifyError(`${e}`, e)
              }
            }
          })()
        },

        /**
         * #action
         */
        async renderSvg(opts: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts, superRenderSvg)
        },
      }
    })
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        layout,
        showSidebar,
        clusterTree,
        treeAreaWidth,
        showTreeSetting,
        subtreeFilter,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        // mst types wrong, nullish needed
        ...(layout?.length ? { layout } : {}),
        ...(!showSidebar ? { showSidebar } : {}),
        ...(clusterTree !== undefined ? { clusterTree } : {}),
        ...(treeAreaWidth !== 80 ? { treeAreaWidth } : {}),
        ...(showTreeSetting !== undefined ? { showTreeSetting } : {}),
        ...(subtreeFilter?.length ? { subtreeFilter } : {}),
      } as typeof snap
    })
}

export type WiggleDisplayStateModel = ReturnType<typeof stateModelFactory>
export type WiggleDisplayModel = Instance<WiggleDisplayStateModel>

export default stateModelFactory
