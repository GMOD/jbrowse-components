import {
  baseChordDisplayConfig,
  BaseChordDisplayModel,
} from '@jbrowse/plugin-circular-view'

const ChordVariantDisplayF = pluginManager => {
  const { jbrequire } = pluginManager

  const { types } = jbrequire('mobx-state-tree')
  const { ConfigurationSchema, ConfigurationReference } = jbrequire(
    '@jbrowse/core/configuration',
  )
  const { getContainingView } = jbrequire('@jbrowse/core/util')
  const { getParentRenderProps } = jbrequire('@jbrowse/core/util/tracks')
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
      get renderProps() {
        const view = getContainingView(self)
        return {
          ...getParentRenderProps(self),
          rpcDriverName: self.rpcDriverName,
          displayModel: self,
          bezierRadius: view.radiusPx * self.bezierRadiusRatio,
          radius: view.radiusPx,
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
