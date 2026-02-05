import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'LinearWebGLCloudDisplay',
  {
    featureHeight: {
      type: 'number',
      defaultValue: 7,
      description: 'Height of each feature in pixels',
    },
    colorBy: {
      type: 'frozen',
      defaultValue: { type: 'insertSizeAndOrientation' },
      description: 'Color scheme for reads',
    },
    filterBy: {
      type: 'frozen',
      defaultValue: {},
      description: 'Filters for reads',
    },
  },
  { explicitlyTyped: true },
)
