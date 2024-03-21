import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config MCScanAnchorsAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const MCScanAnchorsAdapter = ConfigurationSchema(
  'MCScanAnchorsAdapter',
  {
    /**
     * #slot
     */
    assemblyNames: {
      defaultValue: [],
      type: 'stringArray',
    },

    /**
     * #slot
     */
    bed1Location: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/file.bed',
      },
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    bed2Location: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/file.bed',
      },
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    mcscanAnchorsLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/mcscan.anchors',
      },
      type: 'fileLocation',
    },
  },
  { explicitlyTyped: true },
)

export default MCScanAnchorsAdapter
