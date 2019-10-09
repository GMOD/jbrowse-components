import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { getSession } from '@gmod/jbrowse-core/util'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import {
  BlockBasedTrack,
  blockBasedTrackModel,
} from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import RBush from 'rbush'
import TrackControls from '../components/TrackControls'

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
])

export default (pluginManager, configSchema) =>
  types.compose(
    'AlignmentsTrack',
    blockBasedTrackModel,
    types
      .model({
        type: types.literal('AlignmentsTrack'),
        configuration: ConfigurationReference(configSchema),
        // the renderer that the user has selected in the UI, empty string
        // if they have not made any selection
        selectedRendering: types.optional(types.string, ''),
      })
      .volatile(() => ({
        ReactComponent: BlockBasedTrack,
        rendererTypeChoices: Array.from(rendererTypes.keys()),
        rbush: new RBush(),
      }))
      .actions(self => ({
        setRenderer(newRenderer) {
          self.selectedRendering = newRenderer
        },
      }))
      .views(self => ({
        /**
         * the renderer type name is based on the "view"
         * selected in the UI: pileup, coverage, etc
         */
        get rendererTypeName() {
          const defaultRendering = getConf(self, 'defaultRendering')
          const viewName = self.selectedRendering || defaultRendering
          const rendererType = rendererTypes.get(viewName)
          if (!rendererType)
            throw new Error(`unknown alignments view name ${viewName}`)
          return rendererType
        },

        get ControlsComponent() {
          return TrackControls
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



        /**
         * a CompositeMap of featureId -> feature obj that
         * just looks in all the block data for that feature
         */
        get layoutFeatures() {
          const layoutMaps = []
          for (const block of self.blockState.values()) {
            if (
              block.data &&
              block.data.layout &&
              block.data.layout.rectangles
            ) {
              layoutMaps.push(block.data.layout.rectangles)
            }
          }
          return new CompositeMap(layoutMaps)
        },

        get rtree() {
          self.rbush.clear()
          for (const [key, item] of this.features) {
            const layout = this.layoutFeatures.get(key)
            self.rbush.insert({
              minX: item.get('start'),
              minY: layout[1],
              maxX: item.get('end'),
              maxY: layout[3],
              name: key,
            })
          }
          return self.rbush
        },
        getFeatureOverlapping(x, y) {
          const rect = { minX: x, minY: y, maxX: x + 1, maxY: y + 1 }
          if (self.rtree.collides(rect)) {
            return self.rtree.search({
              minX: x,
              minY: y,
              maxX: x + 1,
              maxY: y + 1,
            })
          }
          return []
        },
      })),
  )
