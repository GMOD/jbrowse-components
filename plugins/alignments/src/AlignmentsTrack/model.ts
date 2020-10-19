import { getConf, ConfigurationReference } from '@jbrowse/core/configuration'

import deepEqual from 'deep-equal'
import { BaseTrack } from '@jbrowse/plugin-linear-genome-view'
import { types, addDisposer, getSnapshot, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'

import VisibilityIcon from '@material-ui/icons/Visibility'
import { MenuItem } from '@jbrowse/core/ui'
import AlignmentsTrackComponent from './components/AlignmentsTrack'
import { AlignmentsConfigModel } from './configSchema'

const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: AlignmentsConfigModel,
) => {
  return types
    .compose(
      'AlignmentsTrack',
      BaseTrack,
      types
        .model({
          PileupTrack: types.maybe(
            pluginManager.getTrackType('PileupTrack').stateModel,
          ),
          SNPCoverageTrack: types.maybe(
            pluginManager.getTrackType('SNPCoverageTrack').stateModel,
          ),
          type: types.literal('AlignmentsTrack'),
          configuration: ConfigurationReference(configSchema),
          height: 250,
          showCoverage: true,
          showPileup: true,
        })
        .volatile(() => ({
          ReactComponent: (AlignmentsTrackComponent as unknown) as React.FC,
        })),
    )
    .actions(self => ({
      toggleCoverage() {
        self.showCoverage = !self.showCoverage
      },
      togglePileup() {
        self.showPileup = !self.showPileup
      },
    }))
    .views(self => {
      const { trackMenuItems } = self
      return {
        get pileupTrackConfig() {
          const conf = getConf(self)
          const { SNPCoverageRenderer, ...rest } = conf.renderers
          return {
            ...conf,
            renderers: {
              ...rest,
            },
            type: 'PileupTrack',
            name: `${getConf(self, 'name')} pileup`,
            trackId: `${self.configuration.trackId}_pileup_xyz`, // xyz to avoid someone accidentally namign the trackId similar to this
          }
        },

        get layoutFeatures() {
          return self.PileupTrack.layoutFeatures
        },

        get features() {
          return self.PileupTrack.features
        },

        get TrackBlurb() {
          return self.PileupTrack.TrackBlurb
        },

        get sortedBy() {
          return self.PileupTrack.sortedBy
        },
        get sortedByPosition() {
          return self.PileupTrack.sortedByPosition
        },
        get sortedByRefName() {
          return self.PileupTrack.sortedByRefName
        },

        get snpCoverageTrackConfig() {
          const conf = getConf(self)
          const { SNPCoverageRenderer } = conf.renderers
          return {
            ...conf,
            renderers: {
              SNPCoverageRenderer,
            },
            type: 'SNPCoverageTrack',
            name: `${getConf(self, 'name')} snpcoverage`,
            trackId: `${self.configuration.trackId}_snpcoverage_xyz`, // xyz to avoid someone accidentally namign the trackId similar to this
            adapter: {
              type: 'SNPCoverageAdapter',
              subadapter: getConf(self, 'adapter'),
            },
          }
        },

        get trackMenuItems(): MenuItem[] {
          return [
            ...trackMenuItems,
            {
              label: 'Show coverage track',
              icon: VisibilityIcon,
              type: 'checkbox',
              onClick: self.toggleCoverage,
              checked: self.showCoverage,
            },
            {
              label: 'Show pileup track',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: self.showPileup,
              onClick: self.togglePileup,
            },
            ...self.PileupTrack.composedTrackMenuItems,
            ...self.SNPCoverageTrack.composedTrackMenuItems,
          ]
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            if (!self.SNPCoverageTrack) {
              this.setSNPCoverageTrack(self.snpCoverageTrackConfig)
            } else if (
              !deepEqual(
                self.snpCoverageTrackConfig,
                getSnapshot(self.SNPCoverageTrack.configuration),
              )
            ) {
              self.SNPCoverageTrack.setConfig(self.snpCoverageTrackConfig)
            }

            if (!self.PileupTrack) {
              this.setPileupTrack(self.pileupTrackConfig)
            } else if (
              !deepEqual(
                self.pileupTrackConfig,
                getSnapshot(self.PileupTrack.configuration),
              )
            ) {
              self.PileupTrack.setConfig(self.pileupTrackConfig)
            }
          }),
        )
      },
      setSNPCoverageTrack(trackConfig: AnyConfigurationModel) {
        self.SNPCoverageTrack = {
          type: 'SNPCoverageTrack',
          configuration: trackConfig,
        }
        self.SNPCoverageTrack.height = 40
      },
      setPileupTrack(trackConfig: AnyConfigurationModel) {
        self.PileupTrack = {
          type: 'PileupTrack',
          configuration: trackConfig,
        }
      },
    }))
}

export default stateModelFactory
export type AlignmentsTrackStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsTrackModel = Instance<AlignmentsTrackStateModel>
