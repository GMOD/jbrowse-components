# Agent documentation

Top level is exactly `ARCHITECTURE.md`, `TODO.md` and this file. Everything else
is filed:

- `reference/` — settled: how a subsystem works, how to operate it, a
  measurement, the datasets behind the figures.
- `ideas/` — a proposal parked, one per file.
- `architecture-decision-records/` — *why*, one per file.
- `handoffs/` — live state of an unfinished thread. **Pointers, not content.**
  Delete when the thread lands.
- Tried and declined → `reference/REJECTED_IDEAS.md`.
- Work someone intends to do → `TODO.md`, in the order to take it.
- What a session did and which commits → **git already holds it.**

That last one applies to `CLAUDE.md` files too and is the rule they break most.
"State as of \<date\>" outside `handoffs/` means split it into the homes above.

`TODO.md` vs `ideas/` is commitment, not size. Read a parked proposal before
re-proposing it.

**A perf measurement has a public reader as well as this one.**
`website/docs/developer_guides/optimizations.md` digests what is in `reference/`
— including the results that came out negative, which is most of its value. The
`reference/` doc stays the record, so a new number lands here first.

**Publish the table, don't retype it.** Tag it `<!-- measurement: <id> -->` and
put `<!-- BEGIN GENERATED MEASUREMENT <id> -->` / `END` on the public page;
`pnpm autogen` fills it and `--check` fails on drift. The table travels whole —
there is no row or column filter, deliberately, so where one reads badly in
public fix the header here. Both directions are errors: a block naming no
measurement, and a tagged table no page publishes. **The publishing page must
also link this doc**, or the reader gets a table and no measurement.

The prose around those tables is checked too, by `check-quoted-figures.ts`:
every `<number><unit>` a public measurement page writes has to appear in an
agent-doc **that page links**, or in the JSDoc of an **exported symbol it
names**. So a figure quoted from here needs the link to here, and an unlinked
one fails. Scoping to what the page cites is what makes that worth running —
against all of source the check admitted 73 of the 101 integer percentages,
which is most typos.

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
  docs through [reference/README.md](reference/README.md) /
  [ideas/README.md](ideas/README.md), not `ls`.
- Those indexes and every `<!-- NAME START/END -->` block are generated; don't
  hand-edit between the markers.
- **If a sentence tells the reader to go look at a file, generate the table
  under it from that file.**
- Docs and source cite `TODO.md` sections by title and `ideas/` by filename —
  grep before renaming.

## Third parties: say what we chose, not how they rank

These files are public. Justify a default by what it does for us, not by a claim
about the alternative. A real limitation stays, as does an outage we hit.

## Definition of done

Typecheck the touched packages, `pnpm test <path>`, a browser test if UI
behavior changed, `pnpm lint --fix`. Snapshots only after a visually verified
change. **Then commit.** Don't push or open a PR unless asked.

**Three CI jobs are gated by none of that**: `pnpm check-format`, `pnpm
check-docs`, `typos`. A validator that cannot import is not one that passed —
`check-docs` reports ERR_MODULE_NOT_FOUND as a failure with no detail, so read
the body, not the tally.
