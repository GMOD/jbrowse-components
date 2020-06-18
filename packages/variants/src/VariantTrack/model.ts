import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import {
  getSession,
  isSessionModelWithDrawerWidgets,
} from '@gmod/jbrowse-core/util'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { blockBasedTrackModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import { VariantTrackConfigModel } from './configSchema'

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
])

export default (configSchema: VariantTrackConfigModel) =>
  types
    .compose(
      'VariantTrack',
      blockBasedTrackModel,
      types.model({
        type: types.literal('VariantTrack'),
        configuration: ConfigurationReference(configSchema),
        height: types.optional(types.integer, 100),
      }),
    )
    .actions(self => ({
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithDrawerWidgets(session)) {
          const featureWidget = session.addDrawerWidget(
            'VariantFeatureDrawerWidget',
            'variantFeature',
            { featureData: feature.toJSON() },
          )
          session.showDrawerWidget(featureWidget)
        }

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
    }))
