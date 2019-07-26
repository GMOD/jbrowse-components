export default ({ jbrequire }) => {
  const ServerSideRendererType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType',
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
  return new ServerSideRendererType({
    name: 'StructuralVariantChordRenderer',
    ReactComponent,
    configSchema,
  })
}
