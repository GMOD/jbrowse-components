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

        // TODOSORT think about changing by, moving sortedBy to PileupTrack
        // do when track specific menus are implemented
        get sortObject() {
          return {
            position: getParentRenderProps(self).trackModel.centerLinePosition,
            by: getParentRenderProps(self).trackModel.sortedBy,
          }
        },

        // TODOSORT find how to pass the sorted region first using staticblocks
        // temp use dynamic blocks if sorted so the layout is generated correctly
        // get blockType() {
        //   if (!isNaN(self.sortObject.position) && self.sortObject.by)
        //     return 'dynamicBlocks'
        //   return 'staticBlocks'
        // },

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
