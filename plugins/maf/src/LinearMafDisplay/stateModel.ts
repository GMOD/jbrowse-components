import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getEnv, getSession, max, measureText } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { ascending } from 'd3-array'
import { cluster, hierarchy } from 'd3-hierarchy'
import deepEqual from 'fast-deep-equal'
import { autorun } from 'mobx'
import { addDisposer, isAlive, types } from 'mobx-state-tree'

import { maxLength, setBrLength } from './util'
import { normalize } from '../util'

import type { NodeWithIds, NodeWithIdsAndLength, Sample } from './types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
import type { HierarchyNode } from 'd3-hierarchy'
import type { Instance } from 'mobx-state-tree'

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
  ) as import('@jbrowse/plugin-linear-genome-view').default
  const { BaseLinearDisplay } = LinearGenomePlugin.exports

  return types
    .compose(
      'LinearMafDisplay',
      BaseLinearDisplay,
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
        rowHeight: 15,
        /**
         * #property
         */
        rowProportion: 0.8,
        /**
         * #property
         */
        showAllLetters: false,
        /**
         * #property
         */
        mismatchRendering: true,

        /**
         * #property
         */
        showBranchLen: false,

        /**
         * #property
         */
        treeAreaWidth: 80,
        /**
         * #property
         */
        showAsUpperCase: true,
      }),
    )
    .volatile(() => ({
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
      volatileTree: undefined as any,
    }))
    .actions(self => ({
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
      setSamples({ samples, tree }: { samples: Sample[]; tree: unknown }) {
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

        return self.rendererType.configSchema.create(
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
        return self.volatileTree
          ? hierarchy(self.volatileTree, d => d.children)
              // todo: investigate whether needed, typescript says children always true
              .sum(d => (d.children ? 0 : 1))
              .sort((a, b) => ascending(a.data.length || 1, b.data.length || 1))
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * generates a new tree that is clustered with x,y positions
       */
      get hierarchy(): HierarchyNode<NodeWithIdsAndLength> | undefined {
        const r = self.root
        if (r) {
          const width = self.treeAreaWidth
          const clust = cluster<NodeWithIds>()
            .size([this.totalHeight, width])
            .separation(() => 1)
          clust(r)
          setBrLength(r, (r.data.length = 0), width / maxLength(r))
          return r as HierarchyNode<NodeWithIdsAndLength>
        } else {
          return undefined
        }
      },
      /**
       * #getter
       */
      get samples() {
        if (this.rowNames) {
          const volatileSamplesMap = self.volatileSamples
            ? Object.fromEntries(self.volatileSamples.map(e => [e.id, e]))
            : undefined
          return normalize(this.rowNames).map(r => ({
            ...r,
            label: volatileSamplesMap?.[r.id]?.label || r.label,
            color: volatileSamplesMap?.[r.id]?.color || r.color,
          }))
        } else {
          return self.volatileSamples
        }
      },

      /**
       * #getter
       */
      get totalHeight() {
        return this.samples ? this.samples.length * self.rowHeight : 1
      },
      /**
       * #getter
       */
      get leaves() {
        return self.root?.leaves()
      },
      /**
       * #getter
       */
      get rowNames(): string[] | undefined {
        return this.leaves?.map(n => n.data.name)
      },
    }))
    .views(self => {
      const {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        trackMenuItems: superTrackMenuItems,
        // eslint-disable-next-line @typescript-eslint/unbound-method
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
          const {
            showAllLetters,
            rendererConfig,
            samples,
            rowHeight,
            rowProportion,
            mismatchRendering,
            showAsUpperCase,
          } = self
          const s = superRenderProps()
          return {
            ...s,
            notReady:
              (!self.volatileSamples && !self.volatileTree) || super.notReady,
            config: rendererConfig,
            samples,
            rowHeight,
            rowProportion,
            showAllLetters,
            mismatchRendering,
            showAsUpperCase,
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
              label: 'Use upper-case',
              type: 'checkbox',
              checked: self.showAsUpperCase,
              onClick: () => {
                self.setShowAsUpperCase(!self.showAsUpperCase)
              },
            },
            {
              label: 'Show all letters',
              type: 'checkbox',
              checked: self.showAllLetters,
              onClick: () => {
                self.setShowAllLetters(!self.showAllLetters)
              },
            },
            {
              label: 'Draw mismatches as single color',
              type: 'checkbox',
              checked: !self.mismatchRendering,
              onClick: () => {
                self.setMismatchRendering(!self.mismatchRendering)
              },
            },
          ]
        },
      }
    })
    .views(self => ({
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
    }))
    .actions(self => ({
      afterCreate() {
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
                      self.setMessage(message)
                    }
                  },
                })) as { samples: Sample[]; tree: unknown },
              )
            } catch (e) {
              console.error(e)
              getSession(self).notifyError(`${e}`, e)
            }
          }),
        )
      },
    }))
    .actions(self => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
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
}

export type LinearMafDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearMafDisplayModel = Instance<LinearMafDisplayStateModel>
