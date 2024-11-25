import { ConfigurationReference } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { BaseChordDisplayModel } from '@jbrowse/plugin-circular-view'
import { types } from 'mobx-state-tree'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { CircularViewModel } from '@jbrowse/plugin-circular-view'

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
        const view = getContainingView(self) as CircularViewModel
        return {
          ...getParentRenderProps(self),
          rpcDriverName: self.rpcDriverName,
          displayModel: self,
          bezierRadius: view.radiusPx * self.bezierRadiusRatio,
          radius: view.radiusPx,
          blockDefinitions: self.blockDefinitions,
          config: self.configuration.renderer,
          onChordClick: (arg: Feature) => {
            self.onChordClick(arg)
          },
        }
      },
    }))
}

// http://localhost:3000/test_data/hs37d5.HG002-SequelII-CCS.sv.vcf.gz.tbi

// render request is for 1.5x the current viewing window

// tracks all have a height
//
export default stateModelFactory
