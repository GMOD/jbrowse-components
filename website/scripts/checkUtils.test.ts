import { parseMetadata } from './check-utils.ts'

const doc = (body: string) => `---\n${body}\n---\n\n# Heading\n`

test('reads the keys of the metadata block', () => {
  expect(
    parseMetadata(
      doc(
        'name: x\ndescription: y\nmetadata:\n  area: alignments, RPC\n  order: 2',
      ),
    ),
  ).toEqual({ area: 'alignments, RPC', order: '2' })
})

test('re-flows a wrapped value onto one line', () => {
  expect(
    parseMetadata(
      doc('metadata:\n  first_move: count the calls over a\n    scripted zoom'),
    ).first_move,
  ).toBe('count the calls over a scripted zoom')
})

test('unquotes a value that had to be quoted for its colon', () => {
  expect(
    parseMetadata(
      doc('metadata:\n  first_move: "`:gate:ci` cannot: no display"'),
    ).first_move,
  ).toBe('`:gate:ci` cannot: no display')
})

test('stops at the next top-level key', () => {
  expect(parseMetadata(doc('metadata:\n  area: GPU\nname: x'))).toEqual({
    area: 'GPU',
  })
})

test('is empty for a doc with no metadata block', () => {
  expect(parseMetadata(doc('name: x\ndescription: y'))).toEqual({})
})
