import {
  getConf,
  ConfigurationReference,
} from '@gmod/jbrowse-core/configuration'
import { BaseTrack } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types, addDisposer, getParent } from 'mobx-state-tree'
import { autorun } from 'mobx'
import AlignmentsTrackComponent from './components/AlignmentsTrack'

export default (pluginManager, configSchema) => {
  return types.compose(
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
        centerLinePosition: 0,
        sortedBy: '',
        showCoverage: true,
        showPileup: true,
        showCenterLine: false,
        hideHeader: false,
      })
      .volatile(() => ({
        ReactComponent: AlignmentsTrackComponent,
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
        get menuOptions() {
          return [
            {
              title: self.showCoverage
                ? 'Hide Coverage Track'
                : 'Show Coverage Track',
              key: 'showCoverage',
              icon: self.showCoverage ? 'visibility_off' : 'visibility',
              callback: self.toggleCoverage,
              disableCondition: !self.showPileup,
            },
            {
              title: self.showPileup
                ? 'Hide Pileup Track'
                : 'Show Pileup Track',
              key: 'showPileup',
              icon: self.showPileup ? 'visibility_off' : 'visibility',
              callback: self.togglePileup,
              disableCondition: !self.showCoverage,
            },
            {
              title: self.showCenterLine
                ? 'Hide Center Line'
                : 'Show Center Line',
              key: 'showCenterLine',
              icon: self.showCenterLine ? 'visibility_off' : 'visibility',
              callback: self.toggleCenterLine,
            },
          ]
        },
        get subMenuOptions() {
          return [
            {
              title: 'Start Location',
              key: 'start',
            },
            {
              title: 'Read Strand',
              key: 'read',
            },
            {
              title: 'First-of-pair strand',
              key: 'first',
            },
            {
              title: 'Clear Sort',
              key: '',
            },
          ]
        },
        calculateCenterLine() {
          const LGVModel = getParent(getParent(self))
          const centerLinePosition = LGVModel.displayedRegionsInOrder.length
            ? LGVModel.pxToBp(LGVModel.viewingRegionWidth / 2).offset
            : 0
          return centerLinePosition
        },
      }))
      .actions(self => ({
        afterAttach() {
          addDisposer(
            self,
            autorun(() => {
              self.setTrack('PileupTrack', self.pileupTrackConfig)
              self.setTrack('SNPCoverageTrack', self.snpCoverageTrackConfig)
            }),
          )
        },
        setTrack(trackType, trackConfig) {
          self[trackType] = {
            type: `${trackType}`,
            configuration: trackConfig,
          }
        },
        setCenterLine() {
          self.centerLinePosition = self.calculateCenterLine()
        },
        sortSelected(selected) {
          self.sortedBy = selected
        },
        toggleCenterLine() {
          self.showCenterLine = !self.showCenterLine
          if (self.showCenterLine) self.setCenterLine()
        },
        toggleCoverage() {
          self.showCoverage = !self.showCoverage
        },
        togglePileup() {
          self.showPileup = !self.showPileup
        },
      })),
  )
}
