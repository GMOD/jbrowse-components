import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'TrixxTextSearchAdapter',
  {
    namesIndexLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/volvox/names' },
      description: 'the location of the trixx text index',
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
