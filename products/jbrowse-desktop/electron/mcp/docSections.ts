import { TOC_ABOVE_CHARS } from './docLimits.ts'

import type { BridgeToolResult } from './stdioServer.ts'

interface DocSection {
  level: number
  heading: string
  text: string
}

export function splitSections(markdown: string) {
  const sections: DocSection[] = []
  let current: DocSection = { level: 0, heading: '', text: '' }
  let inFence = false
  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
    }
    const heading = inFence ? null : /^(#{1,3})\s+(.+?)\s*$/.exec(line)
    if (heading) {
      sections.push(current)
      current = { level: heading[1]!.length, heading: heading[2]!, text: '' }
    }
    current.text += `${line}\n`
  }
  sections.push(current)
  return sections
}

// A section runs until the next heading of its own level or shallower, so
// asking for "Session spec" brings its view-type subsections along.
function endOfSection(sections: DocSection[], index: number) {
  const { level } = sections[index]!
  let end = index + 1
  while (end < sections.length && sections[end]!.level > level) {
    end += 1
  }
  return end
}

function sectionWithChildren(sections: DocSection[], index: number) {
  return sections
    .slice(index, endOfSection(sections, index))
    .map(s => s.text)
    .join('')
}

// A heading is prose ("Linear genome view") and an agent asks for the type name
// ("LinearGenomeView"), so both sides collapse to lowercase alphanumerics.
function normalized(text: string) {
  return text.toLowerCase().replaceAll(/[^a-z0-9]/g, '')
}

function findSection(sections: DocSection[], heading: string) {
  const wanted = normalized(heading)
  const exact = sections.findIndex(s => normalized(s.heading) === wanted)
  if (exact !== -1) {
    return exact
  }
  // the loose pass keeps the separators: stripping them for a substring test
  // joins words and matches across them, so "Views" landed inside "Linear
  // genome view (simple)" rather than on "Tiled views / Workspaces"
  const loose = heading.trim().toLowerCase()
  return sections.findIndex(s => s.heading.toLowerCase().includes(loose))
}

// A generated type page lists each member as one bullet opening with its name
// in backticks — `rowHeight: number`, `setColor(color) => void`,
// `index.indexType: stringEnum (BAI, CSI)` — under Actions, Getters, Methods,
// Properties or Slots.
const MEMBER_BULLET = /^\s*-\s+`([^`(:\s]+)/

function memberName(line: string) {
  return MEMBER_BULLET.exec(line)?.[1]
}

/**
 * Every member bullet in the document, with the heading it sits under.
 *
 * An agent that already has the name — off `jb.inspect`, a search hit or a
 * config — asks for it as `section`, which names no heading. That answered with
 * an error whose only offer was the section holding it, and on
 * LinearAlignmentsDisplay the getter list is 48 KB. One bullet is 60
 * characters, so the name it asked with is the cheapest route the page has and
 * it was the one route that failed.
 */
function members(sections: DocSection[]) {
  return sections.flatMap(({ heading, text }) =>
    text
      .split('\n')
      .map(line => ({ heading, line, name: memberName(line) }))
      .filter((m): m is { heading: string; line: string; name: string } =>
        Boolean(m.name),
      ),
  )
}

function findMembers(sections: DocSection[], name: string) {
  const wanted = normalized(name)
  return members(sections).filter(m => normalized(m.name) === wanted)
}

function withoutSections(markdown: string, omit: readonly string[]) {
  const sections = splitSections(markdown)
  const dropped = new Set<number>()
  for (const heading of omit) {
    const index = findSection(sections, heading)
    if (index !== -1) {
      for (let i = index; i < endOfSection(sections, index); i++) {
        dropped.add(i)
      }
    }
  }
  return sections
    .filter((_section, i) => !dropped.has(i))
    .map(s => s.text)
    .join('')
}

// each entry carries the size of the section with its children, so an agent
// can weigh a 40 KB getter list against a 13 KB action list before asking
function tableOfContents(sections: DocSection[], from = 0) {
  const headed = sections
    .map((s, index) => ({ ...s, index }))
    .filter(s => s.level > 0 && s.index >= from)
  const top = Math.min(...headed.map(s => s.level))
  return headed
    .map(
      s =>
        `${'  '.repeat(s.level - top)}- ${s.heading} (${sectionWithChildren(sections, s.index).length} chars)`,
    )
    .join('\n')
}

// the docusaurus frontmatter is for the website's sidebar, not the reader
function withoutFrontmatter(preamble: string) {
  return preamble.startsWith('---\n')
    ? preamble.slice(preamble.indexOf('\n---\n', 4) + 5).trimStart()
    : preamble
}

// Where the contents starts, which is also where the preamble ends. A generated
// type page opens with its own `# Name` heading and hangs the summary, the
// composes line, the pointer to its config page and the example under it, so
// there is no text above the first heading at all: a lone title folds into the
// preamble instead. Otherwise the answer is a contents whose first row is the
// whole 71 KB page, and the orientation the agent came for is the one thing it
// cannot ask for. The website topics carry their title in frontmatter and have
// no `#` heading, so for them this is the preamble it always was.
function bodyStart(sections: DocSection[]) {
  const titles = sections.filter(s => s.level === 1)
  return titles.length === 1 ? sections.indexOf(titles[0]!) + 1 : 1
}

export function readDocSection(
  markdown: string,
  section: string,
  {
    splitAt,
    omit,
    // A generated type page is four flat lists of members and nothing else, so
    // a `section` naming none of the four headings is an agent asking for a
    // member. A hand-written topic has real headings and its bullets are prose,
    // where the same fallback answers "loc" out of a fast-path recipe instead
    // of listing the sections the agent had guessed wrong at.
    members: memberFallback = false,
  }: {
    splitAt?: string
    omit?: readonly string[]
    members?: boolean
  } = {},
): BridgeToolResult {
  const served = omit?.length ? withoutSections(markdown, omit) : markdown
  if (section === 'all') {
    return { text: served }
  }
  const sections = splitSections(served)
  if (!section) {
    const marker = splitAt ? findSection(sections, splitAt) : -1
    if (marker !== -1) {
      const contract = sections
        .slice(0, marker + 1)
        .map(s => s.text)
        .join('')
      return {
        text: `${withoutFrontmatter(contract)}\nPass one as "section" to read it, or "all" for the whole guide:\n${tableOfContents(sections, marker + 1)}\n`,
      }
    }
    if (served.length <= TOC_ABOVE_CHARS) {
      return { text: served }
    }
    const start = bodyStart(sections)
    const preamble = sections
      .slice(0, start)
      .map(s => s.text)
      .join('')
    return {
      text: `${withoutFrontmatter(preamble)}\nThis topic is ${served.length} characters. Sections (pass one as "section", or "all" for everything):\n${tableOfContents(sections, start)}\n`,
    }
  }
  const index = findSection(sections, section)
  if (index !== -1) {
    return { text: sectionWithChildren(sections, index) }
  }
  const named = memberFallback ? findMembers(sections, section) : []
  if (named.length > 0) {
    return {
      text: `${named.map(m => `## ${m.heading}\n${m.line.trim()}`).join('\n\n')}\n`,
    }
  }
  // The near member names, not their bullets: a page has 300 members and a
  // one-word ask matches dozens, so this is the index into the section rather
  // than a second answer.
  const loose = normalized(section)
  const near = memberFallback
    ? [
        ...new Set(
          members(sections)
            .filter(m => normalized(m.name).includes(loose))
            .map(m => m.name),
        ),
      ]
    : []
  return {
    error: `No ${memberFallback ? 'section or member' : 'section'} "${section}". Sections:\n${tableOfContents(
      sections,
      bodyStart(sections),
    )}${
      near.length > 0
        ? `\n\nMembers whose name carries "${section}" — pass one as "section" for its line alone: ${near.slice(0, 40).join(', ')}`
        : ''
    }`,
  }
}
