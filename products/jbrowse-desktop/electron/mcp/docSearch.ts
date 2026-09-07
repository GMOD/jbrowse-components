import { splitSections } from './docSections.ts'

import type { BridgeToolResult } from './stdioServer.ts'

// The corpus is reachable by type name and by topic, and not at all by what a
// page says — so "which display has a colorBy slot" needs the name it is
// looking for before it can look. This scans the bundled text instead. It is a
// substring pass over ~1.7 MB in a process that already parsed the JSON once,
// which is single-digit ms; an index would be a cache with no measured win.
export interface SearchableDoc {
  topic: string
  text: string
  // set for a type page, whose name is itself the strongest match
  name?: string
}

const MAX_HITS = 40
// Breadth beats depth: "colorBy" appears 116 times and the first page alone
// would have taken four of the forty slots. An agent looking for which display
// has a setting wants the pages, and reads the one it picks in full.
const MAX_HITS_PER_TOPIC = 3
const MAX_LINE_CHARS = 300

// A name match beats a heading match beats a line of body text: an agent
// searching "BamAdapter" wants that page, not every page that mentions it.
const NAME = 0
const HEADING = 1
const BODY = 2

interface Hit {
  rank: number
  topic: string
  section: string
  line: string
}

function clip(line: string) {
  const flat = line.trim()
  return flat.length > MAX_LINE_CHARS
    ? `${flat.slice(0, MAX_LINE_CHARS)}…`
    : flat
}

// A page matched by its own name answers with the page, not with every line
// inside it that repeats the name — that is the whole page, one hit at a time.
function hitsIn(doc: SearchableDoc, needle: string) {
  const nameHit = doc.name?.toLowerCase().includes(needle)
  // splitting 1.7 MB into sections per query is most of the cost, and most
  // pages hold nothing — so ask the cheap question first
  if (!nameHit && !doc.text.toLowerCase().includes(needle)) {
    return []
  }
  if (nameHit) {
    return [
      {
        rank: NAME,
        topic: doc.topic,
        section: '',
        line: doc.text.split('\n')[0] ?? doc.topic,
      },
    ]
  }
  const hits: Hit[] = []
  for (const section of splitSections(doc.text)) {
    // a page's own H1 is the page, not a section of it
    const heading = section.level > 1 ? section.heading : ''
    if (section.heading.toLowerCase().includes(needle)) {
      hits.push({
        rank: HEADING,
        topic: doc.topic,
        section: heading,
        line: `## ${section.heading}`,
      })
    } else {
      for (const line of section.text.split('\n')) {
        if (line.toLowerCase().includes(needle) && !line.startsWith('#')) {
          hits.push({
            rank: BODY,
            topic: doc.topic,
            section: heading,
            line: clip(line),
          })
        }
      }
    }
  }
  return hits.slice(0, MAX_HITS_PER_TOPIC)
}

export function searchDocs(
  docs: SearchableDoc[],
  query: string,
): BridgeToolResult {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return { error: 'search needs something to look for' }
  }
  const hits = docs
    .flatMap(doc => hitsIn(doc, needle))
    .sort((a, b) => a.rank - b.rank)
  if (hits.length === 0) {
    return {
      error: `Nothing in the bundled documentation matches "${query}". Topic "types" lists every documented type name; a type a runtime plugin registers has no page here, so introspect it live instead (jb.inspect on an instance).`,
    }
  }
  const shown = hits.slice(0, MAX_HITS)
  const head =
    hits.length > shown.length
      ? `${hits.length} matches for "${query}", showing the first ${shown.length} — narrow the search, or read one of these.`
      : `${hits.length} match${hits.length === 1 ? '' : 'es'} for "${query}".`
  // grouped, because three getters of one display under one heading is one
  // place to read, and repeating its address three times says otherwise
  const groups: { where: string; lines: string[] }[] = []
  for (const hit of shown) {
    const where = `topic:"${hit.topic}"${hit.section ? ` section:"${hit.section}"` : ''}`
    const last = groups.at(-1)
    if (last?.where === where) {
      last.lines.push(hit.line)
    } else {
      groups.push({ where, lines: [hit.line] })
    }
  }
  const body = groups.map(g => `${g.where}\n  ${g.lines.join('\n  ')}`)
  return {
    text: `${head} Read one with the topic and section spelled as written here:\n\n${body.join('\n\n')}\n`,
  }
}
