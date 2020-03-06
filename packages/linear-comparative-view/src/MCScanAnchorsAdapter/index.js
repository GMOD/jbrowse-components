import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './MCScanAnchorsAdapter'

export const configSchema = ConfigurationSchema(
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
