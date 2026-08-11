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

import {
  checkOrWrite,
  markdownTable,
  parseFrontmatter,
  spliceGeneratedBlock,
} from './check-utils.ts'
import { repoRoot } from './paths.ts'

const referenceDir = join(repoRoot, 'agent-docs', 'reference')
const indexPath = join(referenceDir, 'README.md')

// The index is the one file in here that isn't a subsystem writeup, so it does
// not list itself.
const SELF = 'README.md'

interface Doc {
  file: string
  name: string
  description: string
}

function collectReferenceDocs(): Doc[] {
  const docs: Doc[] = []
  const missing: string[] = []
  for (const file of readdirSync(referenceDir)) {
    if (!file.endsWith('.md') || file === SELF) {
      continue
    }
    // `description` is prose and routinely wraps across lines in these files;
    // parseFrontmatter re-flows a wrapped value onto one line for the cell.
    const fm = parseFrontmatter(readFileSync(join(referenceDir, file), 'utf8'))
    if (!fm) {
      throw new Error(
        `agent-docs/reference/${file}: no frontmatter. Every doc here needs \`name:\` and \`description:\` — without them it is invisible to anyone scanning the directory (see agent-docs/CLAUDE.md)`,
      )
    }
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

checkOrWrite({
  path: indexPath,
  content: spliceGeneratedBlock({
    path: indexPath,
    marker: 'REFERENCE INDEX',
    body: markdownTable(
      ['Doc', 'Read when'],
      collectReferenceDocs().map(
        d => `| [${d.name}](${d.file}) | ${d.description} |`,
      ),
    ),
  }),
  label: 'Reference index',
  staleHint: 'run `pnpm autogen`',
})
