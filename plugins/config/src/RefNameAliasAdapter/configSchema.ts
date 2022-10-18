import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config
 */
const RefNameAliasAdapter = ConfigurationSchema(
  'RefNameAliasAdapter',
  {
    /**
     * !slot
     */
    location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/aliases.txt',
        locationType: 'UriLocation',
      },
    },
    /**
     * !slot
     */
    refNameColumn: {
      type: 'number',
      defaultValue: 0,
    },
  },
  { explicitlyTyped: true },
)

export default RefNameAliasAdapter
