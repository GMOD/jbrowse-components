import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'TrixTextSearchAdapter',
  {
    ixFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: 'out.ix' },
      description: 'the location of the trixx ix file',
    },
    ixxFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: 'out.ixx' },
      description: 'the location of the trixx ixx file',
    },
    metaFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: 'meta.json' },
      description: 'the location of the metadata json file for the trix index',
    },
    tracks: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of tracks covered by text search adapter',
    },
    assemblies: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
    },
  },
  { explicitlyTyped: true, explicitIdentifier: 'textSearchAdapterId' },
)
