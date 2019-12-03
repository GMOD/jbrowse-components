import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { getSession } from '@gmod/jbrowse-core/util'
import { blockBasedTrackModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
]) // change renderer types, make sure renderer is in plugin manager before changing this portion

export default (pluginManager, configSchema) =>
  types.compose(
    'SNPTrack',
    blockBasedTrackModel,
    types
      .model({
        type: types.literal('SNPTrack'),
        configuration: ConfigurationReference(configSchema),
      })
      .actions(self => ({
        selectFeature(feature) {
          const session = getSession(self)
          // potentially change the alignments feature
          const featureWidget = session.addDrawerWidget(
            'AlignmentsFeatureDrawerWidget',
            'alignmentFeature',
            { featureData: feature.data },
          )
          session.showDrawerWidget(featureWidget)
          session.setSelection(feature)
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
            throw new Error(`unknown snp view name ${viewName}`)
          return rendererType
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
            config,
          }
        },
      })),
  )
