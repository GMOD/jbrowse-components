/**
 * `emphasize` was Material UI's until the `@mui/material/styles` import was cut
 * out of this module (it is reached from plugin registration, so it kept MUI in
 * every host's first paint). Same values, and this is what says so: the sibling
 * of `palette.test.ts`, over the one function that module does not cover.
 */
import { emphasize as muiEmphasize } from '@mui/material/styles'

import { emphasize } from './index.ts'

test.each([
  // either side of the 0.5 luminance boundary, where the branch flips
  ['near-white', '#f5f5f5'],
  ['near-black', '#111111'],
  ['mid grey', '#808080'],
  ['brand midnight', '#0D233F'],
  ['brand mandarin', '#FFB11D'],
  // truncation bites hardest where a channel lands just under an integer
  ['odd channels', '#0d1f2b'],
  ['three-digit hex', '#aaa'],
  ['rgb()', 'rgb(12, 34, 56)'],
])('%s matches MUI', (_name, color) => {
  expect(emphasize(color)).toBe(muiEmphasize(color))
  expect(emphasize(color, 0.4)).toBe(muiEmphasize(color, 0.4))
})

/**
 * The one place the two differ, stated rather than left to be rediscovered.
 * MUI carries a fractional alpha through as the float it parsed; JBrowse's
 * color pipeline is 8-bit end to end (`util/colord.ts` is backed by
 * `color-bits`), so `0.5` comes back as `128/255`. The same channel to a
 * quarter of a percent, and the same quantization every canvas in JBrowse
 * already applies — but not the same string.
 */
test('a fractional alpha is quantized to 8 bits, unlike MUI', () => {
  expect(emphasize('rgba(12, 34, 56, 0.5)')).toBe(
    'rgba(48, 67, 85, 0.5019607843137255)',
  )
  expect(muiEmphasize('rgba(12, 34, 56, 0.5)')).toBe('rgba(48, 67, 85, 0.5)')
})

/**
 * The reason this is JBrowse's own function and not a re-export: MUI's throws
 * on a named color, and a `color` config slot is a string a user typed.
 */
test('a named color, which MUI cannot take', () => {
  expect(emphasize('goldenrod')).toBe(muiEmphasize('#daa520'))
  expect(() => muiEmphasize('goldenrod')).toThrow()
})
