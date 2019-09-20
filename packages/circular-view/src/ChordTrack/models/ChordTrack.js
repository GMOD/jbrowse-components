export default pluginManager => {
  const { jbrequire } = pluginManager
  // const { transaction } = jbrequire('mobx')
  const { types, getParent } = jbrequire('mobx-state-tree')
  const React = jbrequire('react')
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')
  const { ConfigurationSchema, ConfigurationReference, getConf } = jbrequire(
    '@gmod/jbrowse-core/configuration',
  )
  const CircularChordRendererType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/renderers/CircularChordRendererType',
  )

  const { getSession } = jbrequire('@gmod/jbrowse-core/util')
  const { getParentRenderProps, getContainingView } = jbrequire(
    '@gmod/jbrowse-core/util/tracks',
  )

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
      bezierRadiusRatio: 0.1,
    })
    .volatile(self => ({
      refNameMap: undefined,
    }))
    .views(self => ({
      get blockDefinitions() {
        return getContainingView(self).staticSlices
      },

      get RenderingComponent() {
        return (
          self.ReactComponent ||
          (() => (
            <div className="TrackRenderingNotImplemented">
              Rendering not implemented for {self.type} tracks
            </div>
          ))
        )
      },
      get renderProps() {
        const view = getParent(self, 2)
        return {
          ...getParentRenderProps(self),
          trackModel: self,
          bezierRadius: view.radiusPx * self.bezierRadiusRatio,
          radius: view.radiusPx,
          config: self.configuration.renderer,
          blockDefinitions: self.blockDefinitions,

          onChordClick: self.onChordClick,
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
            `renderer ${track.rendererTypeName} has no ReactComponent, it may not be completely implemented yet`,
          )
        return RendererType
      },

      isCompatibleWithRenderer(renderer) {
        return !!(renderer instanceof CircularChordRendererType)
      },

      /**
       * returns a string feature ID if the globally-selected object
       * is probably a feature
       */
      get selectedFeatureId() {
        const session = getSession(self)
        if (!session) return undefined
        const { selection } = session
        // does it quack like a feature?
        if (
          selection &&
          typeof selection.get === 'function' &&
          typeof selection.id === 'function'
        ) {
          // probably is a feature
          return selection.id()
        }
        return undefined
      },
    }))

  return { stateModel, configSchema }
}
