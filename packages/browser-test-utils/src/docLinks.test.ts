import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  findBrokenInboundLinks,
  findCrowdedPages,
  findPageDrift,
  sectionsRenderedBy,
} from './docLinks.ts'

test('a page past four sections is reported, and four is not', () => {
  const page = (slug: string, n: number) => ({
    slug,
    sections: Array.from({ length: n }, (_, i) => ({ slug: `${slug}-${i}` })),
  })
  expect(findCrowdedPages([page('four', 4), page('five', 5)])).toEqual([
    { slug: 'five', sections: 5, limit: 4 },
  ])
})

test('a page file renders the sections its Section tags name, in order', () => {
  const source = [
    "const dark = section(page, 'with-dark-theme')",
    "const custom = section(page, 'with-custom-theme')",
    '<Section {...custom} code={a}><A /></Section>',
    '<Section {...dark} code={b}><B /></Section>',
    '<Section slug="shadow-dom" code={c}><C /></Section>',
  ].join('\n')
  expect(sectionsRenderedBy(source)).toEqual([
    'with-custom-theme',
    'with-dark-theme',
    'shadow-dom',
  ])
})

function tmpPages(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'))
  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), text)
  }
  return dir
}

test('a page whose file and examples.ts disagree is reported, both ways', () => {
  const pagesDir = tmpPages({
    'index.astro': '',
    'one.astro': '<Section slug="b" code={x} /><Section slug="a" code={y} />',
    'stray.astro': '<Section slug="s" code={x} />',
  })
  expect(
    findPageDrift({
      pagesDir,
      pages: [
        { slug: 'one', sections: [{ slug: 'a' }, { slug: 'b' }] },
        { slug: 'missing', sections: [{ slug: 'm' }] },
      ],
    }),
  ).toEqual([
    {
      what: 'one',
      reason: 'examples.ts lists [a, b], the page renders [b, a]',
    },
    { what: 'missing', reason: 'no page file' },
    { what: 'stray', reason: 'page file not in examples.ts' },
  ])
})

test('a website link into the site resolves by its base, page and section', () => {
  const dir = tmpPages({
    'doc.md': [
      '[ok](https://jbrowse.org/storybook/lgv/plugins/#inline)',
      '[ok, no slash](https://jbrowse.org/storybook/lgv/plugins#inline)',
      '[landing](https://jbrowse.org/storybook/lgv/)',
      '[other site](https://jbrowse.org/storybook/app/nowhere/)',
      '[gone page](https://jbrowse.org/storybook/lgv/with-external-plugin/)',
      '[gone section](https://jbrowse.org/storybook/lgv/plugins/#worker)',
    ].join('\n'),
  })
  const broken = findBrokenInboundLinks({
    files: [path.join(dir, 'doc.md')],
    base: '/storybook/lgv',
    pages: [{ slug: 'plugins', sections: [{ slug: 'inline' }] }],
  })
  expect(broken.map(b => b.reason)).toEqual([
    'no page "with-external-plugin"',
    'page "plugins" has no section "worker"',
  ])
})
