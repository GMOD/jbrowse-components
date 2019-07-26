export default pluginManager => {
  const { jbrequire } = pluginManager
  const { reaction } = jbrequire('mobx')

  const { types, getParent, addDisposer, isAlive, getRoot } = jbrequire(
    'mobx-state-tree',
  )
  const {
    ConfigurationSchema,
    ConfigurationReference,
    readConfObject,
  } = jbrequire('@gmod/jbrowse-core/configuration')

  const { getContainingView, getContainingAssembly } = jbrequire(
    '@gmod/jbrowse-core/util/tracks',
  )
  const { getConf } = jbrequire('@gmod/jbrowse-core/configuration')
  const { assembleLocString, isAbortException } = jbrequire(
    '@gmod/jbrowse-core/util',
  )

  const { renderReactionData, renderReactionEffect } = jbrequire(
    require('./renderReaction'),
  )
  const mainReactComponent = jbrequire(require('../components'))

  const {
    configSchema: ChordTrackConfigSchema,
    stateModel: ChordTrackStateModel,
  } = jbrequire(require('../../ChordTrack/models/ChordTrack'))

  const { makeAbortableReaction } = jbrequire(require('./util'))

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
      html: '',
      data: undefined,
      error: undefined,
      renderingComponent: undefined,
      renderInProgress: undefined,
    }))
    .views(self => ({
      get blockDefinitions() {
        const origSlices = getContainingView(self).staticSlices
        if (!self.refNameMap) return origSlices

        const slices = JSON.parse(JSON.stringify(origSlices))

        slices.forEach(slice => {
          const regions = slice.region.elided
            ? slice.region.regions
            : [slice.region]
          regions.forEach(region => {
            const renamed = self.refNameMap.get(region.refName)
            if (renamed && region.refName !== renamed) {
              region.refName = renamed
            }
          })
        })
        return slices
      },
    }))
    .volatile(self => ({
      refNameMap: undefined,
    }))
    .actions(self => ({
      afterAttach() {
        const renderDisposer = reaction(
          () => renderReactionData(self),
          data => {
            renderReactionEffect(self, data)
          },
          {
            name: `${self.id} rendering`,
            // delay: self.renderDelay || 300,
            fireImmediately: true,
          },
        )
        addDisposer(self, renderDisposer)

        makeAbortableReaction(
          self,
          'loadAssemblyRefNameMap',
          () => ({
            root: getRoot(self),
            assemblyName: readConfObject(
              getContainingAssembly(self.configuration),
              'assemblyName',
            ),
          }),
          ({ root, assemblyName }, signal) => {
            return root.assemblyManager.getRefNameMapForAdapter(
              getConf(self, 'adapter'),
              assemblyName,
              { signal },
            )
          },
          {
            fireImmediately: true,
            delay: 300,
          },
        )
      },

      loadAssemblyRefNameMapStarted() {},
      loadAssemblyRefNameMapSuccess(result) {
        console.log('loaded refname map', result)
        self.refNameMap = result
      },
      loadAssemblyRefNameMapError(error) {
        console.error(error)
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
        self.renderInProgress = undefined
      },
      setRendered(data, html, renderingComponent) {
        self.filled = true
        self.message = undefined
        self.html = html
        self.data = data
        self.error = undefined
        self.renderingComponent = renderingComponent
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
