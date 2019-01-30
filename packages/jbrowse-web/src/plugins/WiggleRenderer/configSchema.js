import { ConfigurationSchema } from '../../configuration'

export default ConfigurationSchema('WiggleRenderer', {
  height: {
    type: 'number',
    description: 'height in pixels of the track',
    defaultValue: 100,
  },
  color: {
    type: 'color',
    description: 'the color of the wiggle track',
    defaultValue: 'navy',
    functionSignature: ['feature'],
  },
})
