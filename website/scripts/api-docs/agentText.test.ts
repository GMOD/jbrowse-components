import {
  agentPage,
  exampleBlock,
  firstParagraph,
  flatCode,
  memberLine,
  pluginOf,
} from './agentText.ts'

describe('firstParagraph', () => {
  it('takes the first paragraph, collapsed to one line', () => {
    expect(firstParagraph('a\n  b\n\nsecond')).toBe('a b')
  })

  it('cuts a long paragraph at a word boundary', () => {
    const long = `${'word '.repeat(100)}end`
    const out = firstParagraph(long, 50)
    expect(out.length).toBeLessThanOrEqual(51)
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toMatch(/wor…$/)
  })

  it('is empty for nothing', () => {
    expect(firstParagraph(undefined)).toBe('')
    expect(firstParagraph('\n\n')).toBe('')
  })
})

describe('memberLine', () => {
  it('keeps the signature in backticks ahead of the prose', () => {
    expect(
      memberLine(
        'setSortedBy',
        '(type: string, tag?: string) => void',
        'Sort.',
      ),
    ).toBe('- `setSortedBy(type: string, tag?: string) => void`: Sort.')
  })

  it('omits the colon when there is no prose', () => {
    expect(memberLine('clear', '() => void', '')).toBe('- `clear() => void`')
  })
})

it('flatCode collapses whitespace and truncates', () => {
  expect(flatCode('a\n   b')).toBe('a b')
  expect(flatCode('x'.repeat(200), 10)).toBe('xxxxxxxxx…')
})

it('exampleBlock passes authored markdown through and is empty without one', () => {
  expect(exampleBlock(' Prose.\n\n```js\n{a:1}\n```\n')).toBe(
    'Prose.\n\n```js\n{a:1}\n```',
  )
  expect(exampleBlock(undefined)).toBe('')
})

it('pluginOf reads the plugin out of a source path', () => {
  expect(pluginOf('plugins/alignments/src/BamAdapter/configSchema.ts')).toBe(
    'alignments plugin',
  )
  expect(pluginOf('packages/core/util/x.ts')).toBe('core')
})

it('agentPage drops empty intro lines and empty sections', () => {
  expect(
    agentPage(
      'T',
      ['intro', false, undefined],
      [
        { heading: 'A', lines: ['- a'] },
        { heading: 'B', lines: [] },
      ],
    ),
  ).toBe('# T\n\nintro\n\n## A\n- a')
})
