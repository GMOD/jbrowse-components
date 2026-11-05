# Agent documentation

Top level is `ARCHITECTURE.md`, `TODO.md` and this file. `ARCHITECTURE.md` is a
map that routes to subsystem docs; depth goes in those. Everything else is
filed:

- `reference/`: settled. How a subsystem works or is operated, a measurement,
  the datasets behind the figures.
- `mechanisms/`: a built, load-bearing technique stated so it travels;
  [mechanisms/README.md](mechanisms/README.md) has the admission test.
- `ideas/`: one parked proposal per file, real bugs included, in the subfolder
  naming what it waits on. A verdict leaves `ideas/` as an ADR or a deletion.
- `architecture-decision-records/`: why, one per file.
- `handoffs/`: live state of an unfinished thread, as pointers rather than
  content. Re-read the "next" list against main before editing one. When the
  thread lands, file the remainder (a worked proposal goes to `ideas/`) and
  delete the handoff in the same pass.
- `todo/`: work v5.0.0 turns on (`TODO.md` is generated from it). Work for after
  the release goes to `ideas/`.
- Something tried and declined gets a sentence, with the number, at the site
  that would re-try it, and no shelf of its own.
- Git history holds what a session did, so no doc restates it; "state as of
  \<date\>" belongs in `handoffs/` only.
- A `CLAUDE.md` holds only what an agent working there would get wrong silently
  and could not learn by reading the code or docs: no rule a check enforces, no
  rationale (`reference/`), no history. Claude Code loads a `CLAUDE.md` on
  reading a file below it, and never loads `AGENTS.md`.

## Generated tables

- **If a sentence tells the reader to go look at a file, generate the table
  under it from that file.** Markers, generators and measurement records:
  [reference/GENERATED_DOC_BLOCKS.md](reference/GENERATED_DOC_BLOCKS.md).
- Docs cite `ideas/` by `<folder>/<filename>` and nothing checks those, so grep
  before renaming or moving a proposal between folders.
- A diagram is a `.dot` under a `diagrams/` directory with its `.svg` committed
  beside it (`pnpm diagrams`). A fenced `dot` block renders nowhere.

## Public counterparts

Nothing generates these, so change both by hand in the same pass:

- A new measurement lands in its `reference/` doc first, then in
  `website/docs/developer_guides/optimizations.md` and the v5 manuscript's
  strategy table.
- `creating_display.md`, `plotting_features.md`, `creating_gpu_display.md` and
  `data_fetching.md` under `website/docs/developer_guides/` walk through
  `reference/DISPLAY_PIPELINE.md`'s sections: change them with the lifecycle,
  mixins or upload patterns (`check-docs` checks their links, not their prose).
- `website/docs/config_guides/grammar.md` is the public face of
  `reference/GRAMMAR_STAGES.md`: a new grammar object or a respelling changes
  both.

## Third parties: say what we chose, not how they rank

The agent docs are public. Justify a default by what it does for us, not by a
claim about the alternative. A real limitation stays, as does an outage we hit.
