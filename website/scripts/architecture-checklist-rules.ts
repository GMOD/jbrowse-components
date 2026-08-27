// ARCHITECTURE.md's "What not to do" is the index of its own rules, and it says
// so: "Every entry is stated flat and argued elsewhere, either in a section
// above or in the linked reference doc." That was prose, so it drifted — the
// `effectiveBodyMounted` entry carried six lines of reasoning, linked nothing,
// and named a term that appeared nowhere else in `agent-docs/`. A reader who
// hit it had nowhere to go, and nothing said so.
//
// These are that sentence as rules. They cannot judge whether an argument is
// *good*; they hold the two things that make "argued elsewhere" checkable at
// all: every entry names a destination, and every destination exists. The
// second is what stops the first being satisfiable with a dead link — the
// cheapest way to pass a rule like this is to point at a section a rename took
// away.
//
// Separate from the CLI so `architectureChecklist.test.ts` can sabotage a doc
// without one on disk.

const CHECKLIST = '## What not to do'

/**
 * GitHub's heading slug: lowercase, drop everything that is not a word
 * character, space or hyphen, then spaces to hyphens. Consecutive spaces stay
 * consecutive hyphens, which is why an em dash inside a heading yields `--`.
 */
export function slug(heading: string) {
  return heading
    .toLowerCase()
    .replaceAll('`', '')
    .replaceAll(/[^\w\s-]/g, '')
    .trim()
    .replaceAll(/\s/g, '-')
}

export function headingSlugs(markdown: string) {
  return new Set(
    [...markdown.matchAll(/^#{1,6}\s+(.*)$/gm)].map(m => slug(m[1]!.trim())),
  )
}

/** Top-level bullets. A continuation line is indented, so this takes each whole. */
export function checklistEntries(doc: string) {
  const start = doc.indexOf(CHECKLIST)
  if (start === -1) {
    return undefined
  }
  const end = doc.indexOf('\n## ', start + CHECKLIST.length)
  const section = doc.slice(start, end === -1 ? doc.length : end)
  return section
    .split(/\n- /)
    .slice(1)
    .map(entry => entry.split('\n###')[0]!)
}

export interface ArchitectureDocInput {
  doc: string
  /** Resolves a relative link target to that file's text, or undefined if absent. */
  readLink: (path: string) => string | undefined
}

export function checkArchitectureDoc({ doc, readLink }: ArchitectureDocInput) {
  const problems: string[] = []
  const entries = checklistEntries(doc)

  if (!entries) {
    return {
      entryCount: 0,
      problems: [
        `agent-docs/ARCHITECTURE.md has no "${CHECKLIST}" section. It is the index of the doc's own rules; if it was renamed, rename it here too.`,
      ],
    }
  }

  for (const entry of entries) {
    if (!entry.includes('](')) {
      problems.push(
        `agent-docs/ARCHITECTURE.md, "What not to do": this entry links nothing, so a reader who needs the argument has nowhere to go:
    ${entry.split('\n')[0]!.trim()}
  Add a "See [...]" to the section above that argues it, or to the reference doc that does. An entry with no such home is a section that has not been written — see the note at the top of that section.`,
      )
    }
  }

  const own = headingSlugs(doc)
  const linked = new Map<string, Set<string> | undefined>()

  for (const match of doc.matchAll(/]\(([^)\s]+)\)/g)) {
    const target = match[1]!
    if (target.startsWith('http') || target.startsWith('mailto:')) {
      continue
    }
    const [path, anchor] = target.split('#') as [string, string | undefined]

    if (path === '') {
      if (anchor && !own.has(anchor)) {
        problems.push(
          `agent-docs/ARCHITECTURE.md links "#${anchor}", which is not a heading in it. A section was renamed and this link was left behind.`,
        )
      }
      continue
    }

    if (!linked.has(path)) {
      const text = readLink(path)
      linked.set(path, text === undefined ? undefined : headingSlugs(text))
    }
    const slugs = linked.get(path)
    if (slugs === undefined) {
      problems.push(
        `agent-docs/ARCHITECTURE.md links "${path}", which does not exist.`,
      )
    } else if (anchor && path.endsWith('.md') && !slugs.has(anchor)) {
      problems.push(
        `agent-docs/ARCHITECTURE.md links "${path}#${anchor}", which is not a heading in that file.`,
      )
    }
  }

  // One broken anchor is usually linked from several entries, and repeating the
  // same line per site buries the other failures.
  return { entryCount: entries.length, problems: [...new Set(problems)] }
}
