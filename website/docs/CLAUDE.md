# website/docs

Prose rules: `website/CLAUDE.md`.

## Generated

`pnpm autogen` writes `config/`, `models/`, `api/`, the guide indexes, `cli.md`,
`jbrowse-img.md` and every `<!-- NAME START/END -->` block from JSDoc tags,
registrations and manifests. Never hand-edit them; tag the definition site.
Markers: `agent-docs/reference/GENERATED_DOC_BLOCKS.md`.

- **A table a reader could check against the code is a generator waiting to be
  written.** Every hand-written table that later got a generator had already
  gone wrong.
- Where a generator needs prose it cannot derive, a missing tag is fatal rather
  than a blank cell, which would read as "this does nothing".

## Hand-written pages

- **Don't restate a config slot's default** or a value a build script owns: link
  `/docs/config/<type>/#slot-<name>` or use a marker block.
- Don't hand-list a directory's pages: `<!-- doclist:<dir> -->`.
- Prefer an `include:` marker over a copied code fence. The marker fills an
  existing fence, so write an empty one under it, then lower
  `DOC_FENCE_BASELINE`.
- Never retype a number from `agent-docs`: bracket its measurement table or
  quote the cell, and link the doc that owns the number.
- **JSON config fences** (`check-config-blocks`): a whole track config in a
  fence tagged `json addtrack`, never a fragment; a whole config opens with
  `"$schema": "https://jbrowse.org/jb2/schema/v5/config.json"`; a
  `defaultSession` gets its own `json session` fence as its only key. Prefer
  `displayDefaults` to a `displays` array, and the whole-track shorthand
  (`trackId`, `uri`, `assemblyNames`) where the extension infers the adapter.
- **A tagged fence renders its own app and CLI tabs**, so the prose says what
  the config is, never "add this to `tracks`" or "run the CLI command below". An
  assembly the add-genome form has no input for (`aliases`, `geneticCodes`) gets
  no app tab, and the page owes that reader a sentence.
- `config=` on a session fence grows a live link. Prefer
  `config=test_data/<name>/config.json`, kept relative so `JBROWSE_CODE_BASE`
  retargets it. An addtrack fence takes `loc=` (no spaces) from a locus the page
  already states. **Ask what the session shows, not whether `check-session-urls`
  accepts it.**
- jexl the short way: `feature.rank`, not `get(feature,'rank')`.
- `user_guides/` drives the UI; `config_guides/` shows the JSON.

## Voice

Dry and scientific: the figure holds the result, and the prose says what was
done and what it means. A page opens with a plain paragraph, under no summary
label, saying what it shows and what makes it work, without "this page". Don't
restate the title, close on a superlative, or credit the result to the wrong
mechanism.
