import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default ConfigurationSchema(
  'MCScanAnchorsAdapter',
  {
    mcscanAnchorsLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/mcscan.anchors' },
    },
    subadapters: {
      type: 'frozen',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true },
)
