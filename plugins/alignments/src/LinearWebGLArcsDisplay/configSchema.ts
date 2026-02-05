import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'LinearWebGLArcsDisplay',
  {
    colorBy: {
      type: 'frozen',
      defaultValue: { type: 'insertSizeAndOrientation' },
      description: 'Color scheme for arcs',
    },
    filterBy: {
      type: 'frozen',
      defaultValue: {},
      description: 'Filters for reads',
    },
    lineWidth: {
      type: 'number',
      defaultValue: 1,
      description: 'Width of arc lines',
    },
  },
  { explicitlyTyped: true },
)
