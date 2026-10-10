import { groupSeeAlso, seeAlsoMarkdown } from './remark-see-also.ts'

import type { ListItem, Root } from 'mdast'

function flatten(node: unknown): string {
  const n = node as { value?: string; url?: string; children?: unknown[] }
  const inner = n.value ?? (n.children ?? []).map(flatten).join('')
  return n.url ? `[${inner}](${n.url})` : inner
}

function item(text: string, url: string): ListItem {
  return {
    type: 'listItem',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'link', url, children: [{ type: 'text', value: text }] },
        ],
      },
    ],
  }
}

function bullets(heading: string, items: [string, string][]) {
  const tree: Root = {
    type: 'root',
    children: [
      {
        type: 'heading',
        depth: 2,
        children: [{ type: 'text', value: heading }],
      },
      { type: 'list', children: items.map(([t, u]) => item(t, u)) },
    ],
  }
  groupSeeAlso(tree)
  const list = tree.children[1]
  return list?.type === 'list' ? list.children.map(flatten) : []
}

test('groups bullets by kind and keeps author order within a kind', () => {
  expect(
    bullets('See also', [
      ['First', '/docs/tutorials/a'],
      ['A user guide', '/docs/user_guides/b'],
      ['Reference', '/docs/config/c'],
      ['Second', '/docs/tutorials/d'],
      ['Off-site', 'https://example.com/x'],
      ['A config guide', '/docs/config_guides/e'],
    ]),
  ).toEqual([
    'Tutorial: [First](/docs/tutorials/a)',
    'Tutorial: [Second](/docs/tutorials/d)',
    'User guide: [A user guide](/docs/user_guides/b)',
    'Config guide: [A config guide](/docs/config_guides/e)',
    'Reference: [Reference](/docs/config/c)',
    '[Off-site](https://example.com/x)',
  ])
})

test('does not repeat a collision label already in the link text', () => {
  expect(
    bullets('See also', [
      ['Config guide: MAF track', '/docs/config_guides/maf_track'],
    ]),
  ).toEqual(['Config guide: [MAF track](/docs/config_guides/maf_track)'])
})

test('drops a typed trailing "tutorial" from a tutorial bullet only', () => {
  expect(
    bullets('See also', [
      ['RNA-seq tutorial', '/docs/tutorials/rnaseq'],
      ['Plugin tutorial', '/docs/user_guides/plugin_tutorial'],
    ]),
  ).toEqual([
    'Tutorial: [RNA-seq](/docs/tutorials/rnaseq)',
    'User guide: [Plugin tutorial](/docs/user_guides/plugin_tutorial)',
  ])
})

describe('seeAlsoMarkdown', () => {
  const titles: Record<string, string> = {
    '/docs/tutorials/a': 'Tutorial A',
    '/docs/user_guides/b': 'Guide B',
    '/docs/config/c': 'Config C',
  }
  const titleFor = (url: string) => titles[url]

  test('titles empty links, then groups and prefixes the bullets', () => {
    const md = [
      '# Page',
      '',
      '## See also',
      '',
      '- [](/docs/user_guides/b/)',
      '- [](/docs/tutorials/a)',
      '- [Typed](/docs/config/c) with a tail',
      '  that wraps',
      '- [Off-site](https://example.com/x)',
      '',
      '## Citations',
      '',
      '- Li H. (2018)',
    ].join('\n')
    expect(seeAlsoMarkdown(md, titleFor)).toBe(
      [
        '# Page',
        '',
        '## See also',
        '',
        '- **Tutorial:** [Tutorial A](/docs/tutorials/a)',
        '- **User guide:** [Guide B](/docs/user_guides/b/)',
        '- **Reference:** [Typed](/docs/config/c) with a tail',
        '  that wraps',
        '- [Off-site](https://example.com/x)',
        '',
        '## Citations',
        '',
        '- Li H. (2018)',
      ].join('\n'),
    )
  })

  test('leaves a page without a See also list alone', () => {
    expect(seeAlsoMarkdown('## Other\n\n- [](/docs/nope)\n', titleFor)).toBe(
      '## Other\n\n- [](/docs/nope)\n',
    )
  })
})

test('leaves other lists alone', () => {
  expect(
    bullets('Other', [
      ['B', '/docs/user_guides/b'],
      ['A', '/docs/tutorials/a'],
    ]),
  ).toEqual(['[B](/docs/user_guides/b)', '[A](/docs/tutorials/a)'])
})
