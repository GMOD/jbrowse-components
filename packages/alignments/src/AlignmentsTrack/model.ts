import {
  getConf,
  ConfigurationReference,
} from '@gmod/jbrowse-core/configuration'
import { getContainingView } from '@gmod/jbrowse-core/util/tracks'
import { BaseTrack } from '@gmod/jbrowse-plugin-linear-genome-view'
import { MenuOptions } from '@gmod/jbrowse-core/ui'
import { types, addDisposer } from 'mobx-state-tree'
import { autorun } from 'mobx'
import AlignmentsTrackComponent from './components/AlignmentsTrack'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (pluginManager: any, configSchema: any) => {
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
          centerLinePosition: types.maybe(types.number),
          sortedBy: '',
          showCoverage: true,
          showPileup: true,
          hideHeader: false,
        })
        .volatile(() => ({
          ReactComponent: AlignmentsTrackComponent,
        })),
    )
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
      get sortOptions() {
        return [
          'Start Location',
          'Read Strand',
          'First-of-pair strand',
          'Base Pair',
          'Clear Sort',
        ]
      },
      get menuOptions(): MenuOptions[] {
        return [
          {
            label: self.showCoverage
              ? 'Hide Coverage Track'
              : 'Show Coverage Track',
            icon: self.showCoverage ? 'visibility_off' : 'visibility',
            onClick: self.toggleCoverage,
            disabled: !self.showPileup,
          },
          {
            label: self.showPileup ? 'Hide Pileup Track' : 'Show Pileup Track',
            icon: self.showPileup ? 'visibility_off' : 'visibility',
            onClick: self.togglePileup,
            disabled: !self.showCoverage,
          },
          {
            label: 'Sort by',
            icon: 'sort',
            subMenu: self.sortOptions.map((option: string) => {
              return {
                label: option,
                type: option !== 'Clear Sort' && 'radio',
                checked: self.sortedBy === option,
                onClick:
                  option === 'Clear Sort' || self.sortedBy === option
                    ? self.clearSelected
                    : () => self.sortSelected(option),
              }
            }),
          },
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSNPCoverageTrack(trackConfig: any) {
        self.SNPCoverageTrack = {
          type: 'SNPCoverageTrack',
          configuration: trackConfig,
        }
        self.SNPCoverageTrack.height = 40
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPileupTrack(trackConfig: any) {
        self.PileupTrack = {
          type: 'PileupTrack',
          configuration: trackConfig,
        }
      },
      clearSelected() {
        self.sortedBy = ''
        self.centerLinePosition = undefined
      },
      sortSelected(selected: string) {
        self.sortedBy = selected
        self.centerLinePosition = getContainingView(self).centerLinePosition
      },
      toggleCoverage() {
        self.showCoverage = !self.showCoverage
      },
      togglePileup() {
        self.showPileup = !self.showPileup
      },
    }))
}
