import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config MCScanSimpleAnchorsAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const MCScanSimpleAnchorsAdapter = ConfigurationSchema(
  'MCScanSimpleAnchorsAdapter',
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
    mcscanSimpleAnchorsLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/mcscan.anchors.simple',
      },
      type: 'fileLocation',
    },
  },
  { explicitlyTyped: true },
)
export default MCScanSimpleAnchorsAdapter
