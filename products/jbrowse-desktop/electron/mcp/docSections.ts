import type { BridgeToolResult } from './stdioServer.ts'

// The session-spec reference is ~77 KB — around 20k tokens — and an agent
// composing one linear genome view needs a tenth of it. Over this size the
// bare topic answers with its headings and the text before the first one.
const TOC_ABOVE_CHARS = 20_000

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
function sectionWithChildren(sections: DocSection[], index: number) {
  const { level } = sections[index]!
  let end = index + 1
  while (end < sections.length && sections[end]!.level > level) {
    end += 1
  }
  return sections
    .slice(index, end)
    .map(s => s.text)
    .join('')
}

function tableOfContents(sections: DocSection[]) {
  return sections
    .filter(s => s.level > 0)
    .map(s => `${'  '.repeat(s.level - 1)}- ${s.heading}`)
    .join('\n')
}

export function readDocSection(
  markdown: string,
  section: string,
): BridgeToolResult {
  if (section === 'all' || (!section && markdown.length <= TOC_ABOVE_CHARS)) {
    return { text: markdown }
  }
  const sections = splitSections(markdown)
  if (!section) {
    return {
      text: `${sections[0]!.text}\nThis topic is ${markdown.length} characters. Sections (pass one as "section", or "all" for everything):\n${tableOfContents(sections)}\n`,
    }
  }
  const wanted = section.trim().toLowerCase()
  const exact = sections.findIndex(s => s.heading.toLowerCase() === wanted)
  const index =
    exact !== -1
      ? exact
      : sections.findIndex(s => s.heading.toLowerCase().includes(wanted))
  return index === -1
    ? {
        error: `No section "${section}". Sections:\n${tableOfContents(sections)}`,
      }
    : { text: sectionWithChildren(sections, index) }
}
