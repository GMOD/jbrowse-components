# Agent documentation

Top level is exactly `ARCHITECTURE.md`, `TODO.md` and this file. Everything else
is filed:

- `reference/` — settled: how a subsystem works, how to operate it, a
  measurement, the datasets behind the figures.
- `mechanisms/` — a technique stated so it travels: the idea is the subject
  and this repo's code is the evidence. Built and load-bearing, never proposed;
  the filename is the `name:` slug, and
  [mechanisms/README.md](mechanisms/README.md) carries the admission test.
- `ideas/` — a proposal parked, one per file.
- `architecture-decision-records/` — *why*, one per file.
- `handoffs/` — live state of an unfinished thread, usually a review whose
  findings nobody has committed to. **Pointers, not content.** Delete when the
  thread lands.
- Tried and declined → `reference/REJECTED_IDEAS.md`.
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
proposals: 34 entries moved there on 2026-08-26 for missing the v5.0.0 bar, each
saying so at its top. `mechanisms/` vs `reference/` is which one is the subject: a
doc that cannot name its idea without naming the plugin is a subsystem writeup,
and a mechanism doc points at that writeup for the depth rather than restating
it.

**A handoff is the one file here whose subject is still moving, so it goes stale
faster than anything else** — its state snapshots drift, and the reference doc it
points at overtakes it. Close a thread by filing its remainder into the homes
above and deleting the file, in the same pass; a *worked proposal* left inside a
handoff is the commonest way that fails, and it belongs in `ideas/`, one per file.
Eight existed on 2026-08-19 and seven closed once their remainder was filed;
several had already drifted — a stale count, a seam marked untouched that a
reference doc had since measured, a subject rewritten out from under the file.

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
above already disagreed with its own column.

**The marker goes after the value with no space in the pair**, which is why an
inline figure reads `203KB` and the table reads `203 KB`. A markdown line that
begins `<!--` is an HTML block and ends the paragraph around it, so the figure
and its reference have to be one token no rewrap can split.

The prose around those tables is checked too, by `check-quoted-figures.ts`:
every `<number><unit>` a public measurement page writes has to appear in an
agent-doc **that page links**, or in the JSDoc of an **exported symbol it
names**. So a figure quoted from here needs the link to here, and an unlinked
one fails. Scoping to what the page cites is what makes that worth running —
searching all of source instead admitted 73 of the 101 integer percentages
(2026-08-17), which is most typos.

**Both ends of a range are checked**, so re-measuring `70-90%` means updating
both. That was silently false until 2026-08-17; `quotedFigures.test.ts` pins it
now.

Same discipline for the v5 manuscript's strategy table, which states the same
set at a higher altitude and has no generator reaching it: three copies of a
number is two chances to be the stale one, and it was — the CRAM arena figure
sat at a pre-ADR-0010 value there while `cram-js` had moved on.

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
- Docs and source cite `TODO.md` sections by title, and `todo/`, `ideas/` and
  `mechanisms/` by filename — grep before renaming.
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

Typecheck the touched packages, **`pnpm test-related`**, a browser test if UI
behavior changed, `pnpm lint --fix`. Snapshots only after a visually verified
change. **Then commit.** Don't push or open a PR unless asked.

**`pnpm test <path>` is the wrong scope, and it is the one that keeps failing.**
It selects by PATH, so it runs the suites that live beside a change and none of
the ones that exercise it from outside — and the suites that exercise a plugin
from outside are nearly all in `products/jbrowse-web`. Three of them went red on
main in one week that way, each broken by a change whose own tests moved with
it: a config-slot removal staled `ConfigSlotDefaults.test.ts`, a menu group
becoming a submenu broke `AlignmentsFilters.test.tsx`, and a new scalebar
caption staled `ReversedRegionLabels.test.tsx`. `pnpm test plugins/alignments`
is green across all three.

`test-related` walks the module GRAPH (`jest --findRelatedTests`) over the files
this branch changed, so an integration suite that imports the app — and so,
transitively, the changed file — is included. It names all three above. On this
plugin it is ~320 suites and about seven minutes, against a full run's ~50.

**Five CI jobs are gated by none of that**: `pnpm check-format`, `pnpm
check-docs`, `typos`, `pnpm build:esm` and `pnpm lint:eslint`. A validator that
cannot import is not one that passed — `check-docs` reports ERR_MODULE_NOT_FOUND
as a failure with no detail, so read the body, not the tally.

The last two were added on 2026-08-22, when both went red on main in the same
afternoon and neither was noticed by the agent that broke it:

- **`pnpm typecheck` does not see declaration emit.** A named type reaching a
  `.d.ts` through a volatile or an inferred return is TS4058 — "cannot be named"
  — and only `build:esm` raises it. `d3cd139c52` left main unbuildable that way
  for hours; `2d14c17b37` and `a438d86fcd` are two agents fixing it
  independently. Run `build:esm` after anything that adds a type to an exported
  surface.
- **`pnpm lint` is oxlint, and `lint:eslint` is a different rule set.** Six
  load-bearing `import type {}` statements passed oxlint and failed
  `unicorn/require-module-specifiers` (`8e56c5c01a`, fixed in `4107506779`).
  Neither linter covers `products/jbrowse-desktop/test/` at all, so a change
  there is typechecked or nothing.
