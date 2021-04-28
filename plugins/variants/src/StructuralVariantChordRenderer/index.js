import ReactComponentFactory from './ReactComponent'

const ChordRendererConfigF = pluginManager => {
  const { jbrequire } = pluginManager
  const ChordRendererType = jbrequire(
    '@jbrowse/core/pluggableElementTypes/renderers/CircularChordRendererType',
  )
  const { ConfigurationSchema } = jbrequire('@jbrowse/core/configuration')

  const ReactComponent = jbrequire(ReactComponentFactory)
  const configSchema = ConfigurationSchema(
    'StructuralVariantChordRenderer',
    {
      strokeColor: {
        type: 'color',
        description: 'the line color of each arc',
        defaultValue: 'rgba(255,133,0,0.32)',
        contextVariable: ['feature'],
      },
      strokeColorSelected: {
        type: 'color',
        description: 'the line color of an arc that has been selected',
        defaultValue: 'black',
        contextVariable: ['feature'],
      },
      strokeColorHover: {
        type: 'color',
        description:
          'the line color of an arc that is being hovered over with the mouse',
        defaultValue: '#555',
        contextVariable: ['feature'],
      },
    },
    { explicitlyTyped: true },
  )
  return new ChordRendererType({
    name: 'StructuralVariantChordRenderer',
    ReactComponent,
    configSchema,
    pluginManager,
  })
}

export default ChordRendererConfigF
