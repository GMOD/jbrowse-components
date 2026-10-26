import {
  GENERATED_NOTICE,
  parseFrontmatter,
  parseMetadata,
  spliceGeneratedBlock,
} from './check-utils.ts'

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

test('a quoted value folded under its key comes out as one unquoted line', () => {
  expect(
    parseFrontmatter(
      doc(
        "title:\n  'Part 1: sickle cell, the gene''s\n  variant'\ndescription:\n  \"Two: lines\"\nsidebar: plain",
      ),
    ),
  ).toEqual({
    title: "Part 1: sickle cell, the gene's variant",
    description: 'Two: lines',
    sidebar: 'plain',
  })
})

describe('spliceGeneratedBlock', () => {
  const begin = '<!-- BEGIN GENERATED T -->'
  const end = '<!-- END GENERATED T -->'
  const splice = (text: string, body = ['row']) =>
    spliceGeneratedBlock({ path: 'agent-docs/x.md', marker: 'T', body, text })

  test('rewrites the block under the notice, a blank line before END', () => {
    expect(splice(`a\n${begin}\nold\n${end}\nb`)).toBe(
      `a\n${begin}\n\n${GENERATED_NOTICE}\n\nrow\n\n${end}\nb`,
    )
  })

  test('keeps an empty block empty', () => {
    expect(splice(`${begin}\nold\n${end}`, [])).toBe(`${begin}\n\n${end}`)
  })

  test('splices at the marker line, not at a mention of it in prose', () => {
    const text = `Quoting \`${begin}\` here.\n${begin}\nold\n${end}`
    expect(splice(text)).toMatch(/^Quoting `[^`]+` here\.\n<!-- BEGIN/)
  })

  test.each([
    ['a missing pair', 'no markers', /missing/],
    ['a second pair', `${begin}\n${end}\n${begin}\n${end}`, /more than one/],
    ['an END above its BEGIN', `${end}\n${begin}`, /no matching/],
  ])('refuses %s', (_, text, error) => {
    expect(() => splice(text)).toThrow(error)
  })
})
