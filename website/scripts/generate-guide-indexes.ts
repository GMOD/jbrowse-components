import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// The category order (and thus the allowed `guide_category` values) for each
// guide index, shared with the sidebar builder so the two groupings can't
// drift. A page tagged with a category not in its guide's list is silently
// dropped from every index, so these double as the validation allow-lists below.
import {
  CONFIG_CATEGORIES,
  DEVELOPER_CATEGORIES,
  TUTORIAL_CATEGORIES,
  TUTORIAL_FALLBACK,
  TUTORIAL_ORDER,
  USER_CATEGORIES,
  guideRank,
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
    // Curated lead pages first (the ones the sidebar lifts), then alphabetical
    // — the same two keys docs-sidebar.ts sorts a category by, so a page has
    // the same neighbors here as it does in the nav. This used to be readdir
    // order, i.e. filename order, which is not the order a reader sees: the
    // list renders titles, so slot_types.md ("Config slot types") sorted under
    // S and file_types.md ("Supported file types") under F, leaving both
    // surfaces sorted differently and neither matching its own labels. Sorting
    // on `title` rather than the sidebar's `sidebar_label ?? title` is
    // deliberate: each list is ordered by the string it actually displays, so
    // each reads as sorted to its own reader. The two diverge only for the
    // three developer guides whose labels differ from their titles.
    const entries = allEntries
      .get(cat)
      ?.sort(
        (a, b) =>
          guideRank(a.dir, a.slug) - guideRank(b.dir, b.slug) ||
          a.title.localeCompare(b.title),
      )
    if (!entries?.length) {
      continue
    }
    lines.push(`${headingLevel} ${cat}`, '')
    for (const e of entries) {
      lines.push(`- [](/docs/${e.dir}/${e.slug})`)
    }
    lines.push('')
  }
  return lines
}

// Tutorials carry one more level of grouping than the guide dirs: they all
// declare `guide_category: Tutorials`, so a flat list of them buries 20+ pages
// under one heading. Split them by `tutorial_category` instead, reusing the
// order the tutorials landing page uses so the two groupings of the same pages
// match. (The landing page is what fails the build on an unknown category; here
// an unrecognized one just falls into the trailing bucket.)
function buildTutorialSection(): string[] {
  const dir = join(docsDir, 'tutorials')
  const rank = (slug: string) => {
    const i = TUTORIAL_ORDER.indexOf(slug)
    return i === -1 ? TUTORIAL_ORDER.length : i
  }
  const entries = readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(file => ({
      slug: file.replace(/\.md$/, ''),
      fm: parseFrontmatter(readFileSync(join(dir, file), 'utf8')),
    }))
    .filter(({ fm }) => fm.guide_category === 'Tutorials')
    .map(({ slug, fm }) => ({
      slug,
      title: fm.title ?? slug,
      category: TUTORIAL_CATEGORIES.includes(fm.tutorial_category ?? '')
        ? fm.tutorial_category!
        : TUTORIAL_FALLBACK,
    }))
    .sort(
      (a, b) => rank(a.slug) - rank(b.slug) || a.title.localeCompare(b.title),
    )

  const lines: string[] = []
  for (const category of [...TUTORIAL_CATEGORIES, TUTORIAL_FALLBACK]) {
    const inCategory = entries.filter(e => e.category === category)
    if (inCategory.length) {
      lines.push(`### ${category}`, '')
      for (const e of inCategory) {
        lines.push(`- [](/docs/tutorials/${e.slug})`)
      }
      lines.push('')
    }
  }
  return lines.length ? ['## Tutorials', '', ...lines] : []
}

function buildUserGuide(): string {
  const lines: string[] = [
    '---',
    'title: User guide',
    'sidebar_label: Overview',
    'description:',
    '  Index of the guides for driving JBrowse, covering track types, views, and the',
    '  rest of the app.',
    '---',
    '',
    'How to drive JBrowse once it is running. New here? Start with the',
    '[JBrowse Web](/docs/quickstart_web) or',
    '[JBrowse Desktop](/docs/quickstart_desktop) quickstart.',
    '',
    // tutorials/ is deliberately not passed here: its pages all share one
    // `guide_category` and get their own subgrouped section below.
    ...buildTocSection(USER_CATEGORIES, [
      { dir: join(docsDir, 'user_guides'), urlDir: 'user_guides' },
    ]),
    ...buildTutorialSection(),
  ]
  return lines.join('\n')
}

function buildConfigGuide(): string {
  const lines: string[] = [
    '---',
    'title: Config guide',
    'sidebar_label: Overview',
    'description:',
    '  Index of the guides for writing config.json, covering assemblies, tracks,',
    '  callbacks, and deployment.',
    '---',
    '',
    'How to configure the `config.json` that drives a session. For copy-paste',
    'recipes, see the [](/docs/cookbook).',
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
description:
  How JBrowse 2 is packaged and structured, and how to write plugins and
  pluggable elements.
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
by anyone, not just the JBrowse core team. Most products load plugins at
runtime, though it isn't required.

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

// These frontmatter blocks are assembled line by line rather than serialized, so
// a `description` is a plain multi-line YAML scalar. An indented continuation
// line containing `: ` parses as an implicit mapping key instead of text, which
// surfaces only as a broken docs build far from here. A blanket punctuation
// rewrite over this file once shipped exactly that, so fail loudly at
// generation time rather than trusting a comment to be read.
function assertScalarContinuations(content: string, label: string) {
  const block = /^---\n([\s\S]*?)\n---/.exec(content)?.[1]
  if (block === undefined) {
    throw new Error(`${label}: generated content has no frontmatter block`)
  } else {
    for (const line of block.split('\n')) {
      if (/^\s+/.test(line) && line.includes(': ')) {
        throw new Error(
          `${label}: frontmatter continuation line contains ": ", which YAML reads as a mapping key rather than text. Reword it: ${line.trim()}`,
        )
      }
    }
  }
}

const staleHint = 'run `pnpm autogen`'
const guides = [
  { file: 'user_guide.md', content: buildUserGuide() },
  { file: 'config_guide.md', content: buildConfigGuide() },
  { file: 'developer_guide.md', content: buildDeveloperGuide() },
]
for (const { file, content } of guides) {
  assertScalarContinuations(content, file)
  checkOrWrite({ path: join(docsDir, file), content, label: file, staleHint })
}
