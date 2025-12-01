import { getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { addDisposer, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import deepEqual from 'fast-deep-equal'
import { autorun } from 'mobx'

import { LinearAlignmentsDisplayMixin } from './alignmentsModel'
import { getLowerPanelDisplays } from './util'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

const minDisplayHeight = 20

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
      /**
       * #volatile
       */
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

      /**
       * #method
       */
      notReady() {
        return (
          self.PileupDisplay?.renderProps().notReady ||
          self.SNPCoverageDisplay?.renderProps().notReady
        )
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
          autorun(
            function alignmentsDisplayConfigAutorun() {
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

              if (
                !PileupDisplay ||
                self.lowerPanelType !== PileupDisplay.type
              ) {
                self.setPileupDisplay(pileupConf)
              } else if (
                !deepEqual(pileupConf, getSnapshot(PileupDisplay.configuration))
              ) {
                PileupDisplay.setConfig(self.pileupConf)
              }
            },
            { name: 'AlignmentsDisplayConfig' },
          ),
        )

        addDisposer(
          self,
          autorun(
            function snpCoverageHeightAutorun() {
              self.setSNPCoverageHeight(self.SNPCoverageDisplay.height)
            },
            { name: 'SNPCoverageHeight' },
          ),
        )

        addDisposer(
          self,
          autorun(
            function pileupHeightAutorun() {
              self.PileupDisplay.setHeight(
                self.height - self.SNPCoverageDisplay.height,
              )
            },
            { name: 'PileupHeight' },
          ),
        )
      },
      /**
       * #action
       */
      async renderSvg(opts: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg')
        return renderSvg(self, opts)
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
            onClick: () => {
              self.setLowerPanelType(d.name)
            },
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
              label: 'Replace lower panel with...',
              subMenu: extra,
            },
          ]
        },
      }
    })
    .preProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      // @ts-expect-error
      const { height, ...rest } = snap
      return { heightPreConfig: height, ...rest }
    })
}

export default stateModelFactory

export type LinearAlignmentsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearAlignmentsDisplayModel =
  Instance<LinearAlignmentsDisplayStateModel>
