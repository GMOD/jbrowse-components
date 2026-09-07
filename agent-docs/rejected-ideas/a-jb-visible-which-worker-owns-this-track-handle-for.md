---
name: a-jb-visible-which-worker-owns-this-track-handle-for
description: A `jb`-visible "which worker owns this track" handle for `jb.getFeatures`
area: tooling-tests-and-docs
---

# A `jb`-visible "which worker owns this track" handle for `jb.getFeatures`

declined 2026-09-06. The id is derivable: a track's
`rpcSessionId` is `adapterConfigCacheKey(adapterConfig)`, a pure function of
the track config, so `jb.getFeatures` computes it and lands on the display's
worker whether or not the track is shown. Nothing needs to name the worker.
