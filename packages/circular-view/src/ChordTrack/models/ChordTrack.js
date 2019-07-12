export default pluginManager => {
  const { jbrequire } = pluginManager
  // const { transaction } = jbrequire('mobx')
  const { types } = jbrequire('mobx-state-tree')
  const React = jbrequire('react')
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')
  const { ConfigurationSchema, ConfigurationReference, getConf } = jbrequire(
    '@gmod/jbrowse-core/configuration',
  )

  const { getParentRenderProps } = jbrequire('@gmod/jbrowse-core/util/tracks')

  const configSchema = ConfigurationSchema(
    'ChordTrack',
    {
      viewType: 'CircularView',
      name: {
        description: 'descriptive name of the track',
        type: 'string',
        defaultValue: 'Track',
      },
      description: {
        description: 'a description of the track',
        type: 'string',
        defaultValue: '',
      },
      category: {
        description: 'the category and sub-categories of a track',
        type: 'stringArray',
        defaultValue: [],
      },
    },
    { explicitlyTyped: true },
  )

  const stateModel = types
    .model('ChordTrack', {
      id: ElementId,
      type: types.literal('ChordTrack'),
      configuration: ConfigurationReference(configSchema),
    })
    .views(self => ({
      get RenderingComponent() {
        return (
          self.reactComponent ||
          (() => (
            <div className="TrackRenderingNotImplemented">
              Rendering not implemented for {self.type} tracks
            </div>
          ))
        )
      },
      get renderProps() {
        return {
          ...getParentRenderProps(self),
          trackModel: self,
          config: self.configuration.renderer,
        }
      },

      /**
       * the PluggableElementType for the currently defined adapter
       */
      get adapterType() {
        const adapterConfig = getConf(self, 'adapter')
        if (!adapterConfig)
          throw new Error(`no adapter configuration provided for ${self.type}`)
        const adapterType = pluginManager.getAdapterType(adapterConfig.type)
        if (!adapterType)
          throw new Error(`unknown adapter type ${adapterConfig.type}`)
        return adapterType
      },

      get rendererTypeName() {
        return self.configuration.renderer.type
      },

      /**
       * the pluggable element type object for this track's
       * renderer
       */
      get rendererType() {
        const track = self
        const RendererType = pluginManager.getRendererType(
          self.rendererTypeName,
        )
        if (!RendererType)
          throw new Error(`renderer "${track.rendererTypeName}" not found`)
        if (!RendererType.ReactComponent)
          throw new Error(
            `renderer ${
              track.rendererTypeName
            } has no ReactComponent, it may not be completely implemented yet`,
          )
        return RendererType
      },
    }))

  return { stateModel, configSchema }
}
