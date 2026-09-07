// The session-spec reference is ~77 KB — around 20k tokens — and an agent
// composing one linear genome view needs a tenth of it. Over this size a bare
// topic answers with its headings and the text before the first one.
//
// Its own module, importing nothing: agents_live_model.md sits just under this
// line, and the test that holds it there (src/mcp/docsRoster.test.ts) is in the
// renderer project, where reaching docSections.ts would drag the bundled .md
// imports into a typecheck that has no loader for them.
export const TOC_ABOVE_CHARS = 20_000
