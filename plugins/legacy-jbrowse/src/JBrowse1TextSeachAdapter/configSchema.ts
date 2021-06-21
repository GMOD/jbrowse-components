import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'JBrowse1TextSearchAdapter',
  {
    // metadata about tracks and assemblies covered by text search adapter
    namesIndexLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/volvox/names' },
      description: 'the location of the JBrowse1 names index data directory',
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
