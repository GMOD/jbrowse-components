import { ConfigurationSchema } from '../../configuration'

export default ConfigurationSchema('WiggleRenderer', {
  height: {
    type: 'number',
    description: 'height in pixels of each line of sequence',
    defaultValue: 16,
  },
})
