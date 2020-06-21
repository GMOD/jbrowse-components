import React from 'react'
import {
  getConf,
  ConfigurationReference,
} from '@gmod/jbrowse-core/configuration'
import { BaseTrack } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types, addDisposer, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import PluginManager from '@gmod/jbrowse-core/PluginManager'

import VisibilityIcon from '@material-ui/icons/Visibility'
import { MenuOption } from '@gmod/jbrowse-core/ui'
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
    .views(self => ({
      get pileupTrackConfig() {
        return {
          ...getConf(self),
          type: 'PileupTrack',
          name: `${getConf(self, 'name')} pileup`,
          trackId: `${self.configuration.trackId}_pileup`,
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
        return {
          ...getConf(self),
          type: 'SNPCoverageTrack',
          name: `${getConf(self, 'name')} snpcoverage`,
          trackId: `${self.configuration.trackId}_snpcoverage`,
          adapter: {
            type: 'SNPCoverageAdapter',
            subadapter: getConf(self, 'adapter'),
          },
        }
      },

      get menuOptions(): MenuOption[] {
        return [
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
          ...self.PileupTrack.menuOptions,
          ...self.SNPCoverageTrack.menuOptions,
        ]
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            this.setSNPCoverageTrack(self.snpCoverageTrackConfig)
            this.setPileupTrack(self.pileupTrackConfig)
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

      async renderSvg() {
        return (
          <>
            <g id="snpcov">{await self.SNPCoverageTrack.renderSvg()}</g>
            <g
              id="pileup"
              transform={`translate(0 ${self.SNPCoverageTrack.height})`}
            >
              {await self.PileupTrack.renderSvg()}
            </g>
          </>
        )
      },
    }))
}

export default stateModelFactory
export type AlignmentsTrackStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsTrackModel = Instance<AlignmentsTrackStateModel>
