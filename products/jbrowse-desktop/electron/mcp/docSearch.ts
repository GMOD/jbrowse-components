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
  // a generated type page, rather than one of the hand-written guides
  generated: boolean
  // how many of the query's words this line carries, which outranks the tier
  // above: a body line holding all three of "synteny PAF track" is a better
  // answer than a type name holding one of them
  matched: number
  topic: string
  section: string
  line: string
}

// Distinct query words present, plus one for carrying the whole phrase: an
// agent that typed "region too large" means those words together, and the line
// that has them adjacent is the answer to it.
function countTerms(text: string, terms: string[], phrase: string) {
  const lower = text.toLowerCase()
  const matched = terms.filter(term => lower.includes(term)).length
  return matched + (terms.length > 1 && lower.includes(phrase) ? 1 : 0)
}

function clip(line: string) {
  const flat = line.trim()
  return flat.length > MAX_LINE_CHARS
    ? `${flat.slice(0, MAX_LINE_CHARS)}…`
    : flat
}

// A page matched by its own name answers with the page, not with every line
// inside it that repeats the name — that is the whole page, one hit at a time.
function hitsIn(doc: SearchableDoc, terms: string[], phrase: string) {
  const nameMatched = doc.name ? countTerms(doc.name, terms, phrase) : 0
  // splitting 1.7 MB into sections per query is most of the cost, and most
  // pages hold nothing — so ask the cheap question first
  if (!nameMatched && !countTerms(doc.text, terms, phrase)) {
    return []
  }
  if (nameMatched === terms.length) {
    return [
      {
        rank: NAME,
        matched: nameMatched,
        generated: doc.name !== undefined,
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
    const inHeading = countTerms(section.heading, terms, phrase)
    if (inHeading > 0) {
      hits.push({
        rank: HEADING,
        matched: inHeading,
        generated: doc.name !== undefined,
        topic: doc.topic,
        section: heading,
        line: `## ${section.heading}`,
      })
    }
    for (const line of section.text.split('\n')) {
      const inLine = countTerms(line, terms, phrase)
      if (inLine > 0 && !line.startsWith('#')) {
        hits.push({
          rank: BODY,
          matched: inLine,
          generated: doc.name !== undefined,
          topic: doc.topic,
          section: heading,
          line: clip(line),
        })
      }
    }
  }
  // the page's own name carries words too, so a partial name match still
  // counts toward every line's score rather than being thrown away
  return hits
    .map(h => ({ ...h, matched: Math.max(h.matched, nameMatched) }))
    .sort((a, b) => b.matched - a.matched || a.rank - b.rank)
    .slice(0, MAX_HITS_PER_TOPIC)
}

export function searchDocs(
  docs: SearchableDoc[],
  query: string,
): BridgeToolResult {
  // Split on whitespace: an agent asks "synteny PAF track", and no line
  // anywhere carries those three words adjacent. Every word is scored
  // separately and the lines carrying most of them come first, so a phrase
  // narrows the results instead of emptying them.
  const phrase = query.trim().toLowerCase()
  const terms = phrase.split(/\s+/).filter(Boolean)
  if (terms.length === 0) {
    return { error: 'search needs something to look for' }
  }
  // Ordering, in words: the line carrying most of what you asked for, then a
  // type name over a heading over body text, then the hand-written guides
  // ahead of the generated reference — a guide is written to be read, and a
  // type page is written to be looked up once you know the name.
  const hits = docs
    .flatMap(doc => hitsIn(doc, terms, phrase))
    .sort(
      (a, b) =>
        b.matched - a.matched ||
        a.rank - b.rank ||
        Number(a.generated) - Number(b.generated),
    )
  if (hits.length === 0) {
    return {
      error: `Nothing in the bundled documentation carries any word of "${query}". Topic "types" lists every documented type name; a type a runtime plugin registers has no page here, so introspect it live instead (jb.inspect on an instance).`,
    }
  }
  const shown = hits.slice(0, MAX_HITS)
  // More words match MORE lines and rank them better, so "narrow the search"
  // is the wrong advice for a phrase: say what the ordering is instead.
  const more =
    hits.length > shown.length ? `, showing the top ${shown.length}` : ''
  const head =
    terms.length > 1
      ? `${hits.length} line(s) carry a word of "${query}"${more}, the ones carrying the most first.`
      : `${hits.length} match${hits.length === 1 ? '' : 'es'} for "${query}"${more}.`
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
