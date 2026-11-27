---
name: read-downsampling-for-a-force-loaded-dense-region
description: A reader who force-loads past the byte gate gets one GPU instance per read with no per-column cap, so a whole-chromosome BAM runs into the GPU-OOM overlay; capping reads per column would make it survivable, but no user has asked.
---

# Read downsampling for a force-loaded dense region

Past the byte gate a BAM shows the banner
([REGION_TOO_LARGE.md](../../reference/REGION_TOO_LARGE.md)); a coverage
bigWig loaded as its own track is the wide-zoom picture, since the density tier
that drew one in the banner's place was removed (ADR-102). What is left is a
reader who force-loads anyway. The pileup uploads one GPU instance per read,
per mismatch and per gap, and `executeRenderAlignmentData` has no per-column
cap: a 30x whole-chromosome BAM is ~29 M reads, over 1 GiB in the read pass
alone, with the GPU-OOM overlay as the backstop.

- Capping reads per column, reservoir-sampled per bin, is what would make
  force-load survivable. A sampled pileup's apparent depth is wrong and nothing
  in the chrome would say so, so the chrome needs deciding before the fetch.
- A BAM with no sidecar has two more paths. A coverage-only mode above a zoom
  threshold would skip the pileup and mismatch passes; `showPileup` hides the
  pileup on the main thread and never reaches the RPC, so the reads are fetched
  either way. The byte gate would also have to let that coverage-only fetch
  through, since it refuses on the reads' bytes.
