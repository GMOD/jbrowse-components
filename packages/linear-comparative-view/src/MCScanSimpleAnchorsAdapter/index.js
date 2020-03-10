import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './MCScanSimpleAnchorsAdapter'

export const configSchema = ConfigurationSchema(
  'MCScanSimpleAnchorsAdapter',
  {
    mcscanSimpleAnchorsLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/mcscan.anchors.simple' },
    },
    subadapters: {
      type: 'frozen',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true },
)
