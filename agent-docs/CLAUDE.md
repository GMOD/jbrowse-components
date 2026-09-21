# Agent documentation

Top level is exactly `ARCHITECTURE.md`, `TODO.md` and this file. Everything else
is filed:

- `reference/` — settled: how a subsystem works, how to operate it, a
  measurement, the datasets behind the figures.
- `mechanisms/` — a technique stated so it travels: the idea is the subject
  and this repo's code is the evidence. Built and load-bearing, never proposed;
  the filename is the `name:` slug, and
  [mechanisms/README.md](mechanisms/README.md) carries the admission test.
- `ideas/` — a proposal parked, one per file, in the subfolder naming what it
  waits on: `ready/`, `waiting-on-a-call/`, `waiting-on-a-number/`,
  `waiting-on-someone-else/`, `collections/`. A verdict leaves `ideas/`: an ADR
  if it is a decision worth its own record, otherwise deleted.
- `architecture-decision-records/` — *why*, one per file.
- `handoffs/` — live state of an unfinished thread, usually a review whose
  findings nobody has committed to. **Pointers, not content.** Delete when the
  thread lands.
- Tried and declined → a sentence at the site that would re-try it, with the
  number. There is no rejected-ideas shelf.
- Work **v5.0.0 turns on** → a file in `todo/`, which `TODO.md`'s tables are
  generated from: write the doc with `metadata.category`, `area`, `first_move`
  and `order`, then `pnpm autogen`. Work someone intends to do after it —
  including a measured defect — → `ideas/`, and move it back once the release is
  out.
- What a session did and which commits → **git already holds it.**

That last one applies to `CLAUDE.md` files too and is the rule they break most.
"State as of \<date\>" outside `handoffs/` means split it into the homes above.

`TODO.md` vs `ideas/` is commitment, not size — and while a release is in view
the commitment being asked about is that release's. Read a parked proposal
before re-proposing it, and expect `ideas/` to hold real bugs as well as
proposals that missed the v5.0.0 bar, each saying so at its top. `mechanisms/` vs `reference/` is which one is the subject: a
doc that cannot name its idea without naming the plugin is a subsystem writeup,
and a mechanism doc points at that writeup for the depth rather than restating
it.

**A handoff is the one file here whose subject is still moving, so it goes stale
faster than anything else** — its state snapshots drift, and the reference doc it
points at overtakes it. Close a thread by filing its remainder into the homes
above and deleting the file, in the same pass; a *worked proposal* left inside a
handoff is the commonest way that fails, and it belongs in `ideas/`, one per file.

**A perf measurement has a public reader as well as this one.**
`website/docs/developer_guides/optimizations.md` digests what is in `reference/`
— including the results that came out negative, which is most of its value. The
`reference/` doc stays the record, so a new number lands here first.

**A measurement is a record, and every table showing it is generated.** Write
`agent-docs/measurements/<id>.json` — the values, the `measured` date and the
`source.repro` that takes them again, none of them optional — then bracket
`<!-- BEGIN GENERATED MEASUREMENT <id> -->` / `END` here AND on the public page.
`pnpm autogen` fills both and `--check` fails on drift. Don't hand-edit between
the markers; edit the record.

- **A column that is arithmetic over other columns is `derived`**, not typed:
  `"derived": "unpooledMs / pooledMs"`. Re-measuring one arm then moves the
  ratio beside it, which is what five typed-out speedups could not do.
- **`source.kind` is `bench`, `jb2bench` or `hand`.** `hand` says only a human
  can refresh these values; `pnpm measurement-tables` prints how many are still
  in that state, and the number should go down. A `jb2bench` record names the
  file under `~/src/jb2bench` it came from.
- The table travels whole — no row or column filter, deliberately — so where one
  reads badly in public, fix the record.
- Both directions are errors: a block naming no record, and a record no doc
  publishes. **The publishing page must also link this doc**, or the reader gets
  a table and no measurement.

**Quote a cell instead of retyping it**:
`1.34-1.46x<!--m:bgzf-pool-tabix.speedup.range-->`, either
`<id>.<row>.<column>` or `<id>.<column>.<min|max|span|range|first|last>`. Prose
restating a figure from the table above it is the one staleness no checker can
see — the old value is still in the doc it was copied from, so
`check-quoted-figures` passes. All three conversions were live, and the range
above already disagreed with its own column. **`<row>` is the row's first
column slugified**, with the next column joined on where another row shares it
(`two-alignments-tracks-pan-webgpu`); a key several rows answer to is an error
rather than the first of them.

**The marker goes after the value with no space in the pair**, which is why an
inline figure reads `203KB` and the table reads `203 KB`. A markdown line that
begins `<!--` is an HTML block and ends the paragraph around it, so the figure
and its reference have to be one token no rewrap can split.

The prose around those tables is checked too, by `check-quoted-figures.ts`:
every `<number><unit>` a public measurement page writes has to appear in an
agent-doc **that page links**, or in the JSDoc of an **exported symbol it
names**. So a figure quoted from here needs the link to here, and an unlinked
one fails. Scoping to what the page cites is what makes that worth running —
searching all of source instead admitted 73 of the 101 integer percentages,
which is most typos.

**Both ends of a range are checked**, so re-measuring `70-90%` means updating
both; `quotedFigures.test.ts` pins it.

Same discipline for the v5 manuscript's strategy table, which states the same
set at a higher altitude and has no generator reaching it: three copies of a
number is two chances to be the stale one, and it was — the CRAM arena figure
sat at a pre-ADR-0010 value there while `cram-js` had moved on.

## Public developer guides mirror ARCHITECTURE.md

The hand-written walkthroughs in `website/docs/developer_guides/` —
[creating_display.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/creating_display.md)
(which foundation to compose),
[plotting_features.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/plotting_features.md)
(Canvas2D),
[creating_gpu_display.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/creating_gpu_display.md)
(GPU), and
[data_fetching.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/data_fetching.md)
— turn ARCHITECTURE.md's sections into step-by-step tutorials and link back to them. When
the lifecycle, mixins, or upload patterns here change, update those guides in
the same pass. `pnpm check-docs` (which runs
`website/scripts/check-doc-imports.ts`) validates the cross-links both ways but
not the prose.

**Two of those pages are public counterparts to `reference/` rather than to
ARCHITECTURE.md**, and they are where a measurement recorded in `reference/` becomes something an
outside reader can act on:

- [dataflow.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/dataflow.md)
  is ARCHITECTURE.md's overview pipeline as one figure, with the worker,
  the wasm, the three cache layers and the two autoruns located on it.
  `website/diagrams/dataflow.dot` is the source.
- [optimizations.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/optimizations.md)
  is the public digest of the measured work in `reference/` — the three clocks,
  the number each optimization moved, and the ones measured as losses. **A new
  measurement lands in its `reference/` doc first**; that doc stays the record,
  and the public page cites it. Keep the two agreeing, and keep the public page
  agreeing with the v5 manuscript's strategy table, which states the same set at
  a higher altitude.

The marker pairs that bracket a generated block, which generator writes each
one, and the generated index of every block in the tree:
[reference/GENERATED_DOC_BLOCKS.md](reference/GENERATED_DOC_BLOCKS.md). Nothing
between a marker pair is hand-editable, here or under `website/docs`.


## Frontmatter and generated tables

- **Every doc outside `architecture-decision-records/` carries `name:` /
  `description:` frontmatter** — `pnpm autogen --check` fails without it. Find
  docs through [reference/README.md](reference/README.md),
  [mechanisms/README.md](mechanisms/README.md),
  [ideas/README.md](ideas/README.md) and
  [handoffs/README.md](handoffs/README.md), not `ls`.
- **Those four indexes and `TODO.md` are GENERATED, and so is every
  `<!-- NAME START/END -->` block in any doc.** `pnpm autogen` rewrites
  everything between the markers and `pnpm autogen --check` fails CI on a stale
  one, so an edit made between them is gone by the next run — change what the
  block is derived from instead. The four indexes come from each doc's
  `description:` (`website/scripts/generate-doc-indexes.ts`); `TODO.md`'s three
  tables and the count sentence in its preamble come from the frontmatter of the
  entries under `todo/` (`generate-todo-index.ts`), which is where a row's area,
  first move and position live.
- **If a sentence tells the reader to go look at a file, generate the table
  under it from that file.**
- Docs and source cite `TODO.md` sections by title, `todo/` and `mechanisms/` by
  filename, and `ideas/` by `<folder>/<filename>` — grep before renaming, and
  before moving a proposal between folders.
- **A diagram is a `.dot` in a `diagrams/` directory with its `.svg` committed
  beside it** — `pnpm diagrams` renders it, `pnpm diagrams:check` fails on a
  source edited without a re-render or a diagram no doc embeds. A fenced `dot`
  block renders nowhere and is not a diagram.
- Why any of this is shaped the way it is, stated for a reader outside this
  repo: [mechanisms/generated-claims.md](mechanisms/generated-claims.md).

## Third parties: say what we chose, not how they rank

These files are public. Justify a default by what it does for us, not by a claim
about the alternative. A real limitation stays, as does an outage we hit.

## Definition of done

**`pnpm verify`**, **`pnpm test-related`**, a browser test if UI behavior
changed. Snapshots only after a visually verified change. **Then commit.** Don't
push or open a PR unless asked.

What each of those two runs over, and the `jbrowse-web` project neither of them
touches, is `CLAUDE.md` § Tooling.

**Three CI jobs are gated by none of that**: `pnpm check-docs`, `pnpm build:esm`
and type-aware lint of files the change did not touch. `pnpm verify --full` runs
the first two and **`--all` is what runs the third** — `--full` still scopes
both linters to the changed files, so a change to a widely-read type lands green
and reds the tree. A validator that cannot import is not one that passed —
`check-docs` reports ERR_MODULE_NOT_FOUND as a failure with no detail, so read
the body, not the tally.

- **`pnpm typecheck` does not see declaration emit.** A named type reaching a
  `.d.ts` through a volatile or an inferred return is TS4058 — "cannot be named"
  — and only `build:esm` raises it. Run `build:esm` after anything that adds a
  type to an exported surface.
- **oxlint and eslint are different rule sets**, and verify runs both.
  Neither covers `products/jbrowse-desktop/test/`, so a change there is
  typechecked or nothing.
