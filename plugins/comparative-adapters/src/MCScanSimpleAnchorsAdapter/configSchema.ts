import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config
 */
const MCScanSimpleAnchorsAdapter = ConfigurationSchema(
  'MCScanSimpleAnchorsAdapter',
  {
    /**
     * !slot
     */
    mcscanSimpleAnchorsLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/mcscan.anchors.simple',
        locationType: 'UriLocation',
      },
    },
    /**
     * !slot
     */
    bed1Location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.bed',
        locationType: 'UriLocation',
      },
    },
    /**
     * !slot
     */
    bed2Location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.bed',
        locationType: 'UriLocation',
      },
    },

    /**
     * !slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true },
)
export default MCScanSimpleAnchorsAdapter
