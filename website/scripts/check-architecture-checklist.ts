// ARCHITECTURE.md's "What not to do" is the index of its own rules, and it says
// so: "Every entry is stated flat and argued elsewhere, either in a section
// above or in the linked reference doc." That was prose, so it drifted — the
// `effectiveBodyMounted` entry carried six lines of reasoning, linked nothing,
// and named a term that appeared nowhere else in `agent-docs/`. A reader who
// hit it had nowhere to go, and nothing said so.
//
// This is that sentence as a gate. It cannot judge whether an argument is
// *good*; it holds the two things that make "argued elsewhere" checkable at
// all: every entry names a destination, and every destination exists.
//
//   1. Every bullet under "What not to do" contains at least one link.
//   2. Every in-doc anchor resolves to a heading in ARCHITECTURE.md.
//   3. Every relative link resolves to a file, and its `#anchor` (if any) to a
//      heading in that file.
//
// (2) and (3) are what stop (1) being satisfiable with a dead link — the
// cheapest way to pass a rule like this is to point at a section that a rename
// took away.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

import { reportProblems } from './check-utils.ts'
import { repoRoot } from './paths.ts'

const archPath = join(repoRoot, 'agent-docs', 'ARCHITECTURE.md')
const CHECKLIST = '## What not to do'

// GitHub's heading slug: lowercase, drop everything that is not a word
// character, space or hyphen, then spaces to hyphens. Consecutive spaces stay
// consecutive hyphens, which is why an em dash in a heading yields `--`.
function slug(heading: string) {
  return heading
    .toLowerCase()
    .replaceAll('`', '')
    .replaceAll(/[^\w\s-]/g, '')
    .trim()
    .replaceAll(/\s/g, '-')
}

function headingSlugs(markdown: string) {
  return new Set(
    [...markdown.matchAll(/^#{1,6}\s+(.*)$/gm)].map(m => slug(m[1]!.trim())),
  )
}

const arch = readFileSync(archPath, 'utf8')
const problems: string[] = []

const checklistStart = arch.indexOf(CHECKLIST)
if (checklistStart === -1) {
  reportProblems(
    [
      `agent-docs/ARCHITECTURE.md has no "${CHECKLIST}" section. It is the index of the doc's own rules; if it was renamed, rename it here too.`,
    ],
    '',
  )
}
const seeAlso = arch.indexOf('\n## See also', checklistStart)
const checklist = arch.slice(
  checklistStart,
  seeAlso === -1 ? arch.length : seeAlso,
)

// Entries are top-level bullets. A continuation line is indented, so splitting
// on a newline followed by "- " takes each entry whole.
const entries = checklist.split(/\n- /).slice(1)
for (const entry of entries) {
  const body = entry.split('\n###')[0]!
  if (!body.includes('](')) {
    const first = body.split('\n')[0]!.trim()
    problems.push(
      `agent-docs/ARCHITECTURE.md, "What not to do": this entry links nothing, so a reader who needs the argument has nowhere to go:
    ${first}
  Add a "See [...]" to the section above that argues it, or to the reference doc that does. An entry with no such home is a section that has not been written — see the note at the top of that section.`,
    )
  }
}

const archSlugs = headingSlugs(arch)
const otherDocSlugs = new Map<string, Set<string>>()

for (const match of arch.matchAll(/]\(([^)\s]+)\)/g)) {
  const target = match[1]!
  if (target.startsWith('http') || target.startsWith('mailto:')) {
    continue
  }
  const [path, anchor] = target.split('#') as [string, string | undefined]

  if (path === '') {
    if (anchor && !archSlugs.has(anchor)) {
      problems.push(
        `agent-docs/ARCHITECTURE.md links "#${anchor}", which is not a heading in it. A section was renamed and this link was left behind.`,
      )
    }
    continue
  }

  const resolved = join(dirname(archPath), path)
  if (!existsSync(resolved)) {
    problems.push(
      `agent-docs/ARCHITECTURE.md links "${path}", which does not exist.`,
    )
    continue
  }
  if (!anchor || !resolved.endsWith('.md')) {
    continue
  }
  let slugs = otherDocSlugs.get(resolved)
  if (!slugs) {
    slugs = headingSlugs(readFileSync(resolved, 'utf8'))
    otherDocSlugs.set(resolved, slugs)
  }
  if (!slugs.has(anchor)) {
    problems.push(
      `agent-docs/ARCHITECTURE.md links "${relative(repoRoot, resolved)}#${anchor}", which is not a heading in that file.`,
    )
  }
}

// One broken anchor is usually linked from several entries, and repeating the
// same line per site buries the other failures.
reportProblems(
  [...new Set(problems)],
  `${entries.length} "What not to do" entries all name a destination, and every link in ARCHITECTURE.md resolves`,
)
