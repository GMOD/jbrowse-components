import {
  GENERATED_NOTICE,
  markerBlocks,
  spliceMarkerBlocks,
  withoutMarkerBlocks,
} from './markerBlocks.ts'

const begin = '<!-- BEGIN GENERATED T -->'
const end = '<!-- END GENERATED T -->'

describe('markerBlocks', () => {
  test('finds a plain and a grouped block, with their lines', () => {
    expect(
      markerBlocks(
        [
          begin,
          end,
          '<!-- BEGIN GENERATED COLOR_TABLE alignments-indicators -->',
          '<!-- END GENERATED COLOR_TABLE alignments-indicators -->',
        ].join('\n'),
        'doc.md',
      ),
    ).toEqual([
      { name: 'T', group: undefined, begin: 0, end: 1 },
      { name: 'COLOR_TABLE', group: 'alignments-indicators', begin: 2, end: 3 },
    ])
  })

  // CommonMark reads an HTML comment mid-paragraph as inline text, so nothing
  // is spliced there, and a fence quoting the convention is a doc about a
  // block: counting either would report a block no generator owes.
  test('ignores a marker inside a sentence or a code fence', () => {
    expect(
      markerBlocks(
        `Quoting \`${begin}\` here.\n\`\`\`md\n${begin}\n\`\`\`\n${begin} and more`,
        'doc.md',
      ),
    ).toEqual([])
  })

  test('a longer fence is closed only by a fence as long', () => {
    expect(
      markerBlocks(
        `\`\`\`\`md\n\`\`\`\n${begin}\n\`\`\`\`\n${begin}\n${end}`,
        'doc.md',
      ),
    ).toEqual([{ name: 'T', group: undefined, begin: 4, end: 5 }])
  })

  test.each([
    [
      'a BEGIN with no END',
      `${begin}\nold\n`,
      /has no <!-- END GENERATED T -->/,
    ],
    [
      'a second BEGIN before the END',
      `${begin}\n${begin}\n${end}`,
      /opens inside/,
    ],
    ['an END above its BEGIN', `${end}\n${begin}`, /closes no open/],
    [
      'an END for another group',
      '<!-- BEGIN GENERATED T a -->\n<!-- END GENERATED T b -->',
      /closes no open/,
    ],
  ])('refuses %s', (_, text, error) => {
    expect(() => markerBlocks(text, 'doc.md')).toThrow(error)
  })
})

describe('spliceMarkerBlocks', () => {
  const splice = (text: string, body = 'BODY', allowEmpty = false) =>
    spliceMarkerBlocks({
      text,
      file: 'agent-docs/x.md',
      name: 'T',
      render: () => body,
      allowEmpty,
    })

  // The notice comes from `GENERATED_NOTICE` rather than being spelled again
  // here: rewording it is what staled this assertion, and a restated copy would
  // only do it a second time.
  test('rewrites the block under the notice, a blank line before END', () => {
    expect(splice(`a\n${begin}\nold\n${end}\nb`)).toBe(
      `a\n${begin}\n\n${GENERATED_NOTICE}\n\nBODY\n\n${end}\nb`,
    )
  })

  test('a website doc carries no notice', () => {
    expect(
      spliceMarkerBlocks({
        text: `${begin}\n${end}`,
        file: 'website/docs/x.md',
        name: 'T',
        render: () => 'BODY',
      }),
    ).toBe(`${begin}\n\nBODY\n\n${end}`)
  })

  test('refuses to publish an empty block unless the call allows it', () => {
    expect(() => splice(`${begin}\n\n${end}`, ' \n')).toThrow(
      /rendered nothing/,
    )
    expect(splice(`${begin}\nold\n${end}`, '', true)).toBe(`${begin}\n\n${end}`)
  })

  test('rewrites EVERY block, not just the first', () => {
    // A non-global replace left the second block on the previous run's content
    // forever, and `--check` could not see it: the text it compares is the same
    // whether or not that block was regenerated.
    const doc = [
      `${begin}\n\nBODY\n\n${end}`,
      `${begin}\n\nstale\n\n${end}`,
    ].join('\n\nprose\n\nmore\n\n')
    expect(splice(doc)).not.toContain('stale')
  })

  test('renders each group its own body', () => {
    expect(
      spliceMarkerBlocks({
        text: '<!-- BEGIN GENERATED T a -->\n<!-- END GENERATED T a -->\n<!-- BEGIN GENERATED T b -->\n<!-- END GENERATED T b -->',
        file: 'website/docs/x.md',
        name: 'T',
        render: ({ group }) => `group ${group}`,
      }),
    ).toBe(
      '<!-- BEGIN GENERATED T a -->\n\ngroup a\n\n<!-- END GENERATED T a -->\n<!-- BEGIN GENERATED T b -->\n\ngroup b\n\n<!-- END GENERATED T b -->',
    )
  })

  test('leaves a block quoted in a fence alone', () => {
    const fenced = `\`\`\`md\n${begin}\nexample\n${end}\n\`\`\``
    expect(splice(`${fenced}\n${begin}\n${end}`)).toMatch(
      /^```md\n.*\nexample\n/,
    )
  })

  test('throws when the doc carries no such block', () => {
    expect(() => splice('nothing to see')).toThrow(
      /no <!-- BEGIN GENERATED T -->/,
    )
  })

  test('keeps a $-sequence in the rendered block literal', () => {
    expect(splice(`${begin}\n${end}`, "$' and $&")).toContain("$' and $&")
  })
})

describe('withoutMarkerBlocks', () => {
  test('blanks the blocks, or only the named ones', () => {
    const text = `a\n${begin}\nx\n${end}\n<!-- BEGIN GENERATED U -->\ny\n<!-- END GENERATED U -->\nb`
    expect(withoutMarkerBlocks(text, 'doc.md')).toBe('a\n\n\n\n\n\n\nb')
    expect(withoutMarkerBlocks(text, 'doc.md', 'U')).toBe(
      `a\n${begin}\nx\n${end}\n\n\n\nb`,
    )
  })
})
