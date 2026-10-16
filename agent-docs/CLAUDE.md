# Agent documentation

Top level is `ARCHITECTURE.md`, `TODO.md` and this file. Everything else is
filed:

- `reference/`: settled. How a subsystem works or is operated, a measurement,
  the datasets behind the figures.
- `mechanisms/`: a built, load-bearing technique stated so it travels;
  [mechanisms/README.md](mechanisms/README.md) has the admission test. A doc
  that cannot name its idea without naming the plugin belongs in `reference/`.
- `ideas/`: one parked proposal per file, in the subfolder naming what it waits
  on, real bugs included. A verdict leaves `ideas/` as an ADR or as a
  deletion.
- `architecture-decision-records/`: why, one per file.
- `handoffs/`: live state of an unfinished thread, as pointers rather than
  content. Re-read the "next" list against main before editing one. When the
  thread lands, file the remainder (a worked proposal goes to `ideas/`) and
  delete the handoff in the same pass.
- `todo/`: work v5.0.0 turns on; `TODO.md` is generated from its frontmatter.
  Work for after the release goes to `ideas/`.
- Something tried and declined gets a sentence, with the number, at the site
  that would re-try it, and no shelf of its own.
- Git history holds what a session did, so no doc restates it. `CLAUDE.md`
  files break this rule most; "state as of \<date\>" outside `handoffs/`
  belongs in one of the homes above.
- A `CLAUDE.md` beside code holds only what an agent editing there would get
  wrong silently and could not learn by reading the code: no rule a check
  enforces, no rationale (`reference/`), no history. Claude Code loads
  `CLAUDE.md` on reading a file below it, and never loads `AGENTS.md`.

## Generated tables

- Find docs through the generated `README.md` indexes, not `ls`.
- **If a sentence tells the reader to go look at a file, generate the table
  under it from that file.** Marker spellings, generators and measurement
  records: [reference/GENERATED_DOC_BLOCKS.md](reference/GENERATED_DOC_BLOCKS.md).
- Docs cite `ideas/` by `<folder>/<filename>`, so grep before renaming or
  moving a proposal between folders.
- A diagram is a `.dot` under a `diagrams/` directory with its `.svg` committed
  beside it (`pnpm diagrams`). A fenced `dot` block renders nowhere.

## Public counterparts

- A new measurement lands in its `reference/` doc first.
  `website/docs/developer_guides/optimizations.md` is its public digest, and
  the v5 manuscript's strategy table states the same set with no generator
  reaching it, so update both by hand.
- `creating_display.md`, `plotting_features.md`, `creating_gpu_display.md` and
  `data_fetching.md` under `website/docs/developer_guides/` walk through
  ARCHITECTURE.md's sections. Change them in the same pass as the lifecycle,
  mixins or upload patterns; `check-docs` checks their links, not their prose.

## Third parties: say what we chose, not how they rank

The agent docs are public. Justify a default by what it does for us, not by a claim
about the alternative. A real limitation stays, as does an outage we hit.
