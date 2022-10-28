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
    mcscanAnchorsLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/mcscan.anchors',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    bed1Location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.bed',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    bed2Location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.bed',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true },
)

export default MCScanAnchorsAdapter
