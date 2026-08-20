---
status: Accepted
summary: "Per-region streamed upload is one autorun over the map plus a reference diff, not an autorun per key"
---

# ADR-078: One upload autorun and a diff, not an autorun per key

## Status

Accepted, superseding [ADR-017](adr-017-wiggle-per-key-autoruns.md), whose
"Revisit if" clause fired.

## Context

ADR-017 rejected the whole-map upload callback on one measurement: iterating the
map inside the callback makes MobX track every entry, so each
`rpcDataMap.set(key, data)` re-fires the callback and re-uploads all N entries —
1+2+…+N uploads for N regions arriving one at a time, 300 instead of 24 on a
whole-genome wiggle track. Its answer was one autorun per key, so a new region
wakes only its own.

**That premise describes a loop with no memory of what it already uploaded.**
`createRegionUploadSync` gave the tree one: it holds the last payload uploaded
per region and skips a region whose payload is reference-identical. Canvas and
alignments — the displays ADR-017 named as disqualified, because their
per-region data comes from a whole-map computed — have run on it since, and get
one upload per arrival. The autorun still re-fires N times; the *uploads* are
what stopped being quadratic, and uploads were the cost.

What the per-key autoruns still carried alone was encode invalidation. Encode
ran inside the per-key autorun, so any observable it read re-encoded every
region — correct for `gpuProps()`, and a trap for anything wider, which
`render-core/CLAUDE.md` documented as a rule to remember rather than something
the code could enforce.

## Decision

One upload autorun over the whole map, with two reference diffs under it:

- a region **re-encodes** when its own map entry is replaced, or when the
  display's declared `inputs` change identity;
- a region **re-uploads** when its encoded payload changes, through
  `createRegionUploadSync` — the same diff the rest of the tree already used.

The display declares what its encode depends on instead of reading it:

```ts
installPerRegionLifecycle(self, self.rpcDataMap, backend, {
  inputs: () => self.gpuProps(),
  encode: buildSourceRenderData,
  render: (b, encoded) => b.renderBlocks(self.renderBlocks, encoded, state),
})
```

`inputs` is memoized inside the helper as a computed, because a display's
inputs getter builds a fresh object on each call (`gpuProps()` does) and its
*identity* is what re-encodes every region. Memoized, that identity changes when
what `inputs` reads changes, which is the invalidation the display means.

## Consequences

- **Uploads and encodes both stay O(1) per arrival**, and the quadratic term
  that remains is N map lookups per arrival — 576 `Map.get`s over a whole-genome
  load, against the 576 GPU uploads ADR-017 was avoiding.
- **A wide read inside `encode` is no longer a performance cliff.** It is still
  tracked, so it re-runs the diff, which finds nothing changed and encodes
  nothing. Getting `inputs` wrong is now the only way to rebuild every region,
  and `inputs` is one declaration per display rather than a property of a
  closure. `installPerRegionLifecycle.test.ts` pins both halves.
- **A region arrival stops painting twice**, which is why
  `reference/ARCHITECTURAL_LIMITS.md` §"A region arrival draws twice" shrank to
  what is still unexplained. An `autorun` created inside a running reaction is
  *scheduled*, not run inline, so the per-key autorun that owned the upload could
  never run in the pass that spawned it: a render callback observing the map
  painted the pre-upload state, and the real state followed on the `renderTick`
  bump. Uploading inside the upload autorun's own run closes that window.
  `uploadOrder.test.ts` pins the order for both the direct read and the computed
  chain.
- **A context-loss recovery re-uploads without re-encoding.** Only the GPU
  buffers were lost; the encoded payloads are still good, and the backend-identity
  check in `createRegionUploadSync` is what notices.
- **Fewer subscriptions.** N per-key autoruns each tracked whatever `gpuProps()`
  read; one computed does now.
- The helper no longer needs `renderNow` or a `try`/`catch` of its own —
  `RenderLifecycleMixin`'s upload autorun already bumps the tick after the
  callback and routes a throw to `renderError`. One consequence is coarser: an
  `encode` that throws for one region abandons that whole upload run rather than
  that one region. Both end at the same error banner.

## Rejected alternatives

**Compare `inputs` structurally instead of memoizing it.** Would let a display
hand back a fresh object per call with no computed, at the cost of a deep
compare per upload run and a silent dependence on what "equal" means for a
payload holding typed arrays. The computed states the dependency in the same
place MobX already reads it.

**Keep both mechanisms, per-key for pure encodes and the diff for whole-map
computeds.** That is the state this ADR ends, and the choice between them had
become historical rather than technical: the diff serves both, and "which of
these does my display want" was a question with no answer a new display could
work out from its own shape.

## Revisit if

- A display appears whose regions are so expensive to encode that re-encoding
  all of them on an `inputs` change is the bottleneck, and whose `inputs`
  genuinely differ per region. The helper would then need a per-region inputs
  key rather than one shared identity — a real extension, not a return to
  per-key autoruns.
