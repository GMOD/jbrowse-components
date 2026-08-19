// Generates the index of each agent-docs directory that is a flat pile of docs
// — `reference/` and `ideas/` — from the docs' own frontmatter, so a directory
// can be scanned in one read instead of fifty.
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
// ADRs are numbered; these have no such order, and any grouping would be a
// hand-maintained judgement — the exact thing this is replacing. Alphabetical
// matches what `ls` shows.
//
// `ideas/` joined in 2026-08 when OTHER_IDEAS.md was exploded into one file per
// proposal. Its hand-maintained 104-line index was the very shape agent-docs
// /CLAUDE.md warns about ("a list some author transcribed once and no one
// re-derived"), and generating it was the point of the split as much as the
// per-idea files were.
//
// Only the block between the markers is generated; the prose above it is
// hand-maintained. Run: `pnpm autogen` (or `--check` in CI).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  checkOrWrite,
  markdownTableLines,
  parseFrontmatter,
  spliceGeneratedBlock,
} from './check-utils.ts'
import { repoRoot } from './paths.ts'

// The index is the one file in each of these directories that isn't a doc in
// its own right, so it does not list itself.
const SELF = 'README.md'

const INDEXES = [
  {
    dir: 'reference',
    marker: 'REFERENCE INDEX',
    label: 'Reference index',
    heading: 'Read when',
  },
  {
    dir: 'ideas',
    marker: 'IDEAS INDEX',
    label: 'Ideas index',
    // Not "Read when": these are proposals to pick up, and the description is
    // written as the hook you pick one up by.
    heading: 'What it covers',
  },
  {
    // `handoffs/` was the one directory here you had to `ls`, which is the
    // state agent-docs/CLAUDE.md tells everyone else not to be in. It is also
    // the directory that most needs the discipline: a handoff's subject is
    // still moving, so it goes stale faster than anything in reference/, and
    // seven of the eight that existed on 2026-08-19 closed in a day.
    dir: 'handoffs',
    marker: 'HANDOFFS INDEX',
    label: 'Handoffs index',
    heading: 'What it is waiting on',
  },
]

interface Doc {
  file: string
  name: string
  description: string
}

function collectDocs(dir: string): Doc[] {
  const docsDir = join(repoRoot, 'agent-docs', dir)
  const docs: Doc[] = []
  const missing: string[] = []
  for (const file of readdirSync(docsDir)) {
    if (!file.endsWith('.md') || file === SELF) {
      continue
    }
    // `description` is prose and routinely wraps across lines in these files;
    // parseFrontmatter re-flows a wrapped value onto one line for the cell.
    const fm = parseFrontmatter(readFileSync(join(docsDir, file), 'utf8'))
    if (!fm) {
      throw new Error(
        `agent-docs/${dir}/${file}: no frontmatter. Every doc here needs \`name:\` and \`description:\` — without them it is invisible to anyone scanning the directory (see agent-docs/CLAUDE.md)`,
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
      `${missing.length} doc(s) in agent-docs/${dir}/ missing frontmatter, so they would be absent from the index and invisible to a directory scan:\n${missing
        .map(m => `  ${m}`)
        .join('\n')}`,
    )
  }
  return docs.sort((a, b) => a.file.localeCompare(b.file))
}

for (const { dir, marker, label, heading } of INDEXES) {
  const indexPath = join(repoRoot, 'agent-docs', dir, SELF)
  checkOrWrite({
    path: indexPath,
    content: spliceGeneratedBlock({
      path: indexPath,
      marker,
      body: markdownTableLines(
        ['Doc', heading],
        collectDocs(dir).map(
          d => `| [${d.name}](${d.file}) | ${d.description} |`,
        ),
      ),
    }),
    label,
    staleHint: 'run `pnpm autogen`',
  })
}
