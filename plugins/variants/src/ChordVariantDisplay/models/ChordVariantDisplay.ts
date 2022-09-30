import {
  baseChordDisplayConfig,
  BaseChordDisplayModel,
} from '@jbrowse/plugin-circular-view'
import {
  ConfigurationSchema,
  ConfigurationReference,
} from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
import { getContainingView } from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import PluginManager from '@jbrowse/core/PluginManager'

const ChordVariantDisplayF = (pluginManager: PluginManager) => {
  const configSchema = ConfigurationSchema(
    'ChordVariantDisplay',
    {
      renderer: types.optional(
        pluginManager.pluggableConfigSchemaType('renderer'),
        { type: 'StructuralVariantChordRenderer' },
      ),
    },
    { baseConfiguration: baseChordDisplayConfig, explicitlyTyped: true },
  )

  const stateModel = types
    .compose(
      'ChordVariantDisplay',
      BaseChordDisplayModel,
      types.model({
        type: types.literal('ChordVariantDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(self => ({
      get rendererTypeName() {
        return self.configuration.renderer.type
      },

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

  return { stateModel, configSchema }
}

// http://localhost:3000/test_data/hs37d5.HG002-SequelII-CCS.sv.vcf.gz.tbi

// render request is for 1.5x the current viewing window

// tracks all have a height
//
export default ChordVariantDisplayF
