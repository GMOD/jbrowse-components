---
name: handoffs-index
description: Index of every live thread in handoffs/, with what each one is still waiting on. Read before starting a review or an audit of a subsystem one of them already covers, and before re-reviewing anything a closed thread settled.
---

# Handoffs index

A handoff is the live state of an **unfinished** thread — most often a review or
an audit whose findings nobody has committed to yet. It holds pointers, not
content, and it gets **deleted** when the thread lands.

**Everything a handoff finds has a permanent home somewhere else**, and a handoff
that outlives its thread is a stale copy of one:

| what it is | where it goes |
| --- | --- |
| a worked proposal, not yet started | [ideas/](../ideas/README.md), one file each |
| work someone intends to do | [TODO.md](../TODO.md) |
| a measurement, or how a subsystem works | [reference/](../reference/README.md) |
| tried and declined | [reference/REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md) |
| what a session did, and which commits | git already holds it |

So a thread is closed by filing its remainder into those and removing the file,
not by letting it accumulate. Eight existed on 2026-08-19 and all eight closed
that way the same day, several having already drifted against the docs that
overtook them — a handoff is the fastest agent-doc to go stale, because it is
the only one whose subject is still moving. **The directory being empty is the
normal state**, not a sign the index is broken.

The commonest thing a stale handoff turns out to be holding is a **worked
proposal**, which belongs in `ideas/` where the index will surface it. Four of
the eight closed by moving one, and one of them by moving five — the v5.0.0
release triage, whose thirteen open findings split into six fixed outright, six
parked as ideas (`refname-mismatch-warning-visibility`,
`credential-aware-chunk-cache`, `url-params-consumed-but-not-applied`,
`single-tier-pif-refetches-at-the-threshold`,
`clustering-without-a-named-region`,
`track-y-offset-cannot-see-the-label-box`) and one measurement in
[TODO.md](../TODO.md).

**The second commonest is a reference doc wearing a handoff's clothes.** Four
existed on 2026-08-25 and all four closed, and two of them were mostly settled
material: `per-base-subpixel-bin` became
[reference/PER_BASE_SUBPIXEL_BIN.md](../reference/PER_BASE_SUBPIXEL_BIN.md) plus
one idea and three TODO entries, and `release-validation-by-sampling` became
[reference/RELEASE_VALIDATION_SAMPLING.md](../reference/RELEASE_VALIDATION_SAMPLING.md)
plus two. Two signals that a handoff has stopped being one: it **publishes a
measurement** — `generate-measurement-tables` allows exactly one publisher per
record, so a handoff holding a table is the permanent home of that record until
it moves — and it carries a **fixed protocol** someone is meant to follow again,
which is operating instructions rather than live state.

Two of the four closed by moving nothing at all. `TUTORIAL_TOURS.md`'s three
"nobody should re-derive this" facts were already in
[ideas/tutorial-tour-candidates.md](../ideas/tutorial-tour-candidates.md) and
[ideas/tutorial-tours-from-scratch.md](../ideas/tutorial-tours-from-scratch.md),
and the state it carried was a coverage count its own text says to re-run rather
than read. Check what a handoff duplicates before writing anything: the pointers
it was built from usually absorbed its content while it sat.

The table below is generated from each doc's `description:` frontmatter by
`website/scripts/generate-doc-indexes.ts`, and `pnpm autogen --check` fails on a
doc that carries none. Don't edit between the markers; write the doc's
`description:` instead.

<!-- BEGIN GENERATED HANDOFFS INDEX -->

| Doc | What it is waiting on |
| --- | --- |
<!-- END GENERATED HANDOFFS INDEX -->
