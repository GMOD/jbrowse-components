---
name: feature-details-rerun-a-regions-steps
description: Each feature-details click on a mark display reruns the clicked layer's steps over the region in the worker; measure the click's latency on a big region before caching anything
---

# Feature details rerun a region's steps

Left from ADR-249's multi-row swap.

- `packages/core/src/rpc/methods/CoreGetEncodedFeature.ts` fetches the region
  again and runs the clicked layer's steps to find the row behind
  `featureIndex`. Only that layer runs, and the adapter's caches absorb the
  fetch.
- **First move:** time a click on a multi-row display over a dense region (a
  whole-chromosome GFF). If it stays well under a second, delete this entry;
  if not, the worker could keep the last answer's tables per display.
