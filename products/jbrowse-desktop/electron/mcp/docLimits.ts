// The session-spec reference is ~77 KB — around 20k tokens — and an agent
// composing one linear genome view needs a tenth of it. Over this size a bare
// topic answers with its headings and the text before the first one.
//
// Its own module, importing nothing: src/mcp/docsRoster.test.ts reads these
// from the renderer project, where reaching docSections.ts would drag the
// bundled .md imports into a typecheck that has no loader for them.
export const TOC_ABOVE_CHARS = 20_000

/**
 * Topics whose bare answer is the text above this heading plus a table of
 * contents of what is below it.
 *
 * `docs topic:"live-model"` is what every agent is told to read first, and the
 * guide is 24 KB. The headings-only answer TOC_ABOVE_CHARS gives a reference
 * would drop the contract — the part that has to arrive before the first
 * run_javascript call — so the split is explicit instead: the contract whole,
 * then the deep dives by name. `section:"all"` still reads everything.
 */
export const SPLIT_TOPICS: Record<string, string> = {
  'live-model': 'Deep dives',
}

/**
 * Sections the docs tool leaves out, by topic.
 *
 * This server runs inside JBrowse Desktop, so the guide's browser-agent
 * section describes a client that cannot be the one asking. The website page
 * and the browser eval's `--guide` read the file itself and still carry it.
 */
export const OMITTED_SECTIONS: Record<string, string[]> = {
  'live-model': ['In a browser'],
}
