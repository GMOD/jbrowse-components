import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'MultiWiggleAdapter',
  {
    subadapters: {
      type: 'frozen',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true },
)
