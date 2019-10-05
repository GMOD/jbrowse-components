import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import {
  BlockBasedTrack,
  blockBasedTrackModel,
} from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import TrackControls from './components/TrackControls'

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
])

export default configSchema =>
  types
    .compose(
      'VariantTrack',
      blockBasedTrackModel,
      types.model({
        type: types.literal('VariantTrack'),
        configuration: ConfigurationReference(configSchema),
        // the renderer that the user has selected in the UI, empty string
        // if they have not made any selection
        selectedRendering: types.optional(types.string, ''),
        height: types.optional(types.integer, 100),
      }),
    )
    .volatile(() => ({
      ReactComponent: BlockBasedTrack,
      rendererTypeChoices: Array.from(rendererTypes.keys()),
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
          config,
          trackModel: self,
        }
      },
      get ControlsComponent() {
        return TrackControls
      },
    }))
