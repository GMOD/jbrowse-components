import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'MultiWiggleAdapter',
  {
    subadapters: {
      type: 'frozen',
      defaultValue: [],
    },
    bigWigUrls: {
      type: 'stringArray',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true },
)
