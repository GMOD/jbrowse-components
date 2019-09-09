export default pluginManager => {
  const { jbrequire } = pluginManager

  const { types } = jbrequire('mobx-state-tree')
  const { ConfigurationSchema, ConfigurationReference } = jbrequire(
    '@gmod/jbrowse-core/configuration',
  )

  const { getSession } = jbrequire('@gmod/jbrowse-core/util')
  const { getContainingView } = jbrequire('@gmod/jbrowse-core/util/tracks')

  const { renderReactionData, renderReactionEffect } = jbrequire(
    require('./renderReaction'),
  )
  const mainReactComponent = jbrequire(require('../components'))

  const {
    configSchema: ChordTrackConfigSchema,
    stateModel: ChordTrackStateModel,
  } = jbrequire(require('../../ChordTrack/models/ChordTrack'))

  const refNameMapKeeper = jbrequire(require('./refNameMapKeeper'))

  const configSchema = ConfigurationSchema(
    'StructuralVariantChordTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    { baseConfiguration: ChordTrackConfigSchema, explicitlyTyped: true },
  )

  const { makeAbortableReaction } = jbrequire(require('./util'))

  const stateModel = types
    .compose(
      'StructuralVariantChordTrack',
      ChordTrackStateModel,
      refNameMapKeeper,
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
    .actions(self => ({
      afterAttach() {
        makeAbortableReaction(
          self,
          'render',
          renderReactionData,
          renderReactionEffect,
          {
            name: `${self.type} ${self.id} rendering`,
            // delay: self.renderDelay || 300,
            // fireImmediately: true,
          },
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

      onChordClick(feature, startRegion, endRegion, event) {
        const session = getSession(self)
        session.setSelection(feature)
        console.log('selected BND', feature)

        // TODO: REMOVEME TEMPORARY STUFF TO OPEN A BREAKPOINT VIEW
        try {
          session.addView(
            'BreakpointSplitView',
            pluginManager
              .getViewType('BreakpointSplitView')
              .snapshotFromBreakendFeature(feature, startRegion, endRegion),
          )
        } catch (e) {
          console.error(e)
        }
      },
    }))

  return { stateModel, configSchema }
}

// http://localhost:3000/test_data/hs37d5.HG002-SequelII-CCS.sv.vcf.gz.tbi

// render request is for 1.5x the current viewing window

// tracks all have a height
