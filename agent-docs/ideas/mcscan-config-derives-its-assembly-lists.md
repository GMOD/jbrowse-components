---
name: mcscan-config-derives-its-assembly-lists
description: An MCScan track config states the same assembly list three times (track assemblyNames, adapter assemblyNames, blockAssemblies) plus a positional bedLocations array — at 47 genomes the tutorial gives up printing it, and every table tutorial carries an ordering warning. Default the adapter lists from the track's, or take a per-column {assembly, bed} object, so the order exists once.
---

# The MCScan config derives its assembly lists

Not committed work. A multi-genome `SyntenyTrack` over `MCScanBlocksAdapter`
states its genome list three times — the track's `assemblyNames`, the
adapter's `assemblyNames`, and `blockAssemblies` naming the table's columns —
plus `bedLocations`, a fourth list that must run in the same order. The
gene-symbol tutorials are the evidence this outgrew hand-authoring: the 8-way
primate config is half a page of names, the 47-way page cuts its listing to
the first four columns "for the page", and every table tutorial carries an
ordering warning ("in the order the helper printed";
`orthofinder_synteny.md` documents the mismatch error a wrong order raises).

Two shapes, either of which leaves the order stated once:

- **Default the adapter's lists from the track's.** `blockAssemblies` and the
  adapter `assemblyNames` default to the track's `assemblyNames` when absent,
  keeping `bedLocations` positional against that one list. Cheapest, and the
  common case (columns are exactly the track's genomes, in order) becomes zero
  repetition.
- **A per-column object**: `columns: [{ assembly, bed }, ...]` replacing
  `blockAssemblies` + `bedLocations`, so a column's name and its BED cannot
  drift apart positionally. More honest, but a new adapter schema shape — and
  the v5 no-migrations stance means the old keys stay accepted, so it is an
  addition, not a swap.

Either way the tutorials' generated config fences shrink and the ordering
warnings can go. Constraint to check first: the multi-copy convention
(`multiway-synteny-lgv-track.md` §"Multi-copy lanes") names one assembly in
two columns (`peach`, `peach01b`→`peach`), so a derivation must not forbid a
column list longer than the track's assembly list.
