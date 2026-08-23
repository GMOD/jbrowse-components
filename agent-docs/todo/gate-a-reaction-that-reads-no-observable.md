---
name: gate-a-reaction-that-reads-no-observable
description: MobX's `reactionRequiresObservable` is one line in the jest setup and, measured on 2026-08-23, every reaction in render-core and BaseLinearDisplay is clean under it; the three hits are constant getters, and routing the warning into the contract gate needs a way to exempt those
metadata:
  area: tests
  category: ready
---

# Gate a reaction that reads no observable

The failure the fetch docs keep describing — an autorun that "settles into a
state nothing will wake it from" — has a MobX flag that catches its extreme
case at runtime: `configure({ reactionRequiresObservable: true })` warns
whenever a derivation is created or updated with an empty dependency set. No
`configure` call exists anywhere in the app or the jest setup today.

Measured on 2026-08-23 over `packages/render-core` and
`plugins/linear-genome-view/src/BaseLinearDisplay` (65 suites, 1054 tests) with
the flag in a throwaway `setupFilesAfterEnv`: **no reaction warned.** The 64
warnings were all computeds that read nothing by design —
`installGlobalFetchAutorun.test.ts`'s fixture `dataCurrent` / `fetchSignature`
(constant getters on a synthetic display) and `RenderLifecycleMixin`'s
`canRender` default (`true`, overridden by the LGV mixins).

So the flag is cheap and currently clean, and what stops it going in is the
channel: a `console.warn` nobody reads guards nothing, and the
`[jbrowse display contract]` gate only fails a test on `console.error`. Adopting
it means routing the warning into that gate and exempting the constant getters
— either by giving them an observable to read (which `canRender` should not
need) or by matching on the derivation name. The
`reactionDependencies` helper (`@jbrowse/render-core/namedReactions`) covers the
per-state version of the same property for the installers that matter, so this
is the broad, cheap net over the ~45 autoruns that go through no installer.
