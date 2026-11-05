# website/docs

## Generated

- Change `config/`, `models/`, `api/`, the guide indexes, `cli.md`,
  `jbrowse-img.md` and any `<!-- BEGIN/END GENERATED NAME -->` block at its
  source (JSDoc tag, registration, manifest): pre-push regenerates over a hand
  edit. Markers: `agent-docs/reference/GENERATED_DOC_BLOCKS.md`.
- **A table a reader could check against the code gets a generator**, not a
  hand-written copy.

## Hand-written pages

- **Link a config slot's default** (`/docs/config/<type>/#slot-<name>`) or a
  value a build script owns through a marker block, rather than restating it.
- List a directory's pages with `<!-- doclist:<dir> -->`, not by hand.
- Quote a number from `agent-docs` through its measurement table or cell, and
  link the doc that owns it.
- In a `json addtrack` fence prefer `displayDefaults` to a `displays` array, and
  the whole-track shorthand (`trackId`, `uri`, `assemblyNames`) where the
  extension infers the adapter.
- **A tagged fence renders app and CLI tabs**, so the prose says what the config
  is, never "add this to `tracks`" or "run the CLI command below". An assembly
  the add-genome form has no input for (`aliases`, `geneticCodes`) gets no app
  tab, and the page gives that reader a sentence in its place.
- `config=` on a session fence adds a live link: prefer
  `config=test_data/<name>/config.json`, relative so `JBROWSE_CODE_BASE`
  retargets it. An addtrack fence takes `loc=` (no spaces) from a locus the page
  already states. **Judge what the session shows**; `check-session-urls` passing
  says only that it opens.
- **Show what a command prints in a `text output` fence directly under it**,
  pasted from a real run; the site renders it in the command's box. Put a file
  the command writes in a plain `text` fence.
- Write jexl the short way: `feature.rank`, not `get(feature,'rank')`.
- `user_guides/` drives the UI; `config_guides/` shows the JSON.

## Voice

Write dry, scientific prose: the figure shows the result, and the prose
describes what was done and what it means. A page opens with a plain paragraph,
under no summary label, saying what it shows and what makes it work, without
"this page". Open on something the title does not say, end on the last fact, and
credit the result to the mechanism that produced it.
