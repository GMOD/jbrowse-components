import { BaseChordDisplayModel } from '@jbrowse/plugin-circular-view'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
import { getContainingView } from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'

/**
 * #stateModel ChordVariantDisplay
 * extends `BaseChordDisplay`
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
        type: types.literal('ChordVariantDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(self => ({
      /**
       * #getter
       */
      get rendererTypeName() {
        return self.configuration.renderer.type
      },

      /**
       * #method
       */
      renderProps(): Record<string, unknown> {
        const view = getContainingView(self)
        return {
          ...getParentRenderProps(self),
          rpcDriverName: self.rpcDriverName,
          displayModel: self,
          bezierRadius: view.radiusPx * self.bezierRadiusRatio,
          radius: view.radiusPx,

          // @ts-ignore
          blockDefinitions: this.blockDefinitions,
          config: self.configuration.renderer,
          onChordClick: self.onChordClick,
        }
      },
    }))
}

// http://localhost:3000/test_data/hs37d5.HG002-SequelII-CCS.sv.vcf.gz.tbi

// render request is for 1.5x the current viewing window

// tracks all have a height
//
export default stateModelFactory
