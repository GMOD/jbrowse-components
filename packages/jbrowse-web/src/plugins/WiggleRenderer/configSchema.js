import { ConfigurationSchema } from '../../configuration'

export default ConfigurationSchema('WiggleRenderer', {
  height: {
    type: 'number',
    description: 'height in pixels of the track',
    defaultValue: 100,
  },
})
