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
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  getConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'
import { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'

// locals
import { LinearAlignmentsDisplayMixin } from './alignmentsModel'
import { getLowerPanelDisplays } from './util'

const minDisplayHeight = 20

function deepSnap<T extends IStateTreeNode, U extends IStateTreeNode>(
  x1: T,
  x2: U,
) {
  return deepEqual(
    x1 ? getSnapshot(x1) : undefined,
    x2 ? getSnapshot(x2) : undefined,
  )
}

function preCheck(self: AlignmentsDisplayModel) {
  const { PileupDisplay, SNPCoverageDisplay } = self
  return (
    PileupDisplay ||
    isAlive(PileupDisplay) ||
    SNPCoverageDisplay ||
    isAlive(SNPCoverageDisplay)
  )
}

function propagateColorBy(self: AlignmentsDisplayModel) {
  const { PileupDisplay, SNPCoverageDisplay } = self
  if (!preCheck(self) || !PileupDisplay.colorBy) {
    return
  }
  if (!deepSnap(PileupDisplay.colorBy, SNPCoverageDisplay.colorBy)) {
    SNPCoverageDisplay.setColorBy(getSnapshot(PileupDisplay.colorBy))
  }
}

function propagateFilterBy(self: AlignmentsDisplayModel) {
  const { PileupDisplay, SNPCoverageDisplay } = self
  if (!preCheck(self) || !PileupDisplay.filterBy) {
    return
  }
  if (!deepSnap(PileupDisplay.filterBy, SNPCoverageDisplay.filterBy)) {
    SNPCoverageDisplay.setFilterBy(getSnapshot(PileupDisplay.filterBy))
  }
}

/**
 * #stateModel LinearAlignmentsDisplay
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [LinearAlignmentsDisplayMixin](../linearalignmentsdisplaymixin)
 */
function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearAlignmentsDisplay',
      BaseDisplay,
      LinearAlignmentsDisplayMixin(pluginManager, configSchema),
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
      get height() {
        return self.heightPreConfig ?? getConf(self, 'height')
      },

      /**
       * #getter
       */
      get featureIdUnderMouse() {
        return (
          self.PileupDisplay.featureIdUnderMouse ||
          self.SNPCoverageDisplay.featureIdUnderMouse
        )
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
        return self.PileupDisplay.searchFeatureByID?.(id)
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
      setFeatureDensityStatsLimit(stats?: FeatureDensityStats) {
        self.PileupDisplay.setFeatureDensityStatsLimit(stats)
        self.SNPCoverageDisplay.setFeatureDensityStatsLimit(stats)
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
        self.heightPreConfig = Math.max(n, minDisplayHeight)
        return self.heightPreConfig
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

            propagateColorBy(self as AlignmentsDisplayModel)
            propagateFilterBy(self as AlignmentsDisplayModel)
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
        await when(
          () =>
            !self.PileupDisplay.renderProps().notReady &&
            !self.SNPCoverageDisplay.renderProps().notReady,
        )
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
          if (!self.PileupDisplay) {
            return []
          }
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
    .preProcessSnapshot(snap => {
      if (!snap) {
        return snap
      }
      // @ts-expect-error
      const { height, ...rest } = snap
      return { heightPreConfig: height, ...rest }
    })
}

export default stateModelFactory
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
