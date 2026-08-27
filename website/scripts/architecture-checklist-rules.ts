// ARCHITECTURE.md's "What not to do" is the index of its own rules, and it says
// so: "Every entry is stated flat and argued elsewhere, either in a section
// above or in the linked reference doc." That was prose, so it drifted — the
// `effectiveBodyMounted` entry carried six lines of reasoning, linked nothing,
// and named a term that appeared nowhere else in `agent-docs/`. A reader who
// hit it had nowhere to go, and nothing said so.
//
// These are that sentence as rules, plus the completeness half beside it ("a
// rule stated anywhere above gets a line here"). They cannot judge whether an
// argument is *good*; they hold what makes both halves checkable at all: every
// entry names a destination, every destination exists, and every section is
// either indexed or declared to carry no rule. The second is what stops the
// first being satisfiable with a dead link — the cheapest way to pass a rule
// like this is to point at a section a rename took away.
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

// The other half of the same sentence: "a rule stated anywhere above gets a
// line here, so scanning this section is scanning the spec." A section the
// checklist never points at is either descriptive or a rule with no line, and
// nothing distinguished the two — so three real rules sat unindexed while the
// doc claimed to be complete.
//
// The fix is check-reference-citations' one: the doc says which kind it is
// rather than the check inferring it from an absence. A section is linked from
// the checklist, or it is named here with the reason it carries no rule. Adding
// a section makes the run fail until someone answers that, and answering it is
// one line either way.
//
// Keyed by heading slug so a rename fails loudly rather than silently exempting
// a new section that happens to reuse a title.
export const STATES_NO_RULES: Record<string, string> = {
  tldr: 'the mental model in eight bullets; every rule it touches is indexed from the section that argues it',
  overview: 'the pipeline in one figure and one paragraph',
  vocabulary: 'definitions',
  'display-stacks':
    'which mixins exist and what composes them, off two generated tables; its one ordering rule is indexed',
  'data-fetching-pipeline':
    'the autorun table and what installs it; the rules are in the subsections below it',
  'one-latest-wins-machine-one-phase-contract-one-skeleton':
    'what the shared skeleton is made of. What a NEW installer owes is the trigger list, which is indexed',
}

export interface ArchitectureDocInput {
  doc: string
  /** Resolves a relative link target to that file's text, or undefined if absent. */
  readLink: (path: string) => string | undefined
  /** The real doc's exemptions by default; a test hands its own fixture's. */
  statesNoRules?: Record<string, string>
}

/** Every `##`/`###` heading before the checklist — the body it claims to index. */
export function bodyHeadings(doc: string) {
  const end = doc.indexOf(CHECKLIST)
  return [
    ...doc
      .slice(0, end === -1 ? doc.length : end)
      .matchAll(/^#{2,3}\s+(.*)$/gm),
  ].map(m => m[1]!.trim())
}

export function checkArchitectureDoc({
  doc,
  readLink,
  statesNoRules = STATES_NO_RULES,
}: ArchitectureDocInput) {
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

  const indexed = new Set(
    entries.flatMap(entry =>
      [...entry.matchAll(/]\(#([^)]+)\)/g)].map(m => m[1]!),
    ),
  )
  for (const heading of bodyHeadings(doc)) {
    const key = slug(heading)
    if (!indexed.has(key) && !(key in statesNoRules)) {
      problems.push(
        `agent-docs/ARCHITECTURE.md: no "What not to do" entry links "${heading}" (#${key}).
  That section either states a rule the checklist is missing — it claims to index every one — or it states none. Add the entry, or add "${key}" to STATES_NO_RULES in website/scripts/architecture-checklist-rules.ts with the reason it carries no rule.`,
      )
    }
  }
  for (const key of Object.keys(statesNoRules)) {
    if (indexed.has(key)) {
      problems.push(
        `agent-docs/ARCHITECTURE.md: "#${key}" is in STATES_NO_RULES and a "What not to do" entry links it. Drop the exemption — the section grew a rule.`,
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
