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

/**
 * Every markdown page the `docs` tool serves, with the file it is bundled from
 * and the summary a bare `docs` call lists it by.
 *
 * Here rather than beside the text in docsContent.ts, which only esbuild can
 * read: those `.md` imports have no loader under jest or node, so the two
 * checkers that hold these pages to the running app each kept a list of their
 * own — docsRoster.test.ts for the `jb` members a page names, and
 * website/scripts/check-agent-doc-types.ts for the display, track and adapter
 * types — and neither list held urlparams.md, which is the largest page an
 * agent reads. Both derive their sources from here instead, so a topic added
 * below arrives already checked.
 */
export const DOC_TOPICS = {
  'live-model': {
    file: 'website/docs/agents_live_model.md',
    summary:
      'Driving the live session from run_javascript: the contract to read first — every jb member, what a call answers with, when to screenshot — then deep-dive sections you ask for by name',
  },
  recipes: {
    file: 'website/docs/agents_recipes.md',
    summary:
      'Worked run_javascript snippets, each verified against the app: finding tracks, opening a hosted genome at a gene, tabulating and joining what is on screen, derived tracks, restyling, figures per locus, adding remote data',
  },
  'hosted-data': {
    file: 'website/docs/agents_hosted_data.md',
    summary:
      'The hosted genomes: the config URL for any UCSC database or GenArk accession, what a hosted config contains, and adding your own file beside its tracks',
  },
  'session-spec': {
    file: 'website/docs/urlparams.md',
    summary:
      'Full session spec / URL params reference: every view type and its launch keys, track entry fields, layout, workspaces',
  },
  automating: {
    file: 'website/docs/automating.md',
    summary:
      'The config and session document every front end takes, the fields a view launches with, where it comes from, and jbrowse validate',
  },
} as const

export type DocTopic = keyof typeof DOC_TOPICS
