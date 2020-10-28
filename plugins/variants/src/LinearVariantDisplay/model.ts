import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import { LinearVariantDisplayConfigModel } from './configSchema'

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
])

export default (configSchema: LinearVariantDisplayConfigModel) =>
  types
    .compose(
      'LinearVariantDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearVariantDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .actions(self => ({
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'VariantFeatureWidget',
            'variantFeature',
            { featureData: feature.toJSON() },
          )
          session.showWidget(featureWidget)
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
       * is rendered in this display
       */
      get renderProps() {
        // view -> track -> [displays] -> [blocks]
        const config = self.rendererType.configSchema.create(
          getConf(self, ['renderers', self.rendererTypeName]) || {},
        )
        return {
          ...self.composedRenderProps,
          ...getParentRenderProps(self),
          config,
          displayModel: self,
        }
      },
    }))
