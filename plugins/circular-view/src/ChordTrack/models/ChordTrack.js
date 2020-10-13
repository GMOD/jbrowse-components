export default pluginManager => {
  const { jbrequire } = pluginManager
  // const { transaction } = jbrequire('mobx')
  const { types, getParent, isAlive } = jbrequire('mobx-state-tree')
  const React = jbrequire('react')
  const { ElementId } = jbrequire('@jbrowse/core/util/types/mst')
  const { ConfigurationSchema, ConfigurationReference, getConf } = jbrequire(
    '@jbrowse/core/configuration',
  )
  const CircularChordRendererType = jbrequire(
    '@jbrowse/core/pluggableElementTypes/renderers/CircularChordRendererType',
  )

  const { getSession, getContainingView } = jbrequire('@jbrowse/core/util')
  const { getParentRenderProps } = jbrequire('@jbrowse/core/util/tracks')

  const configSchema = ConfigurationSchema(
    'ChordTrack',
    {
      viewType: 'CircularView',
      name: {
        description: 'descriptive name of the track',
        type: 'string',
        defaultValue: 'Track',
      },
      assemblyNames: {
        description: 'name of the assembly (or assemblies) track belongs to',
        type: 'stringArray',
        defaultValue: ['assemblyName'],
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
      // see corresponding entry in linear-genome-view BaseTrack
      // no config slot editor exists for this at the time being
      configRelationships: {
        type: 'configRelationships',
        model: types.array(
          types.model('Relationship', {
            type: types.string,
            target: types.string,
          }),
        ),
        defaultValue: [],
      },
    },
    { explicitlyTyped: true, explicitIdentifier: 'trackId' },
  )

  const stateModel = types
    .model('ChordTrack', {
      id: ElementId,
      type: types.literal('ChordTrack'),
      configuration: ConfigurationReference(configSchema),
      bezierRadiusRatio: 0.1,
      assemblyName: types.maybe(types.string),
    })
    .views(self => ({
      get rpcSessionId() {
        return self.id
      },
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
        if (!isAlive(self)) return undefined
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
