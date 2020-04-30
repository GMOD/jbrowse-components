import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { getSession } from '@gmod/jbrowse-core/util'
import { blockBasedTrackModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import copy from 'copy-to-clipboard'

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
  ['snpcoverage', 'SNPCoverageRenderer'],
])

export default (pluginManager, configSchema) =>
  types.compose(
    'PileupTrack',
    blockBasedTrackModel,
    types
      .model({
        type: types.literal('PileupTrack'),
        configuration: ConfigurationReference(configSchema),
      })
      .actions(self => ({
        selectFeature(feature) {
          const session = getSession(self)
          const featureWidget = session.addDrawerWidget(
            'AlignmentsFeatureDrawerWidget',
            'alignmentFeature',
            { featureData: feature.data },
          )
          session.showDrawerWidget(featureWidget)
          session.setSelection(feature)
        },

        // uses copy-to-clipboard and generates notification
        copyFeatureToClipboard(feature) {
          const copiedFeature = feature
          delete copiedFeature.uniqueId
          const session = getSession(self)
          copy(JSON.stringify(copiedFeature, null, 4))
          session.pushSnackbarMessage('Copied to clipboard')
        },

        // returned if there is no feature id under mouse
        // contextMenuNoFeature() {
        //   self.contextMenuOptions = getParentRenderProps(self).trackModel.menuOptions
        // },

        // returned if there is a feature id under mouse
        contextMenuFeature(feature) {
          const menuOptions = [
            {
              label: 'Open feature drawer',
              icon: 'menu_open',
              onClick: () => {
                self.clearFeatureSelection()
                self.selectFeature(feature)
              },
            },
            {
              label: 'Copy info to clipboard',
              icon: 'content_copy',
              onClick: () => self.copyFeatureToClipboard(feature),
            },
            // {
            //   label: 'View dotpot',
            //   icon: 'scatter_plot',
            //   onClick: () => {},
            // },
          ]
          self.contextMenuOptions = menuOptions
        },
      }))
      .views(self => ({
        /**
         * the renderer type name is based on the "view"
         * selected in the UI: pileup, coverage, etc
         */
        get rendererTypeName() {
          const viewName = getConf(self, 'defaultRendering')
          const rendererType = rendererTypes.get(viewName)
          if (!rendererType)
            throw new Error(`unknown alignments view name ${viewName}`)
          return rendererType
        },

        get sortObject() {
          return getParentRenderProps(self).trackModel
            ? {
                position: getParentRenderProps(self).trackModel
                  .centerLinePosition,
                by: getParentRenderProps(self).trackModel.sortedBy,
              }
            : {
                position: 0,
                by: '',
              }
        },

        /**
         * the react props that are passed to the Renderer when data
         * is rendered in this track
         */
        get renderProps() {
          // view -> [tracks] -> [blocks]
          const config = self.rendererType.configSchema.create(
            getConf(self, ['renderers', self.rendererTypeName]) || {},
          )
          return {
            ...self.composedRenderProps,
            ...getParentRenderProps(self),
            trackModel: self,
            sortObject: self.sortObject,
            config,
          }
        },
      })),
  )
