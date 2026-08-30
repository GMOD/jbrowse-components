---
name: delete-init-and-remap-launch-keys-on-the-view-object
description: v5 collapses the two authoring shapes into one — every setting goes directly on the view object, and preProcessSnapshot remaps the recipe shapes onto internal launch keys
metadata:
  area: views, session spec, config
  category: ready
  order: 4
  first_move: "the shared core helper — `withLaunchInput` (`.preProcessSnapshot` plus the terminal cast, NOT `types.snapshotProcessor`) and the per-view launch-key registration everything else derives from"
---

# Delete `init`, and remap launch keys on the view object

A view carries two authoring shapes today, and which one is correct depends on
the surface. Flat on the view is right in a session spec, a URL and a
jbrowse-img spec; nested under `init` is right in a `defaultSession`. Nothing
says so at the point of writing, and MST drops an undeclared top-level key
silently, so the wrong choice renders a default with no error anywhere.

The flat shape is what people know: about 650 authored artifacts use it against
about 60 that nest under `init`. So the error is not a typo, it is authors
writing the shape they have seen everywhere else into the one place it does not
work. Four artifacts ship broken on main this way today —
`scripts/build_lct_ld.sh:371`, `scripts/build_tcga_cohort_cnv.sh:300`,
`scripts/build_tcga_cohort_mutations.sh:201` and `demos/dtu/config.json` — and
`scripts/build_grape_peach_anchors.sh` shipped a demo drawing straight chords
until `341b54aacc` fixed it.

**v5 keeps the flat shape and deletes the other one.** The rule is one sentence
with no exceptions: *write every setting directly on the view object.* A
`defaultSession` view, a `?session=spec-` URL, an `addView` literal and an
embedded `createViewState` all take the same object. The four broken artifacts
above become correct verbatim.

## Why the collision does not force a rename

`tracks` and `views` name both an authored recipe (`tracks: ['genes']`) and the
built state (`view.tracks`, an array of track models). Neither renaming the
state props nor giving the prop a permanent union type is necessary:
`preProcessSnapshot` discriminates the authored shape and moves it to an
internal launch key, leaving the state prop exactly as it is. Plugin authors
reading `view.tracks` are unaffected, and the dimorphism — which has to exist
somewhere, since a saved session and an authored spec arrive through the same
door — is resolved once, before any instance exists.

## The two verified constraints

**Use `.preProcessSnapshot` with a terminal cast, never
`types.snapshotProcessor`.** The processor carries the widened input type but
stops being a `ModelType`, and `PluginManager.pluggableMstType` filters members
on `isModelType` — a wrapped view stateModel is dropped from the session's view
union without a word. `ViewType.stateModel: IAnyModelType` and every
`.properties` introspection site break with it.

**The preprocessor captures; it never warns.** `isValidSnapshot` applies the
preprocessor first, so the session union runs one view's preprocessor against
other view types' snapshots while deciding which member matches, and it runs
about twice per instantiation besides. A warning belongs in the launch autorun,
once per instantiated view. Unknown keys are *moved* into the blob rather than
left for MST to drop, which is what makes them reportable at all.

## Discriminators, all model-guaranteed

- **Track entries**: a recipe iff a string or `'trackId' in entry`. A built
  track snapshot cannot carry `trackId` — `BaseTrackModel` does not declare it.
  `type` would not work: specs write display types inline.
- **View rows** (synteny, breakpoint): built iff `'type' in row`. LGV's `type`
  is a required literal, so MST rejects a row lacking one. A row carrying both
  routes as built and self-navigates through the LGV's own remap; mixed
  built-and-recipe arrays are refused loudly, because index alignment with
  `levels` makes a partial lift wrong.
- **Highlights**: a string is launch (it needs `coerceHighlight` and the
  assembly manager); an object is the persisted shape. A string landing in the
  `types.frozen` array unparsed is a silent corruption today.
- Dotplot's `views` and synteny's top-level `tracks` collide with nothing —
  neither view declares that prop — so both are unconditional lifts.

## `sameScale` and its class

A launch key whose name is a declared prop with the same value meaning, where
launching needs an ordered imperative step beyond the property write, is **not**
remapped: the value lands on the prop, and the imperative half runs only when a
launch blob exists. Today `sameScale` latches the shared-zoom limit as state and
skips `applySharedScale()`, so a flat spelling gives the wrong picture and says
nothing. The deciding question, which belongs in the registration entry: *on an
already-materialized view, does writing the property alone produce the correct
picture?* A sweep of every Commands interface against every prop list found
`sameScale` to be the only member.

## Sequence

Each step lands independently.

1. Core: the `withLaunchInput` helper and the per-view launch-key registration.
   The registration is the single declaration the doc generator, the wire layer,
   the validator manifest and a typed `addView` all derive from, and a
   `Record<keyof Commands, LaunchKeySpec>` argument makes an unregistered
   command a compile error.
2. LGV, which exercises the URL wire, the launcher and the embedded products.
3. Synteny and dotplot, which already apply settings generically.
4. Circular, spreadsheet, sv-inspector and breakpoint, the four that hand-apply
   a fixed interface and ignore extra keys silently. Breakpoint's bare-array
   `init` normalizes to `views`.
5. Delete `ViewInit`, `applyInitSettings`, `partitionLaunchKeys` and
   `loadSessionSpec`'s nesting diagnostic. The internal blob is deliberately not
   called `init`, so the v4 spelling reports rather than half-working.
6. The validator gains a `views` manifest group and a `checkSessionView`
   mirroring `checkSessionDisplay`, plus a placement rule in
   `check-build-scripts.py`. Under this design the check is complete from
   `stateModelProps` alone.
7. The corpus codemod and the [VIEW_INIT.md](../reference/VIEW_INIT.md) rewrite.
   That doc's beside-`init` doctrine predates `applyInitSettings` and is what
   the shipped mistakes were following.

## Known limits

`CustomC` replaces the creation type, so a `.props()` added after the widening
cast is invisible to `SnapshotIn` — the cast is the terminal link of every view
factory. Excess-property checking is TypeScript's literal-site check, so a spec
built through untyped indirection still needs the runtime unknown-key path and
the validator. An out-of-tree view that does not register keeps MST's silent
drop until it does.
