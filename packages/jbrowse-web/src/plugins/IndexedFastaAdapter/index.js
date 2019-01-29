import Plugin from '../../Plugin'
import AdapterType from '../../pluggableElementTypes/AdapterType'
import { ConfigurationSchema } from '../../configuration'
import AdapterClass from './IndexedFastaAdapter'

const configSchema = ConfigurationSchema(
  'IndexedFastaAdapter',
  {
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa' },
    },
    assemblyName: {
      type: 'string',
      defaultValue: '',
    },
    index: ConfigurationSchema('FastaIndex', {
      location: {
        type: 'fileLocation',
        defaultValue: { uri: '/path/to/seq.fa.fai' },
      },
    }),
  },
  { explicitlyTyped: true },
)

export default class IndexedFastaAdapterPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'IndexedFastaAdapter',
          configSchema,
          AdapterClass,
        }),
    )
  }
}
