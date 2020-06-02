import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { ContentCopy as ContentCopyIcon } from '@gmod/jbrowse-core/ui/Icons'
import {
  getSession,
  isSessionModelWithDrawerWidgets,
} from '@gmod/jbrowse-core/util'
import { blockBasedTrackModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import copy from 'copy-to-clipboard'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import MenuOpenIcon from '@material-ui/icons/MenuOpen'
import { PileupConfigModel } from './configSchema'

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
  ['snpcoverage', 'SNPCoverageRenderer'],
])

export default (
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

      // uses copy-to-clipboard and generates notification
      copyFeatureToClipboard(feature: Feature) {
        const copiedFeature = feature.toJSON()
        delete copiedFeature.uniqueId
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = getSession(self) as any
        copy(JSON.stringify(copiedFeature, null, 4))
        session.notify('Copied to clipboard')
      },

      // returned if there is no feature id under mouse
      contextMenuNoFeature() {
        const { trackModel } = getParentRenderProps(self)
        self.contextMenuOptions = trackModel.menuOptions
      },

      // returned if there is a feature id under mouse
      contextMenuFeature(feature: Feature) {
        const menuOptions = [
          {
            label: 'Open feature details',
            icon: MenuOpenIcon,
            onClick: () => {
              self.clearFeatureSelection()
              self.selectFeature(feature)
            },
          },
          {
            label: 'Copy info to clipboard',
            icon: ContentCopyIcon,
            onClick: () => this.copyFeatureToClipboard(feature),
          },
          // {
          //   label: 'View dotpot',
          //   icon: ScatterPlotIcon,
          //   onClick: () => {},
          // },

          // any custom right click can be appended to self.contextMenuOptions
        ]
        self.contextMenuOptions = menuOptions
      },
    }))
    .views(self => ({
      get rendererTypeName() {
        const viewName = getConf(self, 'defaultRendering')
        const rendererType = rendererTypes.get(viewName)
        if (!rendererType) {
          throw new Error(`unknown alignments view name ${viewName}`)
        }
        return rendererType
      },

      get sortObject() {
        const { trackModel } = getParentRenderProps(self)
        return trackModel
          ? {
              position: trackModel.centerLinePosition,
              by: trackModel.sortedBy,
            }
          : {
              position: 0,
              by: '',
            }
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
          showSoftClip: getParentRenderProps(self).trackModel.showSoftClipping,
          config,
        }
      },
    }))
