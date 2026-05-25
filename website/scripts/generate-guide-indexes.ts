import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const docsDir = join(import.meta.dirname, '..', 'docs')
const check = process.argv.includes('--check')

interface Entry {
  title: string
  description: string
  slug: string
  dir: string
}

function parseFrontmatter(content: string) {
  const match = /^---\n([\s\S]*?)\n---/.exec(content)
  if (!match) {
    return {}
  }
  const result: Record<string, string> = {}
  let currentKey: string | null = null
  for (const line of match[1].split('\n')) {
    if (currentKey !== null && /^\s+\S/.test(line)) {
      // continuation of a multi-line block scalar value
      const prev = result[currentKey]
      result[currentKey] = prev ? `${prev} ${line.trim()}` : line.trim()
    } else {
      const colon = line.indexOf(':')
      if (colon !== -1) {
        currentKey = line.slice(0, colon).trim()
        result[currentKey] = line.slice(colon + 1).trim()
      }
    }
  }
  return result
}

function collectEntries(dir: string, urlDir: string): Map<string, Entry[]> {
  const map = new Map<string, Entry[]>()
  for (const file of readdirSync(dir).filter(f => f.endsWith('.md'))) {
    const content = readFileSync(join(dir, file), 'utf8')
    const fm = parseFrontmatter(content)
    if (!fm['guide_category'] || !fm['description']) {
      continue
    }
    const cat = fm['guide_category']
    const entry: Entry = {
      title: fm['title'] ?? file.replace(/\.md$/, ''),
      description: fm['description'],
      slug: file.replace(/\.md$/, ''),
      dir: urlDir,
    }
    if (!map.has(cat)) {
      map.set(cat, [])
    }
    map.get(cat)!.push(entry)
  }
  return map
}

function checkMissingFrontmatter(
  dir: string,
  label: string,
): { file: string; missing: string[] }[] {
  const problems: { file: string; missing: string[] }[] = []
  for (const file of readdirSync(dir).filter(f => f.endsWith('.md'))) {
    const content = readFileSync(join(dir, file), 'utf8')
    const fm = parseFrontmatter(content)
    if (fm['redirect']) {
      continue
    }
    const missing = []
    if (!fm['description']) {
      missing.push('description')
    }
    if (!fm['guide_category']) {
      missing.push('guide_category')
    }
    if (missing.length) {
      problems.push({ file: `${label}/${file}`, missing })
    }
  }
  return problems
}

function buildTocSection(
  categoryOrder: string[],
  entryMaps: { dir: string; urlDir: string }[],
  headingLevel = '##',
): string[] {
  const allEntries = new Map<string, Entry[]>()
  for (const { dir, urlDir } of entryMaps) {
    for (const [cat, entries] of collectEntries(dir, urlDir)) {
      allEntries.set(cat, [...(allEntries.get(cat) ?? []), ...entries])
    }
  }
  const lines: string[] = []
  for (const cat of categoryOrder) {
    const entries = allEntries.get(cat)
    if (!entries?.length) {
      continue
    }
    lines.push(`${headingLevel} ${cat}`, '')
    for (const e of entries) {
      lines.push(`- [${e.title}](/docs/${e.dir}/${e.slug}) - ${e.description}`)
    }
    lines.push('')
  }
  return lines
}

function buildUserGuide(): string {
  const lines: string[] = [
    '---',
    'id: user_guide',
    'toplevel: true',
    'title: User guide',
    '---',
    '',
    ...buildTocSection(
      ['General usage', 'Track types', 'Views', 'Other features', 'Tutorials'],
      [
        { dir: join(docsDir, 'user_guides'), urlDir: 'user_guides' },
        { dir: join(docsDir, 'tutorials'), urlDir: 'tutorials' },
      ],
    ),
  ]
  return lines.join('\n')
}

function buildConfigGuide(): string {
  const lines: string[] = [
    '---',
    'id: config_guide',
    'title: Introduction - Config guide',
    'toplevel: true',
    '---',
    '',
    'The following guide provides comprehensive information regarding the anatomy and',
    'usage of the `config.json` file that is critical for running a JBrowse 2',
    'session.',
    '',
    ...buildTocSection(
      [
        'Getting started',
        'Core configuration',
        'Track types',
        'Callbacks and customization',
        'Other features',
      ],
      [{ dir: join(docsDir, 'config_guides'), urlDir: 'config_guides' }],
    ),
  ]
  return lines.join('\n')
}

function buildDeveloperGuide(): string {
  const preamble = `---
id: developer_guide
title: Developer guide
toplevel: true
---

This guide covers how JBrowse 2 code is packaged and structured, and how to
create new plugins and pluggable elements.

## Products and plugins

The JBrowse 2 ecosystem has two main types of top-level artifacts that are
published on their own: products and plugins.

<Figure src="/img/products_and_plugins.png" caption="Architecture diagram of JBrowse 2, showing how plugins encapsulate views (e.g. LinearGenomeView, DotplotView etc.), tracks (AlignmentsTrack, VariantTrack, etc.), adapters (BamAdapter, VcfTabixAdapter, etc.) and other logic like mobx state tree autoruns that add logic to other parts of the app (e.g. adding context menus)"/>

A "product" is an application of some kind that is published on its own (a web
app, an electron app, a CLI app, etc). \`jbrowse-web\`, \`jbrowse-desktop\`, and
\`jbrowse-cli\` are products.

A "plugin" is a package of functionality that is designed to "plug in" to a
product **at runtime** to add functionality. These can be written and published
by anyone, not just the JBrowse core team. Not all of the products use plugins,
but most of them do.

<Figure src="/img/product_architecture.png" caption="This figure summarizes the general architecture of our state model and React component tree"/>

## Example plugins

Plugin templates:

- [jbrowse-plugin-template](https://github.com/GMOD/jbrowse-plugin-template)
- [jbrowse-plugin-esbuild-template](https://github.com/GMOD/jbrowse-plugin-esbuild-template)
  (lightweight esbuild-based alternative)

Working plugin examples:

- [jbrowse-plugin-ucsc-api](https://github.com/cmdcolin/jbrowse-plugin-ucsc-api)
  probably the simplest plugin example, it demonstrates accessing data from UCSC
  REST API
- [jbrowse-plugin-gwas](https://github.com/cmdcolin/jbrowse-plugin-gwas) a
  custom plugin to display manhattan plot GWAS data
- [jbrowse-plugin-biothings-api](https://github.com/cmdcolin/jbrowse-plugin-biothings-api)
  demonstrates accessing data from mygene.info, part of the "biothings API"
  family
- [jbrowse-plugin-msaview](https://github.com/GMOD/jbrowse-plugin-msaview) -
  demonstrates creating a custom view type that doesn't use any conventional
  tracks
- [jbrowse-plugin-gdc](https://github.com/GMOD/jbrowse-plugin-gdc) demonstrates
  accessing GDC cancer data GraphQL API, plus a custom drawer and track type for
  coloring variants by impact score
- [jbrowse-plugin-systeminformation](https://github.com/garrettjstevens/jbrowse-plugin-systeminformation)
  demonstrates using desktop specific functionality, accessing system node
  libraries. This desktop specific functionality should use the CJS bundle type
  (electron doesn't support ESM yet)

These show how plugins are structured and can serve as templates for your own
pluggable elements.

The [jbrowse-plugin-list](https://github.com/GMOD/jbrowse-plugin-list) is the
community plugin registry — browse it to find published plugins or submit your
own via pull request.

`

  const toc = buildTocSection(
    [
      'Getting started',
      'Core concepts',
      'Creating pluggable elements',
      'Advanced topics',
    ],
    [{ dir: join(docsDir, 'developer_guides'), urlDir: 'developer_guides' }],
    '###',
  )

  return preamble + ['## Developer guides', '', ...toc].join('\n')
}

function checkOrWrite(path: string, generated: string, label: string) {
  if (check) {
    const current = readFileSync(path, 'utf8')
    if (current !== generated) {
      console.error(`${label} is out of date — run: pnpm lint-docs`)
      process.exit(1)
    }
    console.log(`${label} is up to date`)
  } else {
    writeFileSync(path, generated)
    console.log(`${label} regenerated`)
  }
}

// Check for guide files missing required frontmatter fields.
// tutorials/ is excluded: it's a mixed-use directory (user + developer tutorials)
// managed explicitly in sidebars.json rather than auto-indexed.
const guideDirs = [
  { dir: join(docsDir, 'user_guides'), label: 'user_guides' },
  { dir: join(docsDir, 'config_guides'), label: 'config_guides' },
  { dir: join(docsDir, 'developer_guides'), label: 'developer_guides' },
]
const problems = guideDirs.flatMap(({ dir, label }) =>
  checkMissingFrontmatter(dir, label),
)
if (problems.length) {
  for (const { file, missing } of problems) {
    console.error(`${file}: missing frontmatter fields: ${missing.join(', ')}`)
  }
  console.error(
    `\nAdd the missing fields so these pages appear in the guide indexes.`,
  )
  process.exit(1)
}

checkOrWrite(join(docsDir, 'user_guide.md'), buildUserGuide(), 'user_guide.md')
checkOrWrite(
  join(docsDir, 'config_guide.md'),
  buildConfigGuide(),
  'config_guide.md',
)
checkOrWrite(
  join(docsDir, 'developer_guide.md'),
  buildDeveloperGuide(),
  'developer_guide.md',
)
