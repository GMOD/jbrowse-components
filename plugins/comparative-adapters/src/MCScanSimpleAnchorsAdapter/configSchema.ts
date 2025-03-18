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
    mcscanSimpleAnchorsLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/mcscan.anchors.simple',
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
  {
    explicitlyTyped: true,
    preProcessSnapshot: snap => {
      return snap.uri && snap.bed1 && snap.bed2
        ? {
            ...snap,
            mcscanSimpleAnchorsLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
            bed1Location: {
              uri: snap.bed1,
              baseUri: snap.baseUri,
            },
            bed2Location: {
              uri: snap.bed2,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)
export default MCScanSimpleAnchorsAdapter
