import Plugin from '../../Plugin'
import AdapterType from '../../pluggableElementTypes/AdapterType'
import { ConfigurationSchema } from '../../configuration'
import IndexedAdapterClass from './IndexedFastaAdapter'
import BgzipAdapterClass from './BgzipFastaAdapter'

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
  },
  { explicitlyTyped: true },
)

const bgzipConfigSchema = ConfigurationSchema(
  'BgzipFastaAdapter',
  {
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.gz' },
    },
    faiLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.gz.fai' },
    },
    gziLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.gz.gzi' },
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
          AdapterClass: IndexedAdapterClass,
        }),
    )
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BgzipFastaAdapter',
          configSchema: bgzipConfigSchema,
          AdapterClass: BgzipAdapterClass,
        }),
    )
  }
}
