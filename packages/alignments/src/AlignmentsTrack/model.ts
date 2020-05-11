import {
  getConf,
  ConfigurationReference,
} from '@gmod/jbrowse-core/configuration'
import { BaseTrack } from '@gmod/jbrowse-plugin-linear-genome-view'
import { MenuOption } from '@gmod/jbrowse-core/ui'
import { getSession, getContainingView } from '@gmod/jbrowse-core/util'
import { types, addDisposer, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'
import jsonStableStringify from 'json-stable-stringify'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
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

      get features() {
        return self.PileupTrack.features
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
        return ['Start location', 'Read strand', 'Base pair', 'Clear sort']
      },
      get menuOptions(): MenuOption[] {
        return [
          {
            label: self.showCoverage
              ? 'Hide coverage track'
              : 'Show coverage track',
            icon: self.showCoverage ? 'visibility_off' : 'visibility',
            onClick: self.toggleCoverage,
            disabled: !self.showPileup,
          },
          {
            label: self.showPileup ? 'Hide pileup track' : 'Show pileup track',
            icon: self.showPileup ? 'visibility_off' : 'visibility',
            onClick: self.togglePileup,
            disabled: !self.showCoverage,
          },
        ]
      },

      get viewMenuActions(): MenuOption[] {
        return [
          {
            label: 'Sort by',
            icon: 'sort',
            subMenu: self.sortOptions.map((option: string) => {
              return {
                label: option,
                onClick: (object: typeof self) =>
                  option === 'Clear sort'
                    ? object.clearSelected()
                    : object.sortSelected(option),
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { assemblyData, rpcManager } = getSession(self) as any
        const { centerLineInfo } = getContainingView(self) as Instance<
          LinearGenomeViewStateModel
        >
        if (!centerLineInfo) return
        const centerBp = Math.round(centerLineInfo.offset) + 1

        if (centerBp < 0) return

        const regions = [
          {
            refName: centerLineInfo.refName,
            start: centerBp,
            end: centerBp + 1,
            assemblyName: centerLineInfo.assemblyName,
          },
        ]
        const adapterConfigId = jsonStableStringify(getConf(self, 'adapter'))

        // render just the sorted region first
        self.PileupTrack.rendererType
          .renderInClient(rpcManager, {
            assemblyName: regions[0].assemblyName,
            regions,
            adapterConfig: getConf(self, 'adapter'),
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
            this.applySortSelected(selected, centerBp)
          })
      },
      applySortSelected(selected: string, centerBp: number) {
        self.sortedBy = selected
        self.centerLinePosition = centerBp
      },
      toggleCoverage() {
        self.showCoverage = !self.showCoverage
      },
      togglePileup() {
        self.showPileup = !self.showPileup
      },
    }))
}
