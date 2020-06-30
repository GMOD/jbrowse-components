import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import {
  getParentRenderProps,
  getRpcSessionId,
} from '@gmod/jbrowse-core/util/tracks'
import {
  getSession,
  isSessionModelWithDrawerWidgets,
  getContainingView,
} from '@gmod/jbrowse-core/util'

import VisibilityIcon from '@material-ui/icons/Visibility'
import { ContentCopy as ContentCopyIcon } from '@gmod/jbrowse-core/ui/Icons'
import { blockBasedTrackModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types, Instance } from 'mobx-state-tree'
import copy from 'copy-to-clipboard'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import MenuOpenIcon from '@material-ui/icons/MenuOpen'
import SortIcon from '@material-ui/icons/Sort'
import { LinearGenomeViewModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { PileupConfigModel } from './configSchema'
import PileupTrackBlurb from './components/PileupTrackBlurb'

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
  ['snpcoverage', 'SNPCoverageRenderer'],
])

const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: PileupConfigModel,
) =>
  types
    .compose(
      'PileupTrack',
      blockBasedTrackModel,
      types.model({
        type: types.literal('PileupTrack'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      showSoftClipping: false,
      sortedBy: '',
      sortedByPosition: 0,
      sortedByRefName: '',
    }))
    .actions(self => ({
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithDrawerWidgets(session)) {
          const featureWidget = session.addDrawerWidget(
            'AlignmentsFeatureDrawerWidget',
            'alignmentFeature',
            { featureData: feature.toJSON() },
          )
          session.showDrawerWidget(featureWidget)
        }
        session.setSelection(feature)
      },

      clearSelected() {
        self.sortedBy = ''
        self.sortedByPosition = 0
        self.sortedByRefName = ''
      },

      // uses copy-to-clipboard and generates notification
      copyFeatureToClipboard(feature: Feature) {
        const copiedFeature = feature.toJSON()
        delete copiedFeature.uniqueId
        const session = getSession(self)
        copy(JSON.stringify(copiedFeature, null, 4))
        session.notify('Copied to clipboard', 'success')
      },

      toggleSoftClipping() {
        self.showSoftClipping = !self.showSoftClipping
      },

      async sortSelected(selected: string) {
        const { rpcManager } = getSession(self)
        const { centerLineInfo } = getContainingView(
          self,
        ) as LinearGenomeViewModel
        if (!centerLineInfo) {
          return
        }

        const centerBp = Math.round(centerLineInfo.offset) + 1
        const centerRefName = centerLineInfo.refName

        if (centerBp < 0) {
          return
        }

        const regions = [
          {
            refName: centerLineInfo.refName,
            start: centerBp,
            end: centerBp + 1,
            assemblyName: centerLineInfo.assemblyName,
          },
        ]

        // render just the sorted region first
        self.rendererType
          .renderInClient(rpcManager, {
            assemblyName: regions[0].assemblyName,
            regions,
            adapterConfig: getConf(self, 'adapter'),
            rendererType: self.rendererType.name,
            renderProps: {
              ...self.renderProps,
              sortObject: {
                position: centerBp,
                by: selected,
              },
            },
            sessionId: getRpcSessionId(self),
            timeout: 1000000,
          })
          .then(() => {
            this.applySortSelected(selected, centerBp, centerRefName)
          })
          .catch((error: Error) => {
            console.error(error)
            self.setError(error.message)
          })
      },
      applySortSelected(
        selected: string,
        centerBp: number,
        centerRefName: string,
      ) {
        self.sortedBy = selected
        self.sortedByPosition = centerBp
        self.sortedByRefName = centerRefName
      },
    }))
    .actions(self => {
      // reset the sort object and refresh whole track on reload
      const superReload = self.reload
      return {
        reload() {
          self.clearSelected()
          superReload()
        },
      }
    })
    .views(self => ({
      get rendererTypeName() {
        const viewName = getConf(self, 'defaultRendering')
        const rendererType = rendererTypes.get(viewName)
        if (!rendererType) {
          throw new Error(`unknown alignments view name ${viewName}`)
        }
        return rendererType
      },

      get contextMenuOptions() {
        const feat = self.contextMenuFeature
        return feat
          ? [
              {
                label: 'Open feature details',
                icon: MenuOpenIcon,
                onClick: () => {
                  self.clearFeatureSelection()
                  if (feat) {
                    self.selectFeature(feat)
                  }
                },
              },
              {
                label: 'Copy info to clipboard',
                icon: ContentCopyIcon,
                onClick: () => {
                  if (feat) {
                    self.copyFeatureToClipboard(feat)
                  }
                },
              },
            ]
          : []
      },

      get sortObject() {
        return {
          position: self.sortedByPosition,
          by: self.sortedBy,
        }
      },
      get sortOptions() {
        return ['Start location', 'Read strand', 'Base pair', 'Clear sort']
      },

      get TrackBlurb() {
        return PileupTrackBlurb
      },

      get renderProps() {
        const config = self.rendererType.configSchema.create(
          getConf(self, ['renderers', self.rendererTypeName]) || {},
        )
        return {
          ...self.composedRenderProps,
          ...getParentRenderProps(self),
          trackModel: self,
          sortObject: this.sortObject,
          showSoftClip: self.showSoftClipping,
          config,
        }
      },

      get menuOptions() {
        return [
          {
            label: 'Show soft clipping',
            icon: VisibilityIcon,
            type: 'checkbox',
            checked: self.showSoftClipping,
            onClick: () => {
              self.toggleSoftClipping()
              // if toggling from off to on, will break sort for this track so clear it
              if (self.showSoftClipping) {
                self.clearSelected()
              }
            },
          },
          {
            label: 'Sort by',
            icon: SortIcon,
            disabled: self.showSoftClipping,
            subMenu: this.sortOptions.map((option: string) => {
              return {
                label: option,
                onClick() {
                  option === 'Clear sort'
                    ? self.clearSelected()
                    : self.sortSelected(option)
                },
              }
            }),
          },
        ]
      },
    }))

export type PileupTrackStateModel = ReturnType<typeof stateModelFactory>
export type PileupTrackModel = Instance<PileupTrackStateModel>

export default stateModelFactory
