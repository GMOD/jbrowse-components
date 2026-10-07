import rehypeDataUrls from './rehype-data-urls.ts'

import type { Element, ElementContent, Root } from 'hast'

function el(
  tagName: string,
  children: ElementContent[],
  properties: Element['properties'] = {},
): Element {
  return { type: 'element', tagName, properties, children }
}

function link(href: string, text = href) {
  return el('a', [{ type: 'text', value: text }], { href })
}

function page(sectionLinks: Element[]): Root {
  return {
    type: 'root',
    children: [
      el('h2', [{ type: 'text', value: 'Where the data comes from' }]),
      el('ul', sectionLinks.map(a => el('li', [a]))),
      el('h2', [{ type: 'text', value: 'Next' }]),
      el('p', [link('https://example.org/data/elsewhere.bed')]),
    ],
  }
}

function run(tree: Root) {
  // @ts-expect-error the attacher takes no options, and the file only needs `data`
  void rehypeDataUrls()(tree, { data: {} })
  return JSON.stringify(tree)
}

test('a bare URL in the section shows as host/…/file beside its full text', () => {
  const out = run(page([link('https://example.org/data/hg38/genes.gff.gz')]))
  expect(out).toContain('"value":"example.org/…/genes.gff.gz"')
  expect(out).toContain('"id":"show-full-urls"')
})

test('a named link and a URL under the next heading keep their text', () => {
  const out = run(
    page([
      link('https://example.org/data/a.bed'),
      link('https://example.org/data/other.bed', 'a named link'),
    ]),
  )
  expect(out).toContain('"value":"a named link"')
  expect(out).toContain('"value":"https://example.org/data/elsewhere.bed"')
  expect(out).not.toContain('"value":"example.org/…/elsewhere.bed"')
})

test('a section with no bare URL gets no toggle', () => {
  expect(
    run(page([link('https://example.org/a/b', 'named')])),
  ).not.toContain('show-full-urls')
})

test('a section whose only bare URLs sit in a collapsed list keeps them whole', () => {
  const tree = page([])
  tree.children[1] = el('details', [
    el('ul', [el('li', [link('https://example.org/data/hg38/genes.gff.gz')])]),
  ])
  const out = run(tree)
  expect(out).not.toContain('show-full-urls')
  expect(out).toContain('"value":"https://example.org/data/hg38/genes.gff.gz"')
})
