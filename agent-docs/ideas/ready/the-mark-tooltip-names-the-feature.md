---
name: the-mark-tooltip-names-the-feature
description: The mark display's tooltip, the multi-row display's included, names the channels under the cursor and never the feature, since the worker sends no names; a lookup per hover would add it
---

# The mark tooltip names the feature

Left from ADR-249's multi-row swap, which moved the multi-row display onto the
mark display and gave it the mark tooltip.

- `plugins/marks/src/LinearMarkDisplay/components/MarkTooltip.tsx` lists each
  channel's value and its row's label. Hovering a gene prints its color and
  row and leaves out its name.
- The worker ships channels and no records, so no name reaches the main thread.
  `CoreGetEncodedFeature` already finds the feature behind an instance for
  feature details; a hover would make the same call, debounced, and print
  `name` or `id` above the channels.
