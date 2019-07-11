export default pluginManager => {
  const { jbrequire } = pluginManager
  const { reaction } = jbrequire('mobx')

  const { types, getParent, addDisposer, isAlive, getRoot } = jbrequire(
    'mobx-state-tree',
  )
  const { ConfigurationSchema, ConfigurationReference } = jbrequire(
    '@gmod/jbrowse-core/configuration',
  )

  const { getContainingView } = jbrequire('@gmod/jbrowse-core/util/tracks')
  const { getConf } = jbrequire('@gmod/jbrowse-core/configuration')
  const { assembleLocString } = jbrequire('@gmod/jbrowse-core/util')

  const { renderReactionData, renderReactionEffect } = jbrequire(
    require('./renderReaction'),
  )
  const mainReactComponent = jbrequire(require('../components'))

  const {
    configSchema: ChordTrackConfigSchema,
    stateModel: ChordTrackStateModel,
  } = jbrequire(require('../../ChordTrack/models/ChordTrack'))

  const configSchema = ConfigurationSchema(
    'StructuralVariantChordTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    { baseConfiguration: ChordTrackConfigSchema, explicitlyTyped: true },
  )

  const stateModel = types
    .compose(
      'StructuralVariantChordTrack',
      ChordTrackStateModel,
      types.model({
        type: types.literal('StructuralVariantChordTrack'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(self => ({
      reactComponent: mainReactComponent,

      // NOTE: all this volatile stuff has to be filled in at once
      // so that it stays consistent
      filled: false,
      data: undefined,
      error: undefined,
      fillInProgress: undefined,
    }))
    .views(self => ({
      get blockDefinitions() {
        return getContainingView(self).staticSlices
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
    .actions(self => ({
      afterAttach() {
        const track = self
        const renderDisposer = reaction(
          () => renderReactionData(self),
          data => renderReactionEffect(self, data),
          {
            name: `${track.id} rendering`,
            delay: track.renderDelay,
            fireImmediately: true,
          },
        )
        addDisposer(self, renderDisposer)
      },
      setLoading(abortController) {
        if (self.renderInProgress && !self.renderInProgress.signal.aborted) {
          self.renderInProgress.abort()
        }
        self.filled = false
        self.message = undefined
        self.html = ''
        self.data = undefined
        self.error = undefined
        self.renderingComponent = undefined
        self.renderProps = undefined
        self.renderInProgress = abortController
      },
      setMessage(messageText) {
        if (self.renderInProgress && !self.renderInProgress.signal.aborted) {
          self.renderInProgress.abort()
        }
        self.filled = false
        self.message = messageText
        self.html = ''
        self.data = undefined
        self.error = undefined
        self.renderingComponent = undefined
        self.renderProps = undefined
        self.renderInProgress = undefined
      },
      setRendered(data, html, renderingComponent, renderProps) {
        self.filled = true
        self.message = undefined
        self.html = html
        self.data = data
        self.error = undefined
        self.renderingComponent = renderingComponent
        self.renderProps = renderProps
        self.renderInProgress = undefined
      },
      setError(error) {
        if (self.renderInProgress && !self.renderInProgress.signal.aborted) {
          self.renderInProgress.abort()
        }
        // the rendering failed for some reason
        self.filled = false
        self.message = undefined
        self.html = undefined
        self.data = undefined
        self.error = error
        self.renderingComponent = undefined
        self.renderProps = undefined
        self.renderInProgress = undefined
      },
      beforeDestroy() {
        if (self.renderInProgress && !self.renderInProgress.signal.aborted) {
          self.renderInProgress.abort()
        }
      },
    }))

  return { stateModel, configSchema }
}

// http://localhost:3000/test_data/hs37d5.HG002-SequelII-CCS.sv.vcf.gz.tbi

// render request is for 1.5x the current viewing window

// tracks all have a height
