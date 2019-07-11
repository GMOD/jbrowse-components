export default ({ jbrequire }) => {
  const ServerSideRendererType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType',
  )
  const { ConfigurationSchema } = jbrequire('@gmod/jbrowse-core/configuration')

  const ReactComponent = jbrequire(require('./reactComponent'))
  const configSchema = ConfigurationSchema(
    'StructuralVariantChordRenderer',
    {},
    { explicitlyTyped: true },
  )
  return new ServerSideRendererType({
    name: 'StructuralVariantChordRenderer',
    ReactComponent,
    configSchema,
  })
}
