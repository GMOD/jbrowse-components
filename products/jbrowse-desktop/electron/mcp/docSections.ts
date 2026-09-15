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
  const headings = sections.map(s => normalized(s.heading))
  const exact = headings.indexOf(wanted)
  return exact !== -1 ? exact : headings.findIndex(h => h.includes(wanted))
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

export function readDocSection(
  markdown: string,
  section: string,
  { splitAt, omit }: { splitAt?: string; omit?: readonly string[] } = {},
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
    return {
      text: `${withoutFrontmatter(sections[0]!.text)}\nThis topic is ${served.length} characters. Sections (pass one as "section", or "all" for everything):\n${tableOfContents(sections)}\n`,
    }
  }
  const index = findSection(sections, section)
  return index === -1
    ? {
        error: `No section "${section}". Sections:\n${tableOfContents(sections)}`,
      }
    : { text: sectionWithChildren(sections, index) }
}
