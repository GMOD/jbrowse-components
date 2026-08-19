---
name: hic
description: A user-draggable color threshold, an A/B compartment log-ratio mode, and a chromosome-pair selector for inter-chromosomal contacts — which nothing detects today, contrary to what this doc used to claim.
---

# Hi-C

**User-adjustable color threshold.** A draggable slider on the HiC color legend (like
Juicebox) so users set the saturation threshold manually; store as a
`colorThresholdMultiplier` override. The 95th-percentile auto-scale is a good default
but some datasets benefit from manual tuning.

**A/B compartment ratio mode.** A÷B log-ratio display (diverging red/blue) when a
control/background map is loaded — needs a second `hicLocation` and `RatioColorScale`
logic.

**Inter-chromosomal UI.** A chromosome-pair selector (chr1 × chr2) for navigating
inter-chromosomal contact blocks without hand-building a multi-region view.
Corrected 2026-08-13, because the earlier version of this entry made it sound
nearly free: **nothing detects whether a file has inter-chromosomal data.**
`getHeader` returns `{ norms, resolutions }` and `setup` parses only
`chromosomes`/`resolutions`, so there is no `hasInterChromosomalData` to surface
— detecting it is part of the work, not a prerequisite already met. The half
that *is* in place is the fetch shape: `getMultiRegionContactRecords` already
returns `pairs: RegionPairRun[]` describing which region pair each stretch of
`bin1`/`bin2` came from, so an off-diagonal block is expressible without
touching the contact-record path.
