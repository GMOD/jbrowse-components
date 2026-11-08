# Tutorials

Layout, voice and commands: `agent-docs/reference/WEBSITE_WRITING.md`
§"Tutorials", whose §"Before adding a locus" lists what to read first.

- Add a new page to `TUTORIAL_ORDER` in `src/lib/guide-categories.ts`; an
  unlisted one falls to the end.
- Move a figure off a page and you move its card's crop source in
  `gen-tutorial-thumbs.ts` too, because no check compares the two.
- **Write `gzip -dc`, not `zcat`**: macOS `zcat` wants a `.Z` and writes an
  empty file.
