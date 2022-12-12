import React from 'react'
import { autorun, when } from 'mobx'
import {
  addDisposer,
  getSnapshot,
  isAlive,
  types,
  Instance,
  IStateTreeNode,
} from 'mobx-state-tree'
import deepEqual from 'fast-deep-equal'

// jbrowse
import {
  ConfigurationReference,
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  getConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'

const minDisplayHeight = 20

function getLowerPanelDisplays(pluginManager: PluginManager) {
  return (
    pluginManager
      .getDisplayElements()
      // @ts-ignore
      .filter(f => f.subDisplay?.type === 'LinearAlignmentsDisplay')
      // @ts-ignore
      .filter(f => f.subDisplay?.lowerPanel)
  )
}

function deepSnap<T extends IStateTreeNode, U extends IStateTreeNode>(
  x1: T,
  x2: U,
) {
  return deepEqual(getSnapshot(x1), getSnapshot(x2))
}

function propagateKey(self: AlignmentsDisplayModel, key: string) {
  const { PileupDisplay, SNPCoverageDisplay } = self
  if (!PileupDisplay || !isAlive(PileupDisplay) || !PileupDisplay[key]) {
    return
  }
  if (!deepSnap(PileupDisplay[key], SNPCoverageDisplay.colorBy)) {
    SNPCoverageDisplay.setFilterBy(getSnapshot(PileupDisplay[key]))
  }
}

function AlignmentsModel(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const lowerPanelDisplays = getLowerPanelDisplays(pluginManager).map(
    f => f.stateModel,
  )

  return types.model({
    /**
     * #property
     * refers to LinearPileupDisplay sub-display model
     */
    // @ts-ignore
    PileupDisplay: types.maybe(types.union(...lowerPanelDisplays)),
    /**
     * #property
     * refers to LinearSNPCoverageDisplay sub-display model
     */
    SNPCoverageDisplay: types.maybe(
      pluginManager.getDisplayType('LinearSNPCoverageDisplay').stateModel,
    ),
    /**
     * #property
     */
    snpCovHeight: 45,
    /**
     * #property
     */
    type: types.literal('LinearAlignmentsDisplay'),
    /**
     * #property
     */
    configuration: ConfigurationReference(configSchema),
    /**
     * #property
     */
    height: 250,
    /**
     * #property
     */
    userFeatureScreenDensity: types.maybe(types.number),
    /**
     * #property
     */
    lowerPanelType: 'LinearPileupDisplay',
  })
}

/**
 * #stateModel LinearAlignmentsDisplay
 * extends `BaseDisplay`
 */
function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearAlignmentsDisplay',
      BaseDisplay,
      AlignmentsModel(pluginManager, configSchema),
    )
    .volatile(() => ({
      scrollTop: 0,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setScrollTop(scrollTop: number) {
        self.scrollTop = scrollTop
      },

      /**
       * #action
       */
      setSNPCoverageHeight(n: number) {
        self.snpCovHeight = n
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get pileupConf() {
        const conf = getConf(self, 'pileupDisplay')
        return {
          ...conf,
          type: self.lowerPanelType,
          displayId: `${self.configuration.displayId}_${self.lowerPanelType}_xyz`, // xyz to avoid someone accidentally naming the displayId similar to this
        }
      },

      /**
       * #method
       */
      getFeatureByID(blockKey: string, id: string) {
        return self.PileupDisplay.getFeatureByID(blockKey, id)
      },
      /**
       * #method
       */
      searchFeatureByID(id: string) {
        return self.PileupDisplay.searchFeatureByID(id)
      },

      /**
       * #getter
       */
      get features() {
        return self.PileupDisplay.features
      },

      /**
       * #getter
       */
      get DisplayBlurb() {
        return self.PileupDisplay?.DisplayBlurb
      },

      /**
       * #getter
       */
      get sortedBy() {
        return self.PileupDisplay.sortedBy
      },

      /**
       * #getter
       */
      get coverageConf() {
        const conf = getConf(self, 'snpCoverageDisplay')
        return {
          ...conf,
          displayId: `${self.configuration.displayId}_snpcoverage_xyz`, // xyz to avoid someone accidentally naming the displayId similar to this
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setSNPCoverageDisplay(configuration: AnyConfigurationModel) {
        self.SNPCoverageDisplay = {
          type: 'LinearSNPCoverageDisplay',
          configuration,
          height: self.snpCovHeight,
        }
      },
      /**
       * #action
       */
      updateStatsLimit(stats: unknown) {
        self.PileupDisplay.updateStatsLimit(stats)
        self.SNPCoverageDisplay.updateStatsLimit(stats)
      },

      /**
       * #action
       */
      setPileupDisplay(configuration: AnyConfigurationModel) {
        self.PileupDisplay = {
          type: configuration.type || 'LinearPileupDisplay',
          configuration,
        }
      },
      /**
       * #action
       */
      setHeight(n: number) {
        self.height = Math.max(n, minDisplayHeight)
        return self.height
      },
      /**
       * #action
       */
      setLowerPanelType(type: string) {
        self.lowerPanelType = type
      },
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = this.setHeight(self.height + distance)
        return newHeight - oldHeight
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            const {
              SNPCoverageDisplay,
              PileupDisplay,
              coverageConf,
              pileupConf,
            } = self

            if (!SNPCoverageDisplay) {
              self.setSNPCoverageDisplay(coverageConf)
            } else if (
              !deepEqual(
                coverageConf,
                getSnapshot(SNPCoverageDisplay.configuration),
              )
            ) {
              SNPCoverageDisplay.setHeight(self.snpCovHeight)
              SNPCoverageDisplay.setConfig(self.coverageConf)
            }

            if (!PileupDisplay || self.lowerPanelType !== PileupDisplay.type) {
              self.setPileupDisplay(pileupConf)
            } else if (
              !deepEqual(pileupConf, getSnapshot(PileupDisplay.configuration))
            ) {
              PileupDisplay.setConfig(self.pileupConf)
            }

            propagateKey(self as AlignmentsDisplayModel, 'colorBy')
            propagateKey(self as AlignmentsDisplayModel, 'filterBy')
          }),
        )

        addDisposer(
          self,
          autorun(() => {
            self.setSNPCoverageHeight(self.SNPCoverageDisplay.height)
          }),
        )

        addDisposer(
          self,
          autorun(() => {
            self.PileupDisplay.setHeight(
              self.height - self.SNPCoverageDisplay.height,
            )
          }),
        )
      },
      /**
       * #action
       */
      async renderSvg(opts: { rasterizeLayers?: boolean }) {
        const pileupHeight = self.height - self.SNPCoverageDisplay.height
        await when(() => self.PileupDisplay.ready)
        return (
          <>
            <g>{await self.SNPCoverageDisplay.renderSvg(opts)}</g>
            <g transform={`translate(0 ${self.SNPCoverageDisplay.height})`}>
              {await self.PileupDisplay.renderSvg({
                ...opts,
                overrideHeight: pileupHeight,
              })}
            </g>
          </>
        )
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #method
         */
        trackMenuItems(): MenuItem[] {
          const extra = getLowerPanelDisplays(pluginManager).map(d => ({
            type: 'radio',
            label: d.displayName,
            checked: d.name === self.PileupDisplay.type,
            onClick: () => self.setLowerPanelType(d.name),
          }))
          return [
            ...superTrackMenuItems(),
            {
              type: 'subMenu',
              label: 'Pileup settings',
              subMenu: self.PileupDisplay.trackMenuItems(),
            },
            {
              type: 'subMenu',
              label: 'SNPCoverage settings',
              subMenu: self.SNPCoverageDisplay.trackMenuItems(),
            },
            {
              type: 'subMenu',
              label: `Replace lower panel with...`,
              subMenu: extra,
            },
          ]
        },
      }
    })
}

export default stateModelFactory
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
