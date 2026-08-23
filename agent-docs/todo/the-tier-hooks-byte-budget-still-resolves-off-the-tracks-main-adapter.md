---
name: the-tier-hooks-byte-budget-still-resolves-off-the-tracks-main-adapter
description: inert today; the fix is the hook carrying a config node, not a snapshot read
metadata:
  area: region-too-large
  category: ready
---

# The tier hook's byte budget still resolves off the track's main adapter

`adapterFetchSizeLimit` reads `['adapter','fetchSizeLimit']` off the track
config even when `byteGateAdapterConfig` points the measurement at a
sub-adapter (MAF's summary tier), so a sub-adapter that declared its own limit
would be gated against the wrong number. Inert today — the adapters declaring
the slot are Bam/Cram/VcfTabix/SplitVcfTabix and no in-tree tier swap targets
one — and **not fixable from the snapshot**: a resolved snapshot omits slots at
their schema default (the mixin's own `adapterFetchSizeLimit` note), so the fix
is the tier hook carrying its config *node* or its resolved budget alongside
the snapshot, not a `.fetchSizeLimit` read off what it already returns. A
static check cannot close it either — which adapter type sits behind a
`byteGateAdapterConfig` override is a config-time fact.
