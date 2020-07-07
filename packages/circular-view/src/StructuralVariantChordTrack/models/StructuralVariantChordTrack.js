export default pluginManager => {
  const { jbrequire } = pluginManager

  const { types } = jbrequire('mobx-state-tree')
  const { getConf, ConfigurationSchema, ConfigurationReference } = jbrequire(
    '@gmod/jbrowse-core/configuration',
  )
  const { getTrackAssemblyNames, getRpcSessionId } = jbrequire(
    '@gmod/jbrowse-core/util/tracks',
  )
  const { getContainingView, makeAbortableReaction, getSession } = jbrequire(
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

  const configSchema = ConfigurationSchema(
    'StructuralVariantChordTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
      onChordClick: {
        type: 'boolean',
        description:
          'callback that should be run when a chord in the track is clicked',
        defaultValue: false,
        functionSignature: ['feature', 'track', 'pluginManager'],
      },
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
    .volatile((/* self */) => ({
      ReactComponent: mainReactComponent,

      // NOTE: all this volatile stuff has to be filled in at once
      // so that it stays consistent
      filled: false,
      html: '',
      data: undefined,
      message: '',
      error: undefined,
      renderingComponent: undefined,
    }))
    .views(self => ({
      get refNameMap() {
        const assemblyName = getTrackAssemblyNames(self)[0]
        const adapter = getConf(self, 'adapter')
        const assembly = getSession(self).assemblyManager.get(assemblyName)
        if (!assembly) return new Map()
        return (
          assembly &&
          assembly.getRefNameMapForAdapter(adapter, {
            sessionId: getRpcSessionId(self),
          })
        )
      },

      get blockDefinitions() {
        const origSlices = getContainingView(self).staticSlices
        if (!self.refNameMap) return origSlices

        const slices = JSON.parse(JSON.stringify(origSlices))

        slices.forEach(slice => {
          const regions = slice.region.elided
            ? slice.region.regions
            : [slice.region]
          regions.forEach(region => {
            const renamed = self.refNameMap[region.refName]
            if (renamed && region.refName !== renamed) {
              region.refName = renamed
            }
          })
        })
        return slices
      },
    }))
    .actions(self => ({
      afterAttach() {
        makeAbortableReaction(
          self,
          renderReactionData,
          renderReactionEffect,
          {
            name: `${self.type} ${self.id} rendering`,
            // delay: self.renderDelay || 300,
            fireImmediately: true,
          },
          self.renderStarted,
          self.renderSuccess,
          self.renderError,
        )
      },
      renderStarted() {
        self.filled = false
        self.message = undefined
        self.html = ''
        self.data = undefined
        self.error = undefined
        self.renderingComponent = undefined
      },
      renderSuccess({ message, data, html, renderingComponent }) {
        if (message) {
          self.filled = false
          self.message = message
          self.html = ''
          self.data = undefined
          self.error = undefined
          self.renderingComponent = undefined
        } else {
          self.filled = true
          self.message = undefined
          self.html = html
          self.data = data
          self.error = undefined
          self.renderingComponent = renderingComponent
        }
      },
      renderError(error) {
        console.error(error)
        // the rendering failed for some reason
        self.filled = false
        self.message = undefined
        self.html = undefined
        self.data = undefined
        self.error = error
        self.renderingComponent = undefined
      },

      onChordClick(feature) {
        getConf(self, 'onChordClick', [feature, self, pluginManager])
      },
    }))

  return { stateModel, configSchema }
}

// http://localhost:3000/test_data/hs37d5.HG002-SequelII-CCS.sv.vcf.gz.tbi

// render request is for 1.5x the current viewing window

// tracks all have a height
