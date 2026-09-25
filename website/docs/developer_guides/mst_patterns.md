---
title: MST patterns
description: Common MobX-State-Tree patterns used across JBrowse plugins
guide_category: Core concepts
---

JBrowse uses `@jbrowse/mobx-state-tree`, an internal ESM fork of
[MobX-State-Tree](https://mobx-state-tree.js.org/). The public API matches
upstream MST, so the upstream documentation applies.

The sections below cover the MST idioms JBrowse relies on: driving side-effects
with `autorun`, composing models from mixins, `types.frozen`, volatile state,
and using `self` over `this` in views.

## autorun inside useEffect

Drive a side-effect from MST observables in a React component. The autorun's
disposer is returned straight out of the `useEffect`, so it becomes the cleanup,
and every observable read inside becomes a dependency without going in the dep
array:

<!-- include: packages/app-core/src/WorkspaceLayout/WorkspaceContainer.tsx#autorunInEffect -->

```tsx
useEffect(
  () =>
    autorun(() => {
      // reads session.views itself, so it re-runs when the view set changes;
      // homeUnassignedViews is an action and would not be tracked from inside
      session.homeUnassignedViews(session.views.map(v => v.id))
    }),
  [session],
)
```

Prefer `autorun` over `reaction` for side-effects: it runs immediately and
tracks dependencies automatically. Use `reaction` only to separate the tracked
expression from the effect.

To read an observable inside an autorun **without** making it a dependency, wrap
it in `untracked()`. The dotplot's fetch tracks exactly one computed and reads
everything else untracked:

<!-- include: plugins/dotplot-view/src/DotplotDisplay/afterAttach.ts#untracked -->

```ts
// Untracked: the values behind that key. Reading them here rather than
// as deps keeps raw offsetPx/width changes from refiring the fetch,
// while the worker still sees the current axes.
// eslint-disable-next-line no-restricted-syntax -- effect input: the worker consumes the axes, currentFetchKey is the decision
return untracked(() => ({
  // the resolved tier, which is what `currentFetchKey` carries —
  // `view.lodMode` stays 'auto' while the tier flips under it
  lodTier: self.lodTier,
  hViewSnap: makeViewSnap(view.hview),
  vViewSnap: makeViewSnap(view.vview),
  regions: self.fetchRegions,
}))
```

This computed-and-untracked split is the shape to copy for any expensive effect:
fold every input that should trigger it into one computed, track only that, and
read the raw values inside `untracked`. Tracking the underlying observables
individually would refire the worker fetch on every pan frame for an identical
result.

:::warning An autorun must do its own reads — an MST action is an untracked one

`untracked` above is deliberate. **An MST action is the same thing by accident:
actions run untracked**, so moving an autorun's body into one leaves the autorun
with no dependencies at all. It fires exactly once, never again, and nothing
throws or warns.

Factoring the body out into an action is easy to reach for, because it looks
like the obvious way to reuse it — from a menu item, or from a flush-on-teardown
path that wants the same work on demand. The fix is to duplicate the reads in
the autorun and say why in a comment; `RegionTooLargeMixin`'s byte gate is the
worked example.

The same trap in another form: `self.someAction(getSnapshot(self))` tracks fine,
and only because the snapshot is taken in the argument list, before the action
is entered. Move that read inside the action and the dependency disappears with
it.

:::

## Model composition

`types.compose(name, ...types)` layers mixins onto a base model. It takes the
name and every part up front — there is no `.compose()` method on a model type,
so the mixins cannot be chained on one at a time the way `.views()` and
`.actions()` are. `LinearMafDisplay` layers four mixins onto `BaseDisplay`:

<!-- include: plugins/maf/src/LinearMafDisplay/stateModel.ts#compose -->

```ts
.compose(
  'LinearMafDisplay',
  BaseDisplay,
  TrackHeightMixin(),
  MultiRegionDisplayMixin(),
  CoarseTierMixin<MafRegionPayload<MafSummaryRecord[]>>(),
  LegendMixin(),
  RowHeightMixin(),
  TreeSidebarMixin<MafSource>(),
  ContextMenuMixin<MafContextMenuInfo>(),
  types.model({
    /**
     * #property
     */
    type: types.literal('LinearMafDisplay'),
    /**
     * #property
     */
    configuration: ConfigurationReference(configSchema),
  }),
)
```

`.views()` / `.actions()` / `.volatile()` chain onto the result of that one
call.

Mixins are factory functions returning a model type, not classes, so the same
mixin can be composed at different positions in the chain without inheritance.

Keep the main model chain in one file. Splitting `.views()` or `.actions()`
across files obscures the composition order and which views depend on which.

## Chaining multiple .views() blocks

`self` inside a `.views()` block is typed with everything the model had
**before** that block. So a later block reaches an earlier block's getters on
`self`, and that is the reason to split. `LinearMarkDisplay` puts its typed
`conf` getter in its own block so every getter after it can read `self.conf`:

<!-- include: plugins/marks/src/LinearMarkDisplay/model.ts#chainedViews -->

```ts
.views(self => ({
  /**
   * #getter
   * the config typed off the concrete schema
   */
  get conf(): LinearMarkDisplayConfig {
    return self.configuration
  },
}))
```

Use multiple blocks when a getter depends on another getter, making the
dependency explicit through ordering.

## types.frozen

Use `types.frozen()` for data that is:

- Large and doesn't need deep reactivity (e.g., an array of 10k feature objects)
- Stored as a plain JSON value and hydrated lazily into MST nodes on first
  access

<!-- include: packages/tree-sidebar/src/TreeSidebarMixin.ts#frozenProp -->

```ts
sortRowsBy: types.maybe(types.frozen<RowSortSpec>()),
```

`types.frozen<T>()` takes the shape as a type parameter and stores a plain
value. Wrap it in `types.maybe` or `types.optional` the same as any other type —
frozen is about what MST does with the value, not about whether it is present.

Frozen values are compared by reference; MST does not track fields inside them.
For reactive access to a field inside a frozen value, copy it out into a regular
MST property or a `.volatile()` field.

To make a field a dependency of an autorun without using its value, `void` it —
for a frozen field that means the autorun fires when the whole value is
replaced, without enumerating its properties. The shared fetch skeleton (which
every fetch outside the per-region and global display families runs on, Hi-C's
file-header read among them) does it to a counter so the retry button re-runs
the fetch:

<!-- include: packages/core/src/util/installFetch.ts#voidTracking -->

```ts
() => {
  // the pure "go again" signal, read unconditionally above every gate so a
  // Retry click re-runs the body even when nothing else moved
  const reloadEpoch = self.reloadCounter
  // Tracked in the same breath and for the same reason, but the mirror
  // image: this one CLOSES the gate below, so a run that returned before
  // the counter read would drop the one observable that can reopen it and
  // Cancel would be a one-way door with a Retry button on it. Order, not
  // just position: counter first, then this, then the gates.
  const canceled = self.fetchCanceled === true
  // Above the gate, not only above `prepare`: teardown mutates the
  // observables this body reads before the disposers run, and every `gate`
  // but the breakpoint view's reaches the containing view or track through a
  // parent walk (`host.initialized`, `isMinimized`, `getContainingView`),
  // which throws once the node has left the tree. This catches the destroyed
  // node; the detached-and-still-alive window (ADR-069) is covered only by
  // the walk's own cache. Nothing is reported for a dead node — there is no
  // Retry button left to be dead, and the check would read three more
  // members of a corpse to decide it.
  if (!isAlive(self)) {
    return false
  }
  if (canceled || gate?.() === false) {
    noteFetchAutorunRun?.('gated')
    return false
  }
  const args = prepare()
  if (args === undefined) {
    noteFetchAutorunRun?.('declined')
    return false
  }
  // The freshness gate, and the reload that overrides it. The epoch is
  // stamped at ISSUE where the key is stamped at commit: a fetch that fails
  // leaves nothing current, so this gate is open anyway on the next run and
  // consuming the retry here costs nothing — while a reload landing
  // mid-flight is answered by the re-run the counter read above already
  // guarantees.
  if (held !== undefined && held(args) && reloadEpoch === issuedEpoch) {
    noteFetchAutorunRun?.('declined')
    return false
  }
  issuedEpoch = reloadEpoch
  noteFetchAutorunRun?.('fetched')
  // `run` is called synchronously, so its prefix down to its first await
  // executes in this derivation; `FetchPhases.run` promises those reads are
  // untracked, and unlike the MST flow the LGV side hides behind, nothing
  // here makes it so. Whatever the run needs tracked belongs in `prepare`.
  // eslint-disable-next-line no-restricted-syntax -- effect input: run's prefix reads are the fetch's, prepare is the trigger list
  untracked(() => {
    void runFetchOnce(self, rotation.begin(), args, {
      run,
      commit: commitAndStamp,
      setError,
      onBegin,
      onEnd,
    })
  })
  // arms the debounce; the runs that bail above return false and stay on
  // the leading edge, so the first real fetch is immediate while a
  // zoom/pan refetch debounces
  return true
},
```

Give every autorun a `name` as that one does — it is what shows up when
debugging which effect refired.

## self over this in .views()

`self` over `this` is a **typing** rule, not a runtime one. `self` and
`self`-via-`this` are the same object at runtime, and both dispatch to a later
block's override; what differs is what TypeScript can see:

- `self` is typed with everything the model had **before** the block. It reaches
  earlier blocks, the properties, and the volatiles — and cannot see a sibling
  in its own block.
- `this` inside the returned object literal is typed as **that literal**. It
  reaches same-block siblings and nothing else.

Prefer `self.X`, and reach for `this.X` only for a sibling defined in the same
block. `LinearVariantDisplay`'s legend getters use both, one line apart:

<!-- include: plugins/variants/src/LinearVariantDisplay/model.ts#sameBlockThis -->

```ts
/**
 * #getter
 */
get colorsByConsequenceImpact() {
  return self.colorEncoding === CONSEQUENCE_IMPACT_JEXL
},
/**
 * #getter
 */
get colorsBySvType() {
  return self.colorEncoding === SV_TYPE_COLOR_JEXL
},
/**
 * #getter
 */
get channelSpecExamples() {
  return VARIANT_CHANNEL_SPEC_EXAMPLES
},
/**
 * #getter
 * The key while features draw: the scale of whichever preset coloring is active
 * (impact tiers or SV classes), or else the key a color by a field
 * derives. SV-type shows the fixed class key and the grey everything
 * else takes; a copy-number state's rainbow color is the one thing it
 * paints and cannot list, the pure jexl having no present-set to
 * enumerate.
 */
get featureColorScales(): ColorScale[] {
  if (this.colorsByConsequenceImpact) {
    return [
      {
        kind: 'categorical',
        id: 'consequenceImpact',
        title: 'Consequence impact',
        entries: [
          ...IMPACT_TIERS.map(t => ({
            value: t.tier,
            label: t.tier,
            color: t.color,
          })),
          {
            value: UNANNOTATED_IMPACT,
            label: UNANNOTATED_IMPACT,
            color: getImpactColor(UNANNOTATED_IMPACT),
          },
        ],
      },
    ]
  }
  if (this.colorsBySvType) {
    return [
      {
        kind: 'categorical',
        id: 'svType',
        title: 'SV type',
        entries: svTypeLegendEntries(),
      },
    ]
  }
  return self.derivedColorScales
},
```

Note `colorLegend`'s explicit `: LegendItem[]` return type. A getter read
through `this` has to be annotated — without it TypeScript has to infer the
literal's type from a member that refers to the literal, and gives up with a
circular-reference error. That annotation is the cost of a same-block `this`
read, and the reason splitting into another block is usually tidier.

If you need to extend a parent view in a subclass, destructure the super version
off `self` **outside** the returned object, before redefining it. Reading it
inside would find your own override and recurse. `LinearMafDisplay` appending to
the inherited track menu:

<!-- include: plugins/maf/src/LinearMafDisplay/stateModel.ts#superMethod -->

```ts
.views(self => {
  const { trackMenuItems: superTrackMenuItems } = self
  return {
    /**
     * #method
     */
    trackMenuItems() {
      return [
        ...superTrackMenuItems(),
        ...buildMafTrackMenuItems(self),
        ...mafLaunchMenuItems({
          session: getSession(self),
          model: self,
          view: containingLgv(self),
        }),
      ]
    },
  }
})
```

## Volatile state

Use `.volatile(() => ({ … }))` for state that should not be persisted in
snapshots — loading flags, hover and menu state that a reload should reset.
Fetched data is not one: it lives on the foundation's per-region store and a
display reads it back through a getter. The canvas display's block, in full:

<!-- include: plugins/canvas/src/LinearBasicDisplay/baseModel.ts#volatile -->

```ts
/**
 * #volatile
 */
featureIdUnderMouse: undefined as string | undefined,
/**
 * #volatile
 */
subfeatureIdUnderMouse: undefined as string | undefined,
/**
 * #volatile
 * the hover tooltip's rows, each rendered as its own element — see
 * hoverTooltipRows for why this is a list and not one HTML string
 */
mouseoverExtraInformation: undefined as string[] | undefined,
/**
 * #volatile
 * genomic base currently hovered in a feature sequence dialog opened
 * from this display, read by the LGV crosshair overlay
 */
sequenceHoverPosition: undefined as SequenceHoverPosition | undefined,
```

`undefined as T | undefined` is the idiom for a volatile whose type MST cannot
infer from its initial value.

Observable maps (`.map<K, V>()`) give reactive key-level tracking: an autorun
reading `map.get(key)` re-fires only when that key changes, not on every map
write.

## See also

- [](/docs/developer_guides/data_fetching)
- [](/docs/developer_guides/configuration_schema)
- [](/docs/developer_guides/creating_view)
