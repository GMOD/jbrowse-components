import { ConfigurationSchema } from '../../configuration'

export default ConfigurationSchema('DivSequenceRenderer', {
  color1: {
    type: 'color',
    description: 'the main color of each feature',
    defaultValue: 'goldenrod',
  },
  color2: {
    type: 'color',
    description:
      'the secondary color of each feature, used for connecting lines, etc',
    defaultValue: 'black',
  },
  color3: {
    type: 'color',
    description:
      'the tertiary color of each feature, often used for contrasting fills, like on UTRs',
    defaultValue: '#357089',
  },
  height: {
    type: 'number',
    description: 'height in pixels of the main body of each feature',
    defaultValue: 10,
  },
})
