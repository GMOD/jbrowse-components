---
name: derivative-allele-thread
description: Live state of the multihop / derivative-allele review thread — what landed 2026-08-25, the one check left red by someone else, and the two things still open. Delete once check-docs is green and the pluggable-element lineage question is answered.
---

# Derivative-allele thread, 2026-08-25

Everything below is landed and pushed unless marked otherwise. Read
[reference/SV_MULTIHOP.md](../reference/SV_MULTIHOP.md) and
[mechanisms/derivative-allele-candidates.md](../mechanisms/derivative-allele-candidates.md)
first; this file is pointers only.

## Landed

- `c7802817ad` — `fetchPrimaryAlignment` picked a *mate* for the primary
  (shared QNAME, overlapping, sorts first). Pair-role check added.
- `f9ec1ac48b` — a route that is a contiguous run of a longer one gets
  `partOf`; the picker says "part of a longer route in this list".
- `5ccf08b6ca` — paired-end chain test (the pair partition had no fixture).
- `8db661cd9d` — minus-strand junction list read 3'→5'; `splitReadJunctions`.
- `3073b0b0a9` — `sv_multihop.py`'s dedup is a leader sweep, not single
  linkage, and its chaining IS checked. Both docs said otherwise.
- `6bbc8c38a2` — SA-locus fallback capped at 16 (943-entry ngmlr records
  exist); SA refName canonicalized before the RPC.
- `accb076b71` — GRIDSS `BEID` / Esvee `ASMID` break a tie in
  `nextJunctionFrom`. **Synthetic test only — no such callset is in the tree.**
- `bc04116182` — the picker over assembly contigs
  ([ideas/derivative-allele-from-assembly-contigs](../ideas/derivative-allele-from-assembly-contigs.md)).

## Open

1. **`pnpm check-docs` is red on main and it is not this thread's.**
   `website/docs/user_guides/linear_synteny_view.md:100` duplicates a link
   title, from `40e3f5769a` (synteny-launch). `bc04116182` was pushed with
   `SKIP_DOCS_CHECK=1` for that reason. One-line fix: reuse the target title
   with `[](/docs/user_guides/maf_track)`.
2. **Pluggable-element subtypes inherit no extensions.** A display built from
   another's state-model factory (`LGVSyntenyDisplay` from
   `LinearAlignmentsDisplay`, `LinearVariantDisplay` from the canvas base) gets
   the base's getters and none of its menu items, because `extendDisplayType`
   matches `element.name` exactly. Today that costs a second
   `addDisplayMenuItems` call per subtype. Designed but NOT built: an optional
   `extendsType` on `PluggableElementBase` that the extend helpers walk, plus a
   dev-mode check that flags an undeclared lineage — `types.compose` preserves
   the base's property objects by identity, so "this model composes that one" is
   detectable rather than heuristic (verified). Out-of-tree plugins hit the same
   thing from the other side: every one surveyed in `~/src/jb2plugins` hand-rolls
   `isDisplay(elt) { return elt.name === 'LinearBasicDisplay' }` and then filters
   on `feature.get('type')`, so several would rather say "any canvas-family
   display" than name one.
3. **The PIF query-name index**, which is what would let a contig's chain reach
   blocks outside the displayed regions. Parked in the idea doc.
