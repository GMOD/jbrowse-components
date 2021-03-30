import { ConfigurationSchema } from '../../configuration'

export default ConfigurationSchema(
  'JBrowse1TextSearchAdapter',
  {
    // metadata about tracks and assemblies covered by text search adapter
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
  { explicitlyTyped: true },
)
