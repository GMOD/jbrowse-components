import {
  getConf,
  ConfigurationReference,
} from '@gmod/jbrowse-core/configuration'
import { getContainingView } from '@gmod/jbrowse-core/util/tracks'
import { BaseTrack } from '@gmod/jbrowse-plugin-linear-genome-view'
import { MenuOptions } from '@gmod/jbrowse-core/ui'
import { getSession } from '@gmod/jbrowse-core/util'
import { types, getSnapshot, addDisposer } from 'mobx-state-tree'
import { autorun } from 'mobx'
import jsonStableStringify from 'json-stable-stringify'
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
          showCoverage: true,
          showPileup: true,
          hideHeader: false,
        })
        .volatile(() => ({
          ReactComponent: AlignmentsTrackComponent,
          sortedBy: '',
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
          'First-of-pair Strand',
          'Base Pair',
          'Read Group',
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
                onClick: () => getContainingView(self).sortAll(option),
                // option === 'Clear Sort'
                //   ? self.clearSelected
                //   : () => self.sortSelected(option),
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
      // TODOSORT: only fires for the specific pileup track you right click on, want to fire for all
      sortSelected(selected: string) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { assemblyData, rpcManager } = getSession(self) as any
        const centerLine = getContainingView(self).centerLinePosition
        const centerBp = Math.round(centerLine.offset) + 1

        const region = {
          refName: centerLine.refName,
          start: centerBp,
          end: centerBp + 1,
          assemblyName: centerLine.assemblyName,
        }
        const adapterConfigId = jsonStableStringify(getConf(self, 'adapter'))

        const trackAssemblyData =
          (assemblyData && assemblyData.get(region.assemblyName)) || {}

        let sequenceConfig: { type?: string } = {}
        if (trackAssemblyData.sequence) {
          sequenceConfig = getSnapshot(trackAssemblyData.sequence.adapter)
        }

        // render just the sorted region first
        self.PileupTrack.rendererType
          .renderInClient(rpcManager, {
            assemblyName: region.assemblyName,
            region,
            adapterType: self.PileupTrack.adapterType.name,
            adapterConfig: getConf(self, 'adapter'),
            sequenceAdapterType: sequenceConfig.type,
            sequenceAdapterConfig: sequenceConfig,
            rendererType: self.PileupTrack.rendererType.name,
            renderProps: {
              ...self.PileupTrack.renderProps,
              sortObject: {
                position: centerBp,
                by: selected,
              },
            },
            sessionId: adapterConfigId,
            timeout: 1000000,
          })
          .then(() => {
            this.applySortSelected(selected)
          })
      },
      applySortSelected(selected: string) {
        self.sortedBy = selected
        self.centerLinePosition =
          Math.round(getContainingView(self).centerLinePosition.offset) + 1
      },
      toggleCoverage() {
        self.showCoverage = !self.showCoverage
      },
      togglePileup() {
        self.showPileup = !self.showPileup
      },
    }))
}
