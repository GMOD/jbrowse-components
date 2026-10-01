---
name: scales-and-colour-keys
description: "What the 2026-09-26 scales.y and colour-key round left open: the wiggle figures the clip-strip reshoot (ADR-183) declined to publish."
---

## Open

The 2026-09-30 reshoot published every wiggle-bearing figure not reshot since
433d207ff4 whose plot changed. These did not go out, because the new capture
shows something other than the strip:

- **`maf_470way`**: the key is now a 0-100% identity ramp while the cells
  still draw two categorical colours.
- **`jbrowse-img/skbr3_session`**: `domainQuantile: 0.99` on a point mark
  now reads ~350 where it read ~220, flattening the karyotype.
- **`genomes_basics/promoter_regulation`**: the second frame shows the
  overlapping plot again, so the Multi-row XY choice no longer lands.
- **`jbrowse-img/remote_files`** and **`jbrowse-img/1`**: ClinVar draws
  unlabelled stacks and the gene descriptions are gone, both off the strip's
  subject; confirm they are intended before publishing.
