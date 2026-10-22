import { ensureAutogenIndex } from './autogen-links.ts'
import remarkDocCards from './remark-doc-cards.ts'

import type { ListItem, PhrasingContent, Root, RootContent } from 'mdast'
import type { VFile } from 'vfile'

ensureAutogenIndex([
  {
    id: 'user_guides/with_figure',
    data: { title: 'With figure', description: 'Has <b>a</b> figure' },
    body: '<Figure caption="x" src="/img/some/fig.png" />',
  },
  {
    id: 'user_guides/no_figure',
    data: { title: 'No figure' },
    body: 'prose only',
  },
])

const marker: RootContent = { type: 'html', value: '<!-- doccards -->' }

function item(url: string, extra: PhrasingContent[] = []): ListItem {
  return {
    type: 'listItem',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'link', url, children: [] }, ...extra],
      },
    ],
  }
}

function run(children: RootContent[]) {
  const tree: Root = { type: 'root', children }
  const transform = remarkDocCards.call(undefined as never) as (
    tree: Root,
    file: Pick<VFile, 'data'>,
  ) => void
  transform(tree, { data: { id: 'user_guide' } })
  return tree.children
}

test('a marked list becomes one card per linked page', () => {
  const [node, ...rest] = run([
    marker,
    {
      type: 'list',
      children: [
        item('/docs/user_guides/with_figure'),
        item('/docs/user_guides/no_figure'),
      ],
    },
  ])
  expect(rest).toHaveLength(0)
  const html = node?.type === 'html' ? node.value : ''
  expect(html).toContain('src="/img/guide-thumbs/with_figure.webp"')
  expect(html).toContain('Has &lt;b&gt;a&lt;/b&gt; figure')
  expect(html).toContain('doc-card-thumb-empty')
  expect(html.match(/class="doc-card"/g)).toHaveLength(2)
})

test('an unmarked list is left alone', () => {
  const [node] = run([
    { type: 'list', children: [item('/docs/user_guides/with_figure')] },
  ])
  expect(node?.type).toBe('list')
})

test('a list item that is not a lone link throws', () => {
  expect(() =>
    run([
      marker,
      {
        type: 'list',
        children: [
          item('/docs/user_guides/with_figure', [
            { type: 'text', value: ' extra' },
          ]),
        ],
      },
    ]),
  ).toThrow('lone link')
})
