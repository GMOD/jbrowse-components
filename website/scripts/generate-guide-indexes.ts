import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// The category order (and thus the allowed `guide_category` values) for each
// guide index, shared with the sidebar builder so the two groupings can't
// drift. A page tagged with a category not in its guide's list is silently
// dropped from every index, so these double as the validation allow-lists below.
import {
  CONFIG_CATEGORIES,
  DEVELOPER_CATEGORIES,
  USER_CATEGORIES,
} from '../src/lib/guide-categories.ts'
import { checkOrWrite } from './check-utils.ts'

const docsDir = join(import.meta.dirname, '..', 'docs')

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
  const [, body = ''] = match
  for (const line of body.split('\n')) {
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
  const mdFiles = readdirSync(dir).filter(f => f.endsWith('.md'))
  for (const file of mdFiles) {
    const content = readFileSync(join(dir, file), 'utf8')
    const fm = parseFrontmatter(content)
    if (!fm.guide_category || !fm.description) {
      continue
    }
    const cat = fm.guide_category
    const entry: Entry = {
      title: fm.title ?? file.replace(/\.md$/, ''),
      description: fm.description,
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
  const mdFiles = readdirSync(dir).filter(f => f.endsWith('.md'))
  for (const file of mdFiles) {
    const content = readFileSync(join(dir, file), 'utf8')
    const fm = parseFrontmatter(content)
    const missing = []
    if (!fm.description) {
      missing.push('description')
    }
    if (!fm.guide_category) {
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
    'title: User guide',
    'sidebar_label: Overview',
    '---',
    '',
    ...buildTocSection(USER_CATEGORIES, [
      { dir: join(docsDir, 'user_guides'), urlDir: 'user_guides' },
      { dir: join(docsDir, 'tutorials'), urlDir: 'tutorials' },
    ]),
  ]
  return lines.join('\n')
}

function buildConfigGuide(): string {
  const lines: string[] = [
    '---',
    'title: Config guide',
    'sidebar_label: Overview',
    '---',
    '',
    'This guide covers the structure and usage of the `config.json` file that drives',
    'a JBrowse 2 session. Prefer copy-paste snippets? See the',
    '[Cookbook](/docs/cookbook) for short recipes covering the most common tasks.',
    '',
    ...buildTocSection(CONFIG_CATEGORIES, [
      { dir: join(docsDir, 'config_guides'), urlDir: 'config_guides' },
    ]),
  ]
  return lines.join('\n')
}

function buildDeveloperGuide(): string {
  const preamble = `---
title: Developer guide
sidebar_label: Overview
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
by anyone, not just the JBrowse core team. Most products load plugins at runtime, though it
isn't required.

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

Use these as references when building your own.

The [jbrowse-plugin-list](https://github.com/GMOD/jbrowse-plugin-list) is the
community plugin registry: browse it to find published plugins or submit your
own via pull request.

`

  const toc = buildTocSection(
    DEVELOPER_CATEGORIES,
    [{ dir: join(docsDir, 'developer_guides'), urlDir: 'developer_guides' }],
    '###',
  )

  return preamble + ['## Developer guides', '', ...toc].join('\n')
}

// Check for guide files missing required frontmatter fields.
// tutorials/ is excluded: it's a mixed-use directory (user + developer tutorials)
// managed explicitly in sidebars.json rather than auto-indexed.
const guideDirs = [
  {
    dir: join(docsDir, 'user_guides'),
    label: 'user_guides',
    categories: USER_CATEGORIES,
  },
  {
    dir: join(docsDir, 'config_guides'),
    label: 'config_guides',
    categories: CONFIG_CATEGORIES,
  },
  {
    dir: join(docsDir, 'developer_guides'),
    label: 'developer_guides',
    categories: DEVELOPER_CATEGORIES,
  },
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

// A guide_category not in its guide's category list buckets nowhere and the page
// vanishes from the index with no other signal — catch the typo here.
const badCategories = guideDirs.flatMap(({ dir, label, categories }) =>
  readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .flatMap(file => {
      const fm = parseFrontmatter(readFileSync(join(dir, file), 'utf8'))
      return fm.guide_category && !categories.includes(fm.guide_category)
        ? [{ file: `${label}/${file}`, cat: fm.guide_category, categories }]
        : []
    }),
)
if (badCategories.length) {
  for (const { file, cat, categories } of badCategories) {
    console.error(
      `${file}: unknown guide_category "${cat}" — expected one of: ${categories.join(', ')}`,
    )
  }
  console.error(
    `\nFix the guide_category so these pages appear in the guide indexes.`,
  )
  process.exit(1)
}

const staleHint = 'run: pnpm lint-docs'
checkOrWrite({
  path: join(docsDir, 'user_guide.md'),
  content: buildUserGuide(),
  label: 'user_guide.md',
  staleHint,
})
checkOrWrite({
  path: join(docsDir, 'config_guide.md'),
  content: buildConfigGuide(),
  label: 'config_guide.md',
  staleHint,
})
checkOrWrite({
  path: join(docsDir, 'developer_guide.md'),
  content: buildDeveloperGuide(),
  label: 'developer_guide.md',
  staleHint,
})
