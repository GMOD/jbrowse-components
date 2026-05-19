import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const docsDir = join(import.meta.dirname, '..', 'docs')
const indexPath = join(docsDir, 'user_guide.md')

const CATEGORY_ORDER = [
  'General usage',
  'Track types',
  'Views',
  'Other features',
  'Tutorials',
]

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
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':')
    if (colon !== -1) {
      result[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
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

function buildIndex(): string {
  const allEntries = new Map<string, Entry[]>()

  for (const [cat, entries] of collectEntries(
    join(docsDir, 'user_guides'),
    'user_guides',
  )) {
    allEntries.set(cat, [...(allEntries.get(cat) ?? []), ...entries])
  }
  for (const [cat, entries] of collectEntries(
    join(docsDir, 'tutorials'),
    'tutorials',
  )) {
    allEntries.set(cat, [...(allEntries.get(cat) ?? []), ...entries])
  }

  const lines: string[] = [
    '---',
    'id: user_guide',
    'toplevel: true',
    'title: Introduction - User guide',
    '---',
    '',
  ]

  for (const cat of CATEGORY_ORDER) {
    const entries = allEntries.get(cat)
    if (!entries?.length) {
      continue
    }
    lines.push(`## ${cat}`, '')
    for (const e of entries) {
      lines.push(`- [${e.title}](/docs/${e.dir}/${e.slug}) - ${e.description}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

const generated = buildIndex()

const check = process.argv.includes('--check')
if (check) {
  const current = readFileSync(indexPath, 'utf8')
  if (current !== generated) {
    console.error('user_guide.md is out of date — run: pnpm lint-docs')
    process.exit(1)
  }
  console.log('user_guide.md is up to date')
} else {
  writeFileSync(indexPath, generated)
  console.log('user_guide.md regenerated')
}
