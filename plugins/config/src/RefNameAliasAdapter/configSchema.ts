import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config RefNameAliasAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const RefNameAliasAdapter = ConfigurationSchema(
  'RefNameAliasAdapter',
  {
    /**
     * #slot
     */
    location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/aliases.txt',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    refNameColumn: {
      type: 'number',
      defaultValue: 0,
    },
  },
  { explicitlyTyped: true },
)

export default RefNameAliasAdapter
