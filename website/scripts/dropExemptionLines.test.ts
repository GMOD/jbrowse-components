import { dropExemptionLines } from './dropExemptionLines.ts'

const SET = `export const PATH_PROSE = new Set([
  // the location box, then the highlight control
  'Zoom to region',
  // the tree sidebar's own affordances
  'drag the rows into order',
  "set each row's color",
])
`

test('drops the dead entry and leaves its neighbours', () => {
  expect(dropExemptionLines(SET, ['drag the rows into order'])).toBe(
    `export const PATH_PROSE = new Set([
  // the location box, then the highlight control
  'Zoom to region',
  // the tree sidebar's own affordances
  "set each row's color",
])
`,
  )
})

test('the comment goes when every entry it covered goes', () => {
  expect(
    dropExemptionLines(SET, [
      'drag the rows into order',
      "set each row's color",
    ]),
  ).toBe(
    `export const PATH_PROSE = new Set([
  // the location box, then the highlight control
  'Zoom to region',
])
`,
  )
})

// The bug this function exists as its own file to pin. A blank line between a
// comment and its entries used to flush the group with nothing kept, which is
// indistinguishable from "every entry died" — so the comment was deleted even
// though the entries below it were all alive and stayed.
test('a blank line under a comment does not delete the comment', () => {
  const spaced = `export const PATH_ROOTS = new Set([
  // a control, not a row

  'Track menu',
  'View menu',
])
`
  expect(dropExemptionLines(spaced, ['View menu'])).toBe(
    `export const PATH_ROOTS = new Set([
  // a control, not a row

  'Track menu',
])
`,
  )
})

test('an entry naming nothing dead is untouched, file and all', () => {
  expect(dropExemptionLines(SET, ['not in here'])).toBe(SET)
})

test('an escaped quote in an entry still matches', () => {
  const escaped = `const X = new Set([
  'it\\'s here',
  'other',
])
`
  expect(dropExemptionLines(escaped, ["it's here"])).toBe(
    `const X = new Set([
  'other',
])
`,
  )
})

test('code outside a set literal is passed through', () => {
  const mixed = `export function f() {
  return 1
}
const S = new Set([
  'dead',
])
export const after = 2
`
  expect(dropExemptionLines(mixed, ['dead'])).toBe(
    `export function f() {
  return 1
}
const S = new Set([
])
export const after = 2
`,
  )
})
