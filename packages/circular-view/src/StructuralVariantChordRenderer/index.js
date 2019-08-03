export default ({ jbrequire }) => {
  const ChordRendererType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/renderers/CircularChordRendererType',
  )
  const { ConfigurationSchema } = jbrequire('@gmod/jbrowse-core/configuration')

  const ReactComponent = jbrequire(require('./reactComponent'))
  const configSchema = ConfigurationSchema(
    'StructuralVariantChordRenderer',
    {
      strokeColor: {
        type: 'color',
        description: 'the line color of each arc',
        defaultValue: 'red',
        functionSignature: ['feature'],
      },
    },
    { explicitlyTyped: true },
  )
  return new ChordRendererType({
    name: 'StructuralVariantChordRenderer',
    ReactComponent,
    configSchema,
  })
}
