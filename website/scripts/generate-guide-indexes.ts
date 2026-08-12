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
import { checkOrWriteAll, parseFrontmatter } from './check-utils.ts'
import { docsDir } from './paths.ts'

interface Page {
  file: string
  slug: string
  title: string
  fm: Record<string, string>
}

// Every `.md` page in a directory with its frontmatter, read once. Each guide
// dir used to be walked three separate times — validate the frontmatter,
// validate the category, then build the index — re-reading and re-parsing every
// page on each pass, with the "is this a .md" and "strip the extension" rules
// spelled out in each.
//
// A page with no frontmatter gets an empty map rather than being dropped: every
// caller here reports its own "missing X" and would rather see the page than
// silently not know about it.
function pagesIn(dir: string): Page[] {
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(file => {
      const slug = file.replace(/\.md$/, '')
      const fm = parseFrontmatter(readFileSync(join(dir, file), 'utf8')) ?? {}
      return { file, slug, title: fm.title ?? slug, fm }
    })
}

interface Guide {
  // Where the pages live, and the path segment their URLs carry — the same
  // string for every guide dir, but `guideRank` keys on the URL form.
  urlDir: string
  categories: readonly string[]
  pages: Page[]
}

function guide(urlDir: string, categories: readonly string[]): Guide {
  return { urlDir, categories, pages: pagesIn(join(docsDir, urlDir)) }
}

const userGuides = guide('user_guides', USER_CATEGORIES)
const configGuides = guide('config_guides', CONFIG_CATEGORIES)
const developerGuides = guide('developer_guides', DEVELOPER_CATEGORIES)

function buildTocSection(
  { urlDir, categories, pages }: Guide,
  headingLevel = '##',
): string[] {
  const lines: string[] = []
  for (const cat of categories) {
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
    const entries = pages
      .filter(p => p.fm.guide_category === cat)
      .sort(
        (a, b) =>
          guideRank(urlDir, a.slug) - guideRank(urlDir, b.slug) ||
          a.title.localeCompare(b.title),
      )
    if (!entries.length) {
      continue
    }
    lines.push(`${headingLevel} ${cat}`, '')
    for (const e of entries) {
      lines.push(`- [](/docs/${urlDir}/${e.slug})`)
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
  const entries = pagesIn(dir)
    .filter(({ fm }) => fm.guide_category === 'Tutorials')
    .map(({ slug, title, fm }) => ({
      slug,
      title,
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
    // tutorials/ is deliberately not part of this guide: its pages all share one
    // `guide_category` and get their own subgrouped section below.
    ...buildTocSection(userGuides),
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
    ...buildTocSection(configGuides),
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

  const toc = buildTocSection(developerGuides, '###')

  return preamble + ['## Developer guides', '', ...toc].join('\n')
}

// A page that fails either check is invisible in the index with no other
// signal — a missing field drops it silently, and a `guide_category` outside its
// guide's list buckets nowhere and does the same. Both are reported per page,
// across all three guides, so one run names every page to fix rather than the
// first.
//
// tutorials/ is excluded: it's a mixed-use directory (user + developer
// tutorials) managed explicitly in sidebars.json rather than auto-indexed.
function frontmatterProblems({ urlDir, categories, pages }: Guide) {
  return pages.flatMap(({ file, fm }) => {
    const where = `${urlDir}/${file}`
    const missing = ['description', 'guide_category'].filter(k => !fm[k])
    return [
      ...(missing.length
        ? [`${where}: missing frontmatter fields: ${missing.join(', ')}`]
        : []),
      ...(fm.guide_category && !categories.includes(fm.guide_category)
        ? [
            `${where}: unknown guide_category "${fm.guide_category}" — expected one of: ${categories.join(', ')}`,
          ]
        : []),
    ]
  })
}

const problems = [userGuides, configGuides, developerGuides].flatMap(
  frontmatterProblems,
)
if (problems.length) {
  console.error(problems.join('\n'))
  console.error(
    '\nFix the frontmatter so these pages appear in the guide indexes.',
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

const guides = [
  { file: 'user_guide.md', content: buildUserGuide() },
  { file: 'config_guide.md', content: buildConfigGuide() },
  { file: 'developer_guide.md', content: buildDeveloperGuide() },
]
for (const { file, content } of guides) {
  assertScalarContinuations(content, file)
}
// All three at once, so a stale user_guide.md doesn't hide a stale
// developer_guide.md behind it.
checkOrWriteAll(
  guides.map(({ file, content }) => ({
    path: join(docsDir, file),
    content,
    label: file,
  })),
  'run `pnpm autogen`',
)
