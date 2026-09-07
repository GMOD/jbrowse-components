---
name: fetch-keys
description: What invalidates a fetch, an upload and a frame — the `rpcProps()` / `gpuProps()` / `renderState` tiers and their costs, the cache-key and payload-picking rules, derived region maps, the loop trap. Read before adding a field to any of the three.
kind: spec
---

# Fetch, upload and render keys

The three tiers are stated in [ARCHITECTURE.md](../ARCHITECTURE.md#rpcprops--gpuprops-pattern); this is the argument behind each rule there.

## What each tier costs when it moves, and who is zoom-sensitive

The three tiers are not three flavours of the same
thing — they differ by two orders of magnitude in what a change costs:

| tier | a change does | cost |
| --- | --- | --- |
| `rpcProps()` | `settingsFetchInputs` moves -> every loaded region's `fetchInputs` stamp is stale, and `SettingsInvalidate` -> `invalidateSettings()` | refetch every region, drawn stale under the scrim meanwhile |
| `gpuProps()` | the identity `installUpload` compares moves (`p !== lastProps` clears `encodedFrom`, `installUpload.ts:195-198`) | **re-encode every cached region, main thread, no RPC** |
| `renderState` | the render callback re-fires | repaint |

The middle row is the one that surprises, because it is O(cached regions x
features) of main-thread work with nothing on the network to make it visible.
[ADR-016](../architecture-decision-records/adr-016-bicolorpivot-stays-in-worker.md)
is the measurement of exactly that cost, taken when the proposal was to move
wiggle's pos/neg split main-thread-ward; the same accounting applies to anything
that lands in `gpuProps()`.

**Only one `gpuProps()` in the tree is zoom-sensitive at all**, and it is
deliberate: `LinearMafDisplay`'s `binBp` reads `encodeBinBp`
(`plugins/maf/src/LinearMafDisplay/stateModel.ts:1315-1327`), which is
`subPixelBinBp(view.coarseBpPerPx)` — the **debounced** copy, quantized to a
power of two precisely so a gesture does not thrash it
(`subPixelBinBp.ts:19-22`: unquantized, "MAF re-encodes every region on every
wheel tick"). So a sustained zoom can re-encode every cached MAF region, but
only on crossing a power-of-two boundary after the debounce settles. Every other
`gpuProps()` reads session or config state only — none reads live `bpPerPx`,
`offsetPx`, `visibleRegions`, `dynamicBlocks` or hover.

**That is the invariant to preserve.** A per-frame viewport value reaching
`gpuProps()` re-encodes the whole cache mid-gesture, silently, and the profile
blames the encoder rather than the key that let it in.

Two other facts the census turned up, neither a bug:

- **`bicolorPivot` fans out to all three tiers**, which no single comment says.
  `rpcProps()` (the worker owns the avg-path split, ADR-016), `gpuProps()` (the
  whiskers bands are coloured main-thread, and the SVG export calls
  `buildSourceRenderData(data, gpuProps)` directly), and `renderState` as
  `origin` (the shader's bar pivot and density fade). Each hop is commented
  where it happens; the fan-out is only visible from here.
- **Six of fourteen `installUpload` callers pass neither `inputs` nor
  `encode`** — gwas, sequence, `LinearSyntenyViewHelper`, `MultiWaySyntenyDisplay`,
  alignments, the two multi-sample variant displays and dotplot. That is the
  typed no-`encode` overload, not an omission: `cells()` already yields encoded
  data, built by a `computed` upstream (`LinearSyntenyDisplay.computedColors`,
  `DotplotDisplay.computedColors`), so MobX's own map diff limits the re-encode
  instead of `installUpload`'s clear. HiC and LD take a third route — `encode`
  with no `inputs`, keying the colour ramp as its own map entry so only its
  identity change re-encodes it.

## Structural args stay out of `rpcProps()`

`rpcProps()` returns **user-controlled settings only**. Structural args
(`adapterConfig`, `sequenceAdapter`, `region(s)`, `bpPerPx`, `stopToken`) are
spread in at the RPC call site, keeping `rpcProps()` focused on its purpose:
cache keys for `SettingsInvalidate`. Every display follows the same call shape:

```ts
rpcManager.call(sessionId, 'RenderXxxData', {
  adapterConfig: self.adapterConfig,  // inherited from BaseDisplayModel
  regions, bpPerPx,                    // per-call values
  ...self.rpcProps(),                  // user settings (cache keys)
  stopToken, statusCallback,
})
```

`sessionId` belongs in the **first** argument only — `RpcManager.call` injects
it into the payload, and `AssertNoCallLevelFields` fails a registry entry that
declares it in its args. Passing it again in the object is redundant; no call
site does anymore.

`adapterConfig` is provided by `BaseDisplayModel` (via
`getConf(this.parentTrack, 'adapter')`) — a **structural** arg, so it is not in
`rpcProps()`, and its own axis of every fetch key: `FetchMixin.adapterConfigKey`
(`adapterConfigKey` from `@jbrowse/core/util`, the one spelling every fetch
family uses) rides beside `rpcPropsCacheKey` in the global family's
`currentFetchKey`, and inside the per-region family's `settingsFetchInputs`, so a track re-pointed in the config editor
refetches. GC content folds `gcMode` / `windowSize` / `windowDelta` into the
`GCContentAdapter` config its `adapterConfig` getter builds and lists them in
`rpcProps()` as well; both axes now see them, and either alone would do.

**Override it only to change what the adapter *is*, and never to annotate it.**
`dataAdapterCache` keys on the config object (`adapterConfigCacheKey`), so a key
the adapter never reads still forks the cache: the decorating display resolves
its own instance and its own parse of the file, while every plain reader of the
same track — another display type over it, a `CoreGetFeatures` probe behind a
launch dialog — shares a second one, and a key the adapter ignores raises no
error. If a worker-side value genuinely doesn't belong to the adapter, pass it as a sibling
RPC arg, the way `sequenceAdapter` is passed.

`rpcProps()` is the **only** extension point for the RPC payload. Each display
defines its own typed shape; subclasses that layer on fields capture `super` and
spread:

```ts
.views(self => {
  const { rpcProps: superRpcProps } = self
  return {
    rpcProps() {
      return {
        ...superRpcProps(),
        showOnlyGenes: self.showOnlyGenes,
      }
    },
  }
})
```

A zoom-derived worker decision is not an `rpcProps` field: it is the display's
`zoomFetchKey` term and rides the RPC as a call-site argument (canvas's
`effectiveGeneGlyphMode`, alignments' `perBaseBinBp`, the synteny `lodTier`),
so a threshold crossing refetches the regions on screen while they keep
drawing, where an `rpcProps` move runs `SettingsInvalidate`, supersedes the
in-flight fetch and scrims the held data.

`MultiRegionDisplayMixin` does **not** provide a base default — declaring one
would widen the typed return through MST's `.views()` chain and force consumers to
re-spread named fields. The mixin's `SettingsInvalidate` autorun looks up
`rpcProps` dynamically and is installed only when the method exists, so a
per-region display with no settings-driven refetch (e.g.
`LinearReferenceSequenceDisplay`) can simply not define it. HiC and LD compose
`GlobalFetchMixin` rather than MultiRegion, and both *do* define
`rpcProps()`.

## The cache key is the return value, not the reads

Both families invalidate on the payload's **value** — never on the raw call.
The global family serializes it (`serializeRpcProps`, through one getter,
`FetchMixin.rpcPropsCacheKey`, read in `installGlobalFetchAutorun`'s trigger
list); the per-region family holds it in a structural computed
(`settingsFetchInputs`, `display-kit/fetchInputs.ts`) that `SettingsInvalidate`
watches.

The reason is that **building the payload reads far more observables than it
returns**, so tracking the call tracks all of them:

- canvas builds it from a whole config snapshot (`getConfigSnapshotWithPromotables`),
  which reads *every* slot on the display config and on every schema it inherits
  — so a `showLabels`, `heightMode` or compact/normal `displayMode` flip, none of
  which is in the payload, would refetch
- HiC's `activeNormalization` consults `availableNormalizations`, which is
  **fetched** (`CoreGetInfo`) — a read that has nothing to do with user intent

Serializing collapses both: only a change in what's returned invalidates. And it
has to be a string rather than a `.rpcProps()` comparison, because a fresh object
never compares equal.

The inverse hazard, in the global family where `JSON.stringify` *is* the
comparison: a field whose
distinct states serialize identically is a **silently dead cache axis** — changing
it refetches nothing and raises no error. A class instance needs a `toJSON` or it
flattens to `{}` (`SerializableFilterChain` has one, which is what makes the
variant displays' `filters` field a real key), and an `undefined` value drops its
key entirely, so it can't be distinguished from a sibling state that also drops.
Prefer primitives and plain arrays. Regression-tested in
`installGlobalFetchAutorun.test.ts` ("ignores an observable rpcProps() reads but
does not return"), which fails if the trigger goes back to the raw call. The
per-region family's structural compare has neither blind spot — an `undefined`
field and a fieldless class instance are both distinct states there — pinned in
`fetchInputs.test.ts`.

## Pick the payload out of the snapshot; never subtract from it

Serializing fixes *which reads* invalidate. It does nothing about **which slots
are in the payload**, and that is a second, separate hazard for any display whose
`rpcProps()` starts from `getConfigSnapshotWithPromotables`: the snapshot carries
every slot the display's schema *and every schema it inherits* declare, so the
payload's contents are decided by whatever the display does with it.

Do that by picking the slots the worker reads. Canvas's `pickDisplayConfig` copies
exactly the keys its `DisplayConfig` interface declares, off a
`Record<keyof DisplayConfig, true>` — which TypeScript checks exhaustive in **both**
directions with no helper type, erroring on a key the list omits and on a name that
is not a key. That is what makes the list safe to have: it cannot drift from the
interface the worker actually reads through.

The subtractive spelling — snapshot minus a destructured exclusion list — is the
one to avoid, and it is the one you write first. Its failure is silent and
compounding:

- **A slot nobody thought to exclude becomes an RPC cache key.** Canvas's list
  reached ten names, and the expensive one was `height`: the resize handle writes
  it on every drag frame (`TrackContainer` → `resizeHeight` → `setConf`), so
  dragging a track taller re-ran the whole worker pipeline.
- **The names that leak come from a schema in another package.**
  `BaseLinearDisplay`'s schema contributes most of them, so a contributor adding a
  main-thread slot there has no reason to look at a display plugin's `rpcProps()`.
- **The payload type has to be a lie.** A snapshot-minus-exclusions object is a
  superset of the worker's config interface, so it reaches the typed RPC args
  through an `as DisplayConfig` cast — which is exactly the assertion that would
  have caught the extras.

Picking inverts all three. A new worker slot means editing the interface and the
key list together, and forgetting means the feature does not work — which someone
notices. A new main-thread slot means editing neither.

**A slot that is in the payload only to invalidate it gets its own field** —
once the config half is a pick of what the worker reads, anything riding along
for the cache key alone has nowhere left to hide in it. A budget edit reaches the
verdict through tracked reads, so a raw gate slot in the payload buys only a
redundant refetch of regions already loaded and in budget.

## `gpuProps()` and derived region maps — re-upload without refetch

`gpuProps()` exists wherever the main thread encodes the GPU buffer — wiggle,
multi-wiggle and MAF (and GC-content, which inherits wiggle's wholesale). HiC and
multi-LGV synteny fill the same role without the method: HiC's upload callback
reads `self.colorScheme` straight into `generateColorRamp`, and synteny's
`computedColors` getter is its re-upload-without-refetch half. Canvas's worker
emits a color *class* per themed lane and
the main-thread encode resolves classes against `session.palette`, so the
worker holds no palette and a theme change re-encodes. This splits refetch from
re-upload: wiggle color change → re-encode only; `bicolorPivot` change → worker
output differs → `rpcProps()` → refetch.

**Opacity is a render parameter, never a packed color.** Both comparative
displays own a `computedColors` getter — the gpuProps half — and both keep the
plot-wide opacity slider *out* of it: synteny multiplies it in `fillShade`,
dotplot in `dotplot.slang`'s fragment (`color.a * u.alpha`), each fed from the
render state (`SyntenyTrackRenderParams.alpha` / `DotplotRenderState.alpha`) with
a Canvas2D twin so the SVG export matches. Baking it into every packed ABGR
byte turns one drag frame into three full O(n) passes — recompute the colors
array, re-pack every instance, re-upload the buffer — for a value identical on
every instance. **A per-instance array is the wrong
home for a scalar**: if a setting multiplies every element by the same number,
it belongs in the uniform/draw params.

A genuine recolor does still produce a fresh `colors` array over the same
coordinate arrays, and a naive keyed-upload backend re-packs every lane to change
one. The two-line memo that avoids it is a backend concern:
[GPU_RENDERING.md § Upload patterns](GPU_RENDERING.md#upload-patterns),
under "the color-lane patch".

Derived region maps apply when upload needs whole fresh per-region payloads, not
just encoder parameters. Alignments' `laidOutByGroup` returns, per group, shallow
clones of that group's `rpcDataMap` entries with freshly-allocated Y arrays from
main-thread layout (+ connecting-line / Flatbush in chain mode); `sourceSections`
pairs each with its arc feed and is what the upload callback iterates. Raw
`rpcDataMap` is never mutated. Use derived maps
when settings change the shape/contents of per-region data; use `gpuProps()` for
scalars fed to an encoder.

That the raw map is never mutated is also what fixes how it is *represented*:
build it with
[`regionDataMap()`](../../packages/render-core/src/regionDataMap.ts),
which is a **shallow** `observable.map`. An entry that can never change has
nothing for MobX's deep enhancer to observe, so the observable-object graph it
builds per entry on insert — and the proxy hop it adds to every field read — buys
no reactivity at all
([ADR-060](../architecture-decision-records/adr-060-region-data-maps-are-shallow-observable.md)).
Every per-region volatile in tree goes through the helper; writing
`observable.map<number, …>()` by hand is the thing to notice in review.

**A derived map is a tier, so keep its cheap half out of its expensive half.**
Alignments splits the one above in three: `laidOutByGroupUncolored` does row
placement, `laidOutByGroupFramed` applies the chain strand frames, and
`laidOutByGroup` bakes the per-read color arrays over it. Nothing
in the color half can move a read's row, so folding the color settings into the
layout computed makes a recolor re-run placement, every per-feature Y remap and the modification Flatbush to
change two arrays. Split, the layout computed stays memoized across a recolor,
and because the overlay *spreads* its input rather than rebuilding it, `readYs`
survives with it: the GPU renderer reads that identity as "same layout run" and
rewrites the read pass alone (GPU_RENDERING.md, "Whole-map synced: skipping a
region without leaving stale buffers"). The same reasoning applies to any value a derived map
reads but only *sometimes* spends — the band-overhead input to the grouped fit
budget is a thunk for exactly that reason, so band geometry stays out of the
layout computed's dependency set on the ungrouped path.

## Theme-derived render inputs are session getters, not pushed volatiles

Color palettes are a pure function of the active theme, so derive them in a model
getter — `<plugin builder>(getPaletteHost(self).palette)` — that `gpuProps()` /
`renderState` read directly. Do **not** stage them in a volatile that a React
`useEffect` pushes in via a `setColorPalette` action: the effect runs only on
mount, so SVG export and RPC — neither of which has a component — see a null
palette and render blank. As a getter the value is always present and MobX
recomputes it only when the theme changes: same re-encode invalidation, no mount
dependency. Every palette builder in tree reads that one session input —
`buildColorPaletteFromPalette` (alignments), `getMafColorPalette` (MAF),
`buildColorPalette` (reference sequence), canvas's `themedColorTable`, the
multi-sample variant and multi-way synteny palettes, and `treeStroke` /
`treeHoverColors` (tree-sidebar, whose consumer is a drawing autorun rather
than `gpuProps()` — same rule, since an autorun has no component either).

**Read `session.palette`, not `session.theme`.** Both are required on
`AbstractSessionModel` and both resolve from the same `resolvePalette` call, so
they cannot disagree — but they are for different consumers, and only one is a
render input:

- `palette` (`JBrowsePalette`) is what *rendering* reads: plain color strings,
  no toolkit, serializable, so it crosses the RPC boundary and works headless.
- `theme` is the resolved MUI `Theme`, for the components that are MUI.

Embedded products without `ThemeManagerSessionMixin` supply both off a
`themeOptions` getter (`EmbeddedSessionThemeMixin`). No display sends a theme
to the worker any more; SVG export still overrides the palette with the
*export* theme — `resolvePalette({ configTheme: opts?.theme })`.

## `rpcProps()` loop trap and how to break it

Including any fetch-result derivative in `rpcProps()` creates an infinite loop:

```
setCellData → <derived value> changes → rpcProps() changes
  → SettingsInvalidate → invalidateSettings → clearSettingsBakedData → cellData cleared
  → <derived value> changes → rpcProps() changes → …
```

The fix is to split the computation: `rpcProps()` gets a cache-key version
computed from user-controlled inputs only; any part that needs fetch-result data
is kept in a separate view used only for rendering or passed directly to the
server.

In the variant case, `rpcProps().sampleFilter` calls `getSources` with
`renderingMode: 'alleleCount'` internally (through `sourcesBase`) so haplotype
expansion — which needs `sampleInfo` — is never triggered. The client's `sources`
view still reads `sampleInfo` for rendering, safe because it is not in
`rpcProps()`. The worker expands to haplotype rows itself, after computing
`sampleInfo` from the features.

**Rule:** `rpcProps()` must contain only user-controlled settings. Never include
`cellData`, `sampleInfo`, or any getter that reads them.

Because both families key on the *returned* payload (see "the cache key is the
return value, not the reads"), the loop needs a fetch-derived value to reach the
**return** — one merely consulted while building can't loop. That is the whole
reason HiC gets away with `activeNormalization` reading fetched
`availableNormalizations`. It also sets where the loop shows up: per-region it is
a synchronous freeze, caught by `makeSettingsLoopGuard`'s within-tick counter;
on the global family `installGlobalFetchAutorun` reads the key and fetches in one
debounced body, so it loops on the async-fetch cadence instead, which no
within-tick counter can tell apart from fast interaction. See
`packages/display-kit/CLAUDE.md` for the overridable
hook list and test-file mapping.

## Row order is not a fetch input

The three row-stacking displays all keep the *order* rows are drawn in out of
the RPC, and each pays for it in a different currency:

| display | what crosses | who assigns the row |
| --- | --- | --- |
| multi-wiggle | the full canonical `sources` list, as a **structural** arg (absent from `rpcProps()`) | the main-thread encoder, from `gpuProps().sources` |
| MAF | `subtreeFilter` only | `placeMafRegionData`, keyed on species name, re-run by the `rpcDataMap` memo over the store and the row order |
| multi-sample variant | `sampleFilter` (sorted sample names) | `placeVariantRows`, keyed on `rowNames`, re-run by the derived region map |

The shared rule: **a fetch argument may name the row *set*, never the row
order.** The set is real work — a focused clade is a fraction of the cells or
the sequence — while the order is a permutation the main thread can apply for
free. Sent unsorted, a set puts the order back in through the JSON cache key
even though no worker reads it, so sort it.

A drag-reorder, a "Group by", a clustering run and a genotype sort are then all
re-uploads of bytes already in hand; under positional row identity each of them
re-downloaded and re-computed the whole window. It also removes a class of bug,
since a payload numbered against a row list the display isn't drawing renders
every row under another row's name.

Two things to get right when doing it again:

- **Name the rows in the payload** (`rowNames` / `sampleId`) and place by name.
  A row the display isn't drawing must not fall back to row 0; variants sends it
  to a `HIDDEN_ROW` sentinel that every painter's existing Y-cull discards, MAF
  drops it.
- **Placement must not disturb an ordering something else depends on.** The
  variant cell arrays are sorted by `(featureIndex, rowIndex)` in the *worker's*
  numbering and the hit test binary-searches that, so placement writes a second
  array and leaves the sorted one alone.
