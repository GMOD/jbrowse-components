---
name: read-time-binning-for-synteny-pif
description: Read-time binning for synteny/PIF
area: performance-and-measurement
---

# Read-time binning for synteny/PIF

—
[ADR-039](../architecture-decision-records/adr-039-synteny-no-read-time-binning.md).
`pif.getLines` fetches every line and `parsePifLine` runs per-line before any
feature exists, so fetch+parse *are* the wait and binning is downstream of
both. Also: no cap/regionTooLarge gate on synteny — whole-genome overview is
the point. Lever is a precomputed binned tier in `make-pif`, deferred.
