---
name: rnaseq-deferred-items
description: What the RNA-seq splice thread deliberately did not build — six deferred or declined items — plus the one thing it left unfinished: the new tutorial section has no figure, and capturing one needs a junction BED hosted first. Delete once the figure exists and the deferred list has moved to TODO.md or been declined outright.
---

# RNA-seq splice thread: what it did not build

The work that landed is `c39ae756e7`, `7065b2132e`, `6199ddb914`, `aba8995204`
and `bc04116182` — the spliced-reads filter, spliced-first layout, splice-motif
classification with `hideNonCanonicalJunctions`, and the tutorial section on
junction files as BED arcs.

## Deferred, unstarted

- Mirrored ± coverage band — **declined**.
- Splice-chain group-by — waits for a feature request.
- Table-join / numeric-ramp for differential transcript usage.
- Downsampling.
- Sashimi label-as-fraction, and a depth-proof floor.
- Strandedness auto-detect chip.

## The one loose end

**The new tutorial section has no figure.** Capturing one needs a hosted
junction BED, which means a `scripts/build_*.sh` plus `scripts/deploy-demo.sh`
— never `aws s3 cp`, which does no versioning. Neither was run.
