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
`reference/` doc stays the record and the public page cites it, so a new number
lands here first and gets a line there in the same pass. Same for the v5
manuscript's strategy table, which states the same set at a higher altitude:
three copies of a number is two chances to be the stale one.

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
