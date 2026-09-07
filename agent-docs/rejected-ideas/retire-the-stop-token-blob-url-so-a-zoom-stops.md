---
name: retire-the-stop-token-blob-url-so-a-zoom-stops
description: Retire the stop-token blob URL, so a zoom stops minting one per fetch rotation
area: performance-and-measurement
---

# Retire the stop-token blob URL, so a zoom stops minting one per fetch rotation

sized and declined 2026-08-30, by the count
`ideas/zoom-perf-followups.md` prescribed doing first. The profile books ~100ms
of main-thread self time to `createObjectURL` on a ~7s gesture, which is worth
chasing only if the mints are numerous. They are not: a 20-frame zoom over four
tracks mints **8**, counted by installing a `URL.createObjectURL` — jsdom has
none, so every token under jest is otherwise a `nanoid` and the browser branch
never runs. `products/jbrowse-web/src/tests/ZoomStopTokenMints.test.tsx` is the
count. An earlier spy on the module export agreed at 8, but that is
corroboration the test itself distrusts and the tree no longer carries: a
namespace spy sees only the callers that go through the namespace, which is why
the shipped count patches the primitive instead.

The rate is per fetch ROUND, not per frame, so jsdom's round count is not the
browser's — but the conclusion does not depend on getting that right. Even
extrapolating to a few hundred mints a gesture puts `URL.createObjectURL` at
0.3ms a call, and at the measured rate it is 12ms; a registry insert is neither.
So the ~100ms frame is not the mint, and the `syncProbe` opt-in that file
designs — an enumerated call-site list, a rotation option, ~27 probe-dependent
sites to audit — buys whatever the sampler is really folding into that frame,
which is unknown. Measure what the frame contains before designing against it.
