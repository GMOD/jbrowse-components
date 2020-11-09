import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'
import deepEqual from 'deep-equal'
import { autorun } from 'mobx'
import {
  addDisposer,
  getParent,
  getSnapshot,
  Instance,
  types,
} from 'mobx-state-tree'
import { AlignmentsConfigModel } from './configSchema'

const minDisplayHeight = 20
const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: AlignmentsConfigModel,
) => {
  return types
    .compose(
      'LinearAlignmentsDisplay',
      BaseDisplay,
      types.model({
        PileupDisplay: types.maybe(
          pluginManager.getDisplayType('LinearPileupDisplay').stateModel,
        ),
        SNPCoverageDisplay: types.maybe(
          pluginManager.getDisplayType('LinearSNPCoverageDisplay').stateModel,
        ),
        type: types.literal('LinearAlignmentsDisplay'),
        configuration: ConfigurationReference(configSchema),
        height: 250,
        showCoverage: true,
        showPileup: true,
      }),
    )
    .volatile(() => ({
      scrollTop: 0,
    }))
    .actions(self => ({
      toggleCoverage() {
        self.showCoverage = !self.showCoverage
      },
      togglePileup() {
        self.showPileup = !self.showPileup
      },
      setScrollTop(scrollTop: number) {
        self.scrollTop = scrollTop
      },
    }))
    .views(self => {
      const { trackMenuItems } = self
      return {
        get pileupDisplayConfig() {
          const conf = getConf(self)
          const { SNPCoverageRenderer, ...rest } = conf.renderers
          return {
            ...conf,
            renderers: {
              ...rest,
            },
            type: 'LinearPileupDisplay',
            name: `${getConf(getParent(self, 2), 'name')} pileup`,
            displayId: `${self.configuration.displayId}_pileup_xyz`, // xyz to avoid someone accidentally naming the displayId similar to this
          }
        },

        get layoutFeatures() {
          return self.PileupDisplay.layoutFeatures
        },

        get features() {
          return self.PileupDisplay.features
        },

        get DisplayBlurb() {
          return self.PileupDisplay?.DisplayBlurb
        },

        get sortedBy() {
          return self.PileupDisplay.sortedBy
        },
        get sortedByPosition() {
          return self.PileupDisplay.sortedByPosition
        },
        get sortedByRefName() {
          return self.PileupDisplay.sortedByRefName
        },

        get snpCoverageDisplayConfig() {
          const conf = getConf(self)
          const { SNPCoverageRenderer } = conf.renderers
          return {
            ...conf,
            renderers: {
              SNPCoverageRenderer,
            },
            type: 'LinearSNPCoverageDisplay',
            name: `${getConf(getParent(self, 2), 'name')} pileup`,
            displayId: `${self.configuration.displayId}_snpcoverage_xyz`, // xyz to avoid someone accidentally naming the displayId similar to this
          }
        },

        get trackMenuItems(): MenuItem[] {
          return [
            ...trackMenuItems,
            ...self.PileupDisplay.composedTrackMenuItems,
            ...self.SNPCoverageDisplay.composedTrackMenuItems,
          ]
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            if (!self.SNPCoverageDisplay) {
              // @ts-ignore
              self.setSNPCoverageDisplay(self.snpCoverageDisplayConfig)
            } else if (
              !deepEqual(
                self.snpCoverageDisplayConfig,
                getSnapshot(self.SNPCoverageDisplay.configuration),
              )
            ) {
              self.SNPCoverageDisplay.setConfig(self.snpCoverageDisplayConfig)
            }

            if (!self.PileupDisplay) {
              // @ts-ignore
              self.setPileupDisplay(self.pileupDisplayConfig)
            } else if (
              !deepEqual(
                self.pileupDisplayConfig,
                getSnapshot(self.PileupDisplay.configuration),
              )
            ) {
              self.PileupDisplay.setConfig(self.pileupDisplayConfig)
            }
          }),
        )
      },
      setSNPCoverageDisplay(displayConfig: AnyConfigurationModel) {
        self.SNPCoverageDisplay = {
          type: 'LinearSNPCoverageDisplay',
          configuration: displayConfig,
          height: 40,
        }
      },
      setPileupDisplay(displayConfig: AnyConfigurationModel) {
        self.PileupDisplay = {
          type: 'LinearPileupDisplay',
          configuration: displayConfig,
        }
      },
      setHeight(displayHeight: number) {
        if (displayHeight > minDisplayHeight) self.height = displayHeight
        else self.height = minDisplayHeight
        return self.height
      },
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = this.setHeight(self.height + distance)
        return newHeight - oldHeight
      },
    }))
}

export default stateModelFactory
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
