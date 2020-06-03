import {
  getConf,
  ConfigurationReference,
} from '@gmod/jbrowse-core/configuration'
import { BaseTrack } from '@gmod/jbrowse-plugin-linear-genome-view'
import { MenuOption } from '@gmod/jbrowse-core/ui'
import { getSession, getContainingView } from '@gmod/jbrowse-core/util'
import { types, addDisposer, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'
import { LinearGenomeViewModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { getRpcSessionId } from '@gmod/jbrowse-core/util/tracks'
import SortIcon from '@material-ui/icons/Sort'
import VisibilityIcon from '@material-ui/icons/Visibility'
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff'
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
          centerLinePosition: types.maybe(types.number),
          showCoverage: true,
          showPileup: true,
          hideHeader: false,
        })
        .volatile(() => ({
          ReactComponent: AlignmentsTrackComponent,
          sortedBy: '',
          showSoftClipping: false,
        })),
    )
    .actions(self => ({
      toggleCoverage() {
        self.showCoverage = !self.showCoverage
      },
      togglePileup() {
        self.showPileup = !self.showPileup
      },
      toggleSoftClipping() {
        self.showSoftClipping = !self.showSoftClipping
      },
      clearSelected() {
        self.sortedBy = ''
        self.centerLinePosition = undefined
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
            icon: self.showCoverage ? VisibilityOffIcon : VisibilityIcon,
            onClick: self.toggleCoverage,
            disabled: !self.showPileup,
          },
          {
            label: self.showPileup ? 'Hide pileup track' : 'Show pileup track',
            icon: self.showPileup ? VisibilityOffIcon : VisibilityIcon,
            onClick: self.togglePileup,
            disabled: !self.showCoverage,
          },
          {
            label: self.showSoftClipping
              ? 'Hide soft clipping'
              : 'Show soft clipping',
            icon: self.showSoftClipping ? VisibilityOffIcon : VisibilityIcon,
            onClick: () => {
              self.toggleSoftClipping()
              // if toggling from off to on, will break sort for this track so clear it
              if (self.showSoftClipping) self.clearSelected()
            },
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
      sortSelected(selected: string) {
        const { rpcManager } = getSession(self)
        const { centerLineInfo } = getContainingView(
          self,
        ) as LinearGenomeViewModel
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
            sessionId: getRpcSessionId(self),
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
    }))
    .views(self => ({
      get viewMenuActions(): MenuOption[] {
        return [
          {
            label: 'Sort by',
            icon: SortIcon,
            disabled: self.showSoftClipping,
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
}

export default stateModelFactory
export type AlignmentsTrackStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsTrackModel = Instance<AlignmentsTrackStateModel>
