---
name: plugin-extension-points
description: Why the five widget/detail extension points are a bad abstraction, and the registry that would replace them.
---

# Plugin extension points: widget/detail customization

`Core-replaceWidget` and its four siblings (`Core-replaceAbout`,
`Core-extraFeaturePanel`, `Core-extraAboutPanel`, `Core-customizeAbout`) are a
**bad abstraction** — the visible symptom ("applies to every trackId, you filter
by hand") is one of four defects:

- **Dispatch-by-key built as filter-in-a-fold.** Intent is "contribute/pick a
  component *for a track*"; implemented as an unkeyed `reduce` over all
  callbacks, so every consumer re-derives the key (`model.trackId !== 'x'`). The
  framework should own the matching.
- **Fold semantics are wrong for components.** Accumulator-chaining is right for
  *transforming data* (menu arrays, the `customizeAbout` snapshot) but for
  *contributing UI* it means last-loaded-plugin-clobbers-earlier with no
  conflict signal. Proof (historical): the "extra panel" points rendered as a
  *single* `PluggableComponent` slot — two plugins both adding a panel, plugin B
  receives A's component as its `DefaultPanel`; if B forgets to render
  `<DefaultPanel/>`, A silently vanishes, and which wins depends on load order.
  The "add a panel" point can't reliably add two panels.
  **RESOLVED for both panel points:** `Core-extraFeaturePanel` and (2026-07)
  `Core-extraAboutPanel` now accumulate an array (`evaluateExtensionPoint([...])`
  + `.flat().map()`), so panels compose in registration order; a legacy bare
  component is normalized in. The three About points are now typed in the
  registry too. The remaining defects (dispatch-by-key filtering, `trackId`
  fragility, five names for one idea, replace-style clobber) still stand.
- **`trackId` is the most fragile key.** `copyTrackSnapshot` (`TrackMenu.ts:42`)
  rewrites it (`-<timestamp>-sessionTrack`), so the correct filter is a prefix
  regex, not the `===` the docs show first. You key on an id the system mutates.
- **Five points for one idea.** They're crossings of three axes — *surface*
  (feature widget / about dialog), *mode* (replace / augment), *selection*
  (which tracks) — hard-coded into five names instead of one parameterized
  mechanism.

**Reframe that dissolves it: augment and replace are different operations.**
Augment (add a panel) is a `collect` — N plugins each contribute, producer
gathers all matches, renders in order; composes by construction. Replace (be THE
widget) is a `dispatch` — exactly one wins; rare and heavyweight. And the
canonical `replaceWidget` example (`<div>custom</div><DefaultWidget/>`) is *not*
a replace — it's a panel rendered above the default. Nearly every real
`replaceWidget` use is augment-in-disguise; true full-replacement is better
served by registering a real `WidgetType` and selecting it.

**Ideal design — one selector-scoped detail-panel registry with collect
semantics.** Registration is declarative, no manual filtering, composes:

```ts
pluginManager.addDetailPanel({
  surface: 'feature',                  // 'feature' | 'about' (array for both)
  select: { trackType: 'VariantTrack' }, // selector below; omit = all tracks
  position: 'after',                   // 'before' | 'after' built-in sections
  priority: 100,                       // stable tiebreak
  Component: MyPanel,                  // renders own BaseCard chrome
})
```

Producer side (replaces the `PluggableComponent` slot in `FeatureDetails.tsx` /
`AboutDialogContents.tsx`):

```ts
const panels = pm.getDetailPanels({ surface: 'feature', model })
// already filtered by selector, sorted; render ALL
{panels.map(p => <p.Component key={p.id} {...props} />)}
```

Selector = declarative struct + escape hatch; `{ trackId }` runs through a
shared `matchesTrackId` helper (the `-sessionTrack`/timestamp normalization in
*one* place — `makeTrackId.ts` neighbor), so the copy-track footgun disappears
for everyone:

```ts
type TrackSelector =
  | { trackId: string }      // auto-matches session copies
  | { trackType: string }    // the key people actually mean
  | { adapterType: string }
  | { metadata: Record<string, unknown> }
  | ((model) => boolean)     // 1%-case escape hatch
```

This fixes all four defects: matching moves into the framework; collect
semantics so panels coexist with explicit (not load-order) ordering;
`trackType`/declarative selectors rarely touch the fragile id; one registry not
five points. **True replace** demoted to honest cost — register a `WidgetType`,
`select` it, `DrawerWidget.tsx` resolves before the default fallback (reuses the
widget-type registry, not a bespoke wrap chain). **`customizeAbout` stays
separate** — it's a genuine data transform; folding it in would be the same
conflation in reverse.

**Compat is mandatory** (5 public points, plugins in the wild): keep them
evaluating exactly as today and have `getDetailPanels` fold the legacy chain
result in as one more panel — old plugins unchanged, new ones get the registry.
Doable precisely because old behavior is "render one slot."

Downsides: bigger than sugar (new registry + 3 producer rewrites); selector
scope-creep risk (ship `trackId`/`trackType`/predicate only, log+skip unknown
keys). 80/20 fallback if appetite is low: just add `matchesTrackId` + a
`select`-based wrapper over the *existing* points + fix docs — removes the
footguns but keeps the clobber bug for replace-style uses.

**Sample drift bug (fix regardless):** `extension_points.md:514` tells readers
to open `test_data/volvox/umd_plugin.js` and "search for
`TrackSelector-folderDialog`" for a worked example — that file is two empty
no-op plugin classes; the example isn't there (`public/` copy is identical).
`umd_plugin.js` is the natural home for live hand-written examples of these
points.
