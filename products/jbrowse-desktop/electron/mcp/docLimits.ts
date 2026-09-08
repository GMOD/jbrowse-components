// The session-spec reference is ~77 KB — around 20k tokens — and an agent
// composing one linear genome view needs a tenth of it. Over this size a bare
// topic answers with its headings and the text before the first one.
//
// Its own module, importing nothing: agents_live_model.md sits just under this
// line, and the test that holds it there (src/mcp/docsRoster.test.ts) is in the
// renderer project, where reaching docSections.ts would drag the bundled .md
// imports into a typecheck that has no loader for them.
export const TOC_ABOVE_CHARS = 20_000

/**
 * Topics served whole however long they get.
 *
 * The cap above exists for a REFERENCE — urlparams.md is 60 KB and an agent
 * composing one linear genome view needs a tenth of it. The live-model guide is
 * the opposite kind of document: it is the contract, `docs topic:"live-model"`
 * is what every agent is told to read first, and crossing the cap would answer
 * that with headings. It sat 43 characters under the line, so the next
 * paragraph anyone added to the contract had to be paid for by deleting one.
 */
export const WHOLE_TOPICS = new Set(['live-model'])
