---
name: a-createembeddedsessionmodel-view-tracksmixin-factory
description: A `createEmbeddedSessionModel({ view, tracksMixin, … })` factory
area: config-and-mst
---

# A `createEmbeddedSessionModel({ view, tracksMixin, … })` factory

for the
two single-view embedded products — measured 2026-08-16 and declined, in
favour of the `EmbeddedSessionMixin` that shipped instead. The circular- and
linear-genome-view session models are ~140 lines each and differ in four
places, so parameterizing the differences is the obvious shape. **It cannot be
typed.** `types.compose`'s overloads are declared over
`IModelType<P, O, FC, FS>`; a model passed in as a naked type parameter has
nothing to infer those four from, so the composed result degrades until
`session.view` is **`any`** — and `any` is the one failure that leaves tsc,
jest and lint green while switching off checking at every embedder call site.
Three shapes were tried (trailing `.props()`, the prop inside a
`types.model()` argument the way `createEmbeddedRootModel` takes its session,
and widening the tracks mixin); all three produced `any`, so the placement is
not the variable — passing a model type as a generic to `compose` is. What
works is keeping every argument to `compose` concrete: the shared part is a
mixin the product composes, and each product still spells out its own tracks
mixin, `view` prop, and the `views`/`addView`/`removeView` members that read
`self.view`. Pinned now by `AssertNotAny<IsAny<ViewModel['session']['view']>>`
in each product's `createModel.ts`, so a retry fails loudly instead of
silently. Note `createEmbeddedRootModel`'s own `SESSION` generic **is** fine —
measured, not assumed — which is what makes the factory look safe.
