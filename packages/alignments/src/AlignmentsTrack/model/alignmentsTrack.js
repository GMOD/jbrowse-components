import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { getSession } from '@gmod/jbrowse-core/util'
import {
  BlockBasedTrack,
  blockBasedTrackModel,
} from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import TrackControls from '../components/TrackControls'

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
])

export default (pluginManager, configSchema) =>
  types
    .compose(
      'AlignmentsTrack',
      blockBasedTrackModel,
      types.model({
        type: types.literal('AlignmentsTrack'),
        configuration: ConfigurationReference(configSchema),
        // the renderer that the user has selected in the UI, empty string
        // if they have not made any selection
        selectedRendering: types.optional(types.string, ''),
      }),
    )
    .volatile(() => ({
      ReactComponent: BlockBasedTrack,
      rendererTypeChoices: Array.from(rendererTypes.keys()),
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
    }))
    .actions(self => ({
      selectFeature(feature) {
        const session = getSession(self)
        if (session.drawerWidgets) {
          const featureWidget = session.addDrawerWidget(
            'AlignmentsFeatureDrawerWidget',
            'alignmentsFeature',
            // @ts-ignore
            { featureData: feature.data },
          )
          session.showDrawerWidget(featureWidget)
        }
        session.setSelection(feature)
      },
    }))
