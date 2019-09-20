export default ({ jbrequire }) => {
  const ChordRendererType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/renderers/CircularChordRendererType',
  )
  const { ConfigurationSchema } = jbrequire('@gmod/jbrowse-core/configuration')

  const ReactComponent = jbrequire(require('./ReactComponent'))
  const configSchema = ConfigurationSchema(
    'StructuralVariantChordRenderer',
    {
      strokeColor: {
        type: 'color',
        description: 'the line color of each arc',
        defaultValue: 'rgba(255,133,0,0.32)',
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
