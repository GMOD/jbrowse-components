// Every guide and tutorial page opens with a `**TL;DR:**` paragraph, and that
// paragraph does not sell.
//
// The convention held on 123 of 125 hand-written pages before this check existed
// and was written down nowhere: the only mention of "TL;DR" in any CLAUDE.md is
// in tutorials/, positioning `## Prerequisites` relative to it. A convention
// that universal and that unstated is one a new page drops by not knowing about
// it, which is the quiet half of what this catches.
//
// The loud half is the voice rule in website/docs/CLAUDE.md ("dry and
// scientific ... no rhetorical framing of a method"), which listed captions,
// gallery descriptions and headings and not the surface with the most instances.
// A sweep in Aug 2026 found four TL;DRs closing on a superlative instead of a
// fact — "It is the best way to see translocations ... at a glance", "It is the
// one-click way to share a hub", "and more" — and fixing those took the corpus
// to zero.
//
// Zero is why this is a hard failure and not a ratchet like check-captions.ts.
// That file exists because its rule went unenforced long enough to accumulate 37
// violations, so the only affordable check was one that freezes the debt. There
// is no debt here yet. A blocklist installed at zero costs one list and no
// tracked file, and the moment it slips it becomes the other thing.
//
// Some entries below have never appeared in this corpus. They are prophylactic
// on purpose: the cost of a word that never fires is nothing, and the point is
// to be in place before the first one lands rather than after the thirty-seventh.
// A phrase that turns out to have a legitimate use in a TL;DR is a one-line
// change here plus the argument for it in review, which is the conversation
// worth having.
//
// Run: `pnpm check-tldr`, or the root `pnpm check-docs`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { docFiles, reportProblems } from './check-utils.ts'
import { docRelative, docsDir } from './paths.ts'

// The hand-written guide corpus. config/, models/ and api/ are generator output
// and have no prose of their own; the loose pages at the docs root (faq,
// quickstart, urlparams) are reference material that no page-length summary
// helps, and none carries a TL;DR today.
const GUIDE_DIRS = [
  'user_guides',
  'config_guides',
  'developer_guides',
  'tutorials',
]

// Below this many characters of body, a TL;DR would be about as long as the page
// it summarizes. The two pages that carry none — `disable_analytics` (669) and
// `avoiding_stale_config` (886) — are the two shortest in the corpus, and the
// shortest page that does carry one is `plugin_store` at 1153, so the threshold
// sits in a real gap rather than splitting a continuum. A stub that grows past
// it starts owing a summary, which is the behavior wanted.
const MIN_BODY = 1000

// Measured (the Aug 2026 sweep) and prophylactic entries both. Scoped to the
// TL;DR paragraph, never the body: "simply has no data there" is a fine thing
// for prose to say six times, and "one-click presets" is a literal description
// of two menu items in the variant track guide.
const BANNED = [
  /\bat a glance\b/i,
  /\bthe best way\b/i,
  /\bone-click\b/i,
  /,? and more\b/i,
  /\bpowerful\b/i,
  /\bseamless(ly)?\b/i,
  /\beffortless(ly)?\b/i,
  /\bintuitive\b/i,
  /\bblazing\b/i,
  /\brich set\b/i,
]

// The paragraph runs from the `**TL;DR:**` line to the first blank line. Three
// TL;DRs end on a colon and hand off to a bulleted list, which is a separate
// block and deliberately not scanned — the prose is the part that can
// editorialize.
//
// Line-wise rather than one regex, because the obvious regex is wrong in a way
// that passes: `/^\*\*TL;DR:\*\*([\s\S]*?)(?:\n\s*\n|$)/m` looks like it takes
// the paragraph, but under `m` the `$` matches at every line end, so the lazy
// body stops at the first one and only the opening line gets scanned. Written
// that way this check went green on the four TL;DRs it was built from, all of
// which editorialize in their last sentence.
//
// Position is NOT enforced. 118 pages open with the TL;DR and five in
// developer_guides put a paragraph of "what this system is" before it
// (rpc_workers, mst_patterns, refname_aliasing, imports_and_reexports,
// creating_text_search_adapter), which reads as a deliberate choice for a
// reference page rather than drift.
function tldrParagraph(body: string): string | undefined {
  const lines = body.split('\n')
  const start = lines.findIndex(line => line.startsWith('**TL;DR:**'))
  if (start === -1) {
    return undefined
  }
  const paragraph: string[] = []
  for (const line of lines.slice(start)) {
    if (!line.trim()) {
      break
    }
    paragraph.push(line)
  }
  return paragraph.join(' ').replace(/\s+/g, ' ').trim()
}

const problems: string[] = []

for (const dir of GUIDE_DIRS) {
  for (const file of docFiles(join(docsDir, dir))) {
    const rel = docRelative(file)
    const content = readFileSync(file, 'utf8')
    const body = content.replace(/^---\n[\s\S]*?\n---\n/, '')
    const paragraph = tldrParagraph(body)

    if (paragraph === undefined) {
      if (body.trim().length >= MIN_BODY) {
        problems.push(
          `${rel}: no "**TL;DR:**" paragraph. Every other page of this length ` +
            `opens with one saying what the page shows.`,
        )
      }
      continue
    }

    for (const pattern of BANNED) {
      const hit = pattern.exec(paragraph)
      if (hit) {
        problems.push(
          `${rel}: TL;DR says "${hit[0].trim()}". Say what the page shows, ` +
            `not how good it is (website/docs/CLAUDE.md, "Voice").`,
        )
      }
    }
  }
}

reportProblems(problems, 'TL;DR paragraphs are present and unsalesy')
