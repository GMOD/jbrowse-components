import { emphasize, makeContrasting } from '../util/color/index.ts'
import { alpha, darken, getLuminance, lighten } from './palette.ts'

const inputs = [
  '#0D233F',
  '#aaa',
  'rgb(12, 34, 56)',
  'rgba(12, 34, 56, 0.5)',
  'hsl(200, 50%, 40%)',
  'goldenrod',
  'Red',
  ' blue ',
  'transparent',
  '255,0,0',
  'not a color',
]

test.each(inputs)('%s resolves to the same channels', color => {
  expect({
    lighten: lighten(color, 0.2),
    darken: darken(color, 0.3),
    alpha: alpha(color, 0.4),
    luminance: getLuminance(color),
    emphasize: emphasize(color),
    contrastingOnWhite: makeContrasting(color, 'white'),
    contrastingOnDark: makeContrasting(color, '#121212'),
    contrastingOnNamedGrey: makeContrasting(color, 'darkgray'),
  }).toMatchSnapshot()
})
