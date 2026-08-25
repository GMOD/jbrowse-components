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

The table below is generated from each doc's `description:` frontmatter by
`website/scripts/generate-doc-indexes.ts`, and `pnpm autogen --check` fails on a
doc that carries none. Don't edit between the markers; write the doc's
`description:` instead.

<!-- BEGIN GENERATED HANDOFFS INDEX -->

| Doc | What it is waiting on |
| --- | --- |
| [release-validation-by-sampling](release-validation-by-sampling.md) | 12,714 commits and 426k lines of source churn since v4.3.0 is past the size where reviewing the change is a plan at all, so confidence has to come from sampling units and extrapolating. The pilot and four units are done, the tooling has a home, and every unit so far came back thin — what is left is seven more random draws and a one-page spec for the top three concepts — the deleted-file walk is done and came back nearly clean. |
| [rnaseq-deferred-items](rnaseq-deferred-items.md) | What the RNA-seq splice thread deliberately did not build — six deferred or declined items — plus the one thing it left unfinished: the new tutorial section has no figure, and capturing one needs a junction BED hosted first. Delete once the figure exists and the deferred list has moved to TODO.md or been declined outright. |
| [sv-core-breakend-audit-remainder](sv-core-breakend-audit-remainder.md) | Three findings from the sv-core breakend audit are fixed and revert-checked on an unlanded branch — the paired-adapter junction gap, the STAR-Fusion colon triple and the refName-case grouping bug, the last now SETTLED against the real COLO829 VCF rather than inferred — and what is left is landing the branch and one out-of-scope line in SpreadsheetModel that is the only place the outward breakend walk is fully fixable. |
| [synteny-roundtrip-tours](SYNTENY_ROUNDTRIP_TOURS.md) | Two written, unfilmed tours on branch `synteny-roundtrip-tours` — `synteny/ecoli_roundtrip` (one selection offers graph and stack, stack re-anchored from the Sakai row, graph cut from the stack's K12 row) and `synteny/maf_row_synteny` (a MAF drag launching K12 vs NCTC86) — with their `<Video>` embeds in pangenome_ecoli.md. Film, push media, commit media.lock; then the graph plugin's unpublished row-aware `connectedViewId` fix. |
| [tutorial-tours-handoff](TUTORIAL_TOURS.md) | Live state of the tutorial video-tour thread — which candidates are filmed, which of the untoured pages are ruled out and why, and the two things about desktop and same-tab navigation that nobody should re-derive. Read before filming a tour; delete when the tutorial list is worked down. |
<!-- END GENERATED HANDOFFS INDEX -->
