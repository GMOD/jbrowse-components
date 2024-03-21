import {
  BaseChordDisplayModel,
  CircularViewModel,
} from '@jbrowse/plugin-circular-view'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
import { Feature, getContainingView } from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'

/**
 * #stateModel ChordVariantDisplay
 * extends
 * - [BaseChordDisplay](../basechorddisplay)
 */
const stateModelFactory = (configSchema: AnyConfigurationSchemaType) => {
  return types
    .compose(
      'ChordVariantDisplay',
      BaseChordDisplayModel,
      types.model({
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         */
        type: types.literal('ChordVariantDisplay'),
      }),
    )
    .views(self => ({
      /**
       * #method
       */
      renderProps(): Record<string, unknown> {
        const view = getContainingView(self) as CircularViewModel
        return {
          ...getParentRenderProps(self),
          bezierRadius: view.radiusPx * self.bezierRadiusRatio,
          blockDefinitions: self.blockDefinitions,
          config: self.configuration.renderer,
          displayModel: self,
          onChordClick: (arg: Feature) => self.onChordClick(arg),
          radius: view.radiusPx,
          rpcDriverName: self.rpcDriverName,
        }
      },

      /**
       * #getter
       */
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
    }))
}

// http://localhost:3000/test_data/hs37d5.HG002-SequelII-CCS.sv.vcf.gz.tbi

// render request is for 1.5x the current viewing window

// tracks all have a height
//
export default stateModelFactory
