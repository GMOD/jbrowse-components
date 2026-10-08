import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { findBrokenInboundLinks, findPageDrift } from './docLinks.ts'

function tmpDir(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doclinks-'))
  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), text)
  }
  return dir
}

const page = (slug: string, example: string) =>
  `import Demo from '../examples/${example}.tsx'\n<ExamplePage slug="${slug}" />`

test('a page, its file and its example that disagree are reported', () => {
  const pagesDir = tmpDir({
    'index.astro': '',
    'dark-theme.astro': page('dark-theme', 'DarkTheme'),
    'web-worker.astro': page('web-worker', 'WithWebWorker'),
    'stray.astro': page('stray', 'Stray'),
  })
  const examplesDir = tmpDir({
    'DarkTheme.tsx': '',
    'WithWebWorker.tsx': '',
    'data.json': '',
  })
  expect(
    findPageDrift({
      pagesDir,
      examplesDir,
      pages: [
        { slug: 'dark-theme' },
        { slug: 'web-worker' },
        { slug: 'missing' },
      ],
    }),
  ).toEqual([
    {
      what: 'web-worker',
      reason: 'the page file does not mount WebWorker.tsx',
    },
    { what: 'web-worker', reason: 'no src/examples/WebWorker.tsx' },
    { what: 'missing', reason: 'no page file' },
    { what: 'stray', reason: 'page file not in examples.ts' },
    { what: 'WithWebWorker.tsx', reason: 'example file with no page' },
  ])
})

test('a website link into the site resolves by its base and page', () => {
  const dir = tmpDir({
    'doc.md': [
      '[ok](https://jbrowse.org/storybook/lgv/inline-plugin/)',
      '[ok, no slash](https://jbrowse.org/storybook/lgv/inline-plugin)',
      '[ok, own anchor](https://jbrowse.org/storybook/lgv/inline-plugin/#inline-plugin)',
      '[landing](https://jbrowse.org/storybook/lgv/)',
      '[other site](https://jbrowse.org/storybook/app/nowhere/)',
      '[gone page](https://jbrowse.org/storybook/lgv/plugins/)',
      '[gone anchor](https://jbrowse.org/storybook/lgv/inline-plugin/#worker)',
    ].join('\n'),
  })
  const broken = findBrokenInboundLinks({
    files: [path.join(dir, 'doc.md')],
    base: '/storybook/lgv',
    pages: [{ slug: 'inline-plugin' }],
  })
  expect(broken.map(b => b.reason)).toEqual([
    'no page "plugins"',
    'page "inline-plugin" has no anchor "worker"',
  ])
})
