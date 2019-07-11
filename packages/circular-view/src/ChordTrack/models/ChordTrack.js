export default ({ jbrequire }) => {
  // const { transaction } = jbrequire('mobx')
  const { types } = jbrequire('mobx-state-tree')
  const React = jbrequire('react')
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')
  const { ConfigurationSchema, ConfigurationReference } = jbrequire(
    '@gmod/jbrowse-core/configuration',
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
    }))

  return { stateModel, configSchema }
}
