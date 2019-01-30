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
    faiLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.fai' },
    },
    // gziLocation: {
    //   type: // what should this be for an optional fileLocation?
    // },
    assemblyName: {
      type: 'string',
      defaultValue: '',
    },
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
