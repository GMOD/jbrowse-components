// Generates the index of `agent-docs/reference/` from the docs' own frontmatter,
// so the directory can be scanned in one read instead of thirty-six.
//
// agent-docs/CLAUDE.md already makes the rule: every doc outside
// architecture-decision-records/ carries `name:` / `description:` frontmatter,
// and "`ls` a directory and read the descriptions — that is how you find the
// right doc without opening all of them, so a new doc without one is
// invisible." That was a convention nothing enforced, and following it required
// opening every file to read one line out of each. This does both jobs: it
// renders the descriptions into one page, and it fails when a doc is missing
// the frontmatter that would put it there.
//
// It deliberately does NOT rank or group. The ADR index sorts by number because
// ADRs are numbered; reference docs have no such order, and any grouping would
// be a hand-maintained judgement — the exact thing this is replacing. Alphabetical
// matches what `ls` shows.
//
// Only the block between the markers is generated; the prose above it is
// hand-maintained. Run: `pnpm autogen` (or `--check` in CI).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { checkOrWrite } from './check-utils.ts'

const referenceDir = join(
  import.meta.dirname,
  '..',
  '..',
  'agent-docs',
  'reference',
)
const indexPath = join(referenceDir, 'README.md')

const BEGIN = '<!-- BEGIN GENERATED REFERENCE INDEX -->'
const END = '<!-- END GENERATED REFERENCE INDEX -->'

// The index is the one file in here that isn't a subsystem writeup, so it does
// not list itself.
const SELF = 'README.md'

interface Doc {
  file: string
  name: string
  description: string
}

// `description` is prose and routinely wraps across lines in these files, so a
// line-oriented read would truncate most of them at the first newline. Values
// run to the next `key:` line or the end of the block, and are re-flowed to one
// line for the table cell.
function parseFrontmatter(content: string, file: string) {
  const match = /^---\n([\s\S]*?)\n---/.exec(content)
  if (!match) {
    throw new Error(
      `agent-docs/reference/${file}: no frontmatter. Every doc here needs \`name:\` and \`description:\` — without them it is invisible to anyone scanning the directory (see agent-docs/CLAUDE.md)`,
    )
  }
  const result: Record<string, string> = {}
  let key: string | undefined
  for (const line of match[1]!.split('\n')) {
    const keyMatch = /^([A-Za-z_][\w-]*):(.*)$/.exec(line)
    if (keyMatch) {
      key = keyMatch[1]!
      result[key] = keyMatch[2]!.trim()
    } else if (key && line.trim()) {
      result[key] += ` ${line.trim()}`
    }
  }
  return result
}

export function collectReferenceDocs(): Doc[] {
  const docs: Doc[] = []
  const missing: string[] = []
  for (const file of readdirSync(referenceDir)) {
    if (!file.endsWith('.md') || file === SELF) {
      continue
    }
    const fm = parseFrontmatter(
      readFileSync(join(referenceDir, file), 'utf8'),
      file,
    )
    const name = fm.name?.trim()
    const description = fm.description?.trim().replaceAll(/\s+/g, ' ')
    if (!name || !description) {
      missing.push(`${file} (needs ${!name ? 'name' : 'description'})`)
    } else {
      docs.push({ file, name, description })
    }
  }
  if (missing.length) {
    throw new Error(
      `${missing.length} reference doc(s) missing frontmatter, so they would be absent from the index and invisible to a directory scan:\n${missing
        .map(m => `  ${m}`)
        .join('\n')}`,
    )
  }
  return docs.sort((a, b) => a.file.localeCompare(b.file))
}

function buildIndex() {
  const docs = collectReferenceDocs()
  const existing = readFileSync(indexPath, 'utf8')
  const begin = existing.indexOf(BEGIN)
  const end = existing.indexOf(END)
  if (begin === -1 || end === -1) {
    throw new Error(`${indexPath}: missing ${BEGIN} / ${END} markers`)
  }
  const table = [
    BEGIN,
    '',
    '| Doc | Read when |',
    '| --- | --- |',
    ...docs.map(d => `| [${d.name}](${d.file}) | ${d.description} |`),
    '',
  ].join('\n')
  return existing.slice(0, begin) + table + existing.slice(end)
}

checkOrWrite({
  path: indexPath,
  content: buildIndex(),
  label: 'Reference index',
  staleHint: 'run `pnpm autogen`',
})
