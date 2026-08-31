---
status: Accepted
summary: "A view carried two authoring shapes, flat on a spec and nested under `init` in a `defaultSession`, and MST dropped the wrong choice in silence; v5 keeps the flat one and resolves the command-vs-property split in the view's own preprocessor instead of asking the author to draw it"
---

# ADR-099: A view takes one authored object

## Status

Accepted (2026-08-31). Supersedes the "two shapes, one per surface" section this
repo's `reference/VIEW_INIT.md` carried until v5.

## Context

A view was authorable two ways, and which one was correct depended on the
surface. A session spec, a `?session=spec-` URL and a jbrowse-img spec took the
settings flat on the view. A config `defaultSession` took them nested under an
`init` property.

The distinction was real. A spec view is *arguments* to `LaunchView-<type>`, in
that launcher's own vocabulary — a dotplot takes `views`, a spreadsheet takes
`uri` — and the launcher sorts them into what the new view needs. A
`defaultSession` view is MST *state*, so a key needing resolution on load had
nowhere to live but a frozen property beside the view's own props. Both halves
of that are still true, and the partition described in
[VIEW_INIT.md](../reference/VIEW_INIT.md) still draws exactly that line.

**What was wrong was asking an author to draw it.** Nothing said which surface
was which at the point of writing, and MST drops an undeclared top-level key
without a word, so the wrong choice rendered a default view with no error
anywhere. The flat shape is the one people had seen: about 650 authored
artifacts in and around this repo wrote it, against about 60 nesting under
`init`. So the error was not a typo but authors writing the shape they knew into
the one place it did not work — four artifacts shipped broken on main at once
(`build_lct_ld.sh`, `build_tcga_cohort_cnv.sh`, `build_tcga_cohort_mutations.sh`,
`demos/dtu/config.json`), and `build_grape_peach_anchors.sh` published a demo
drawing straight chords until `341b54aacc`.

The mirror mistake cost the same either way. A launch key written flat on a
config snapshot was dropped for naming no declared property, and a plain view
prop written inside `init` landed in a frozen blob nothing reads.

## Decision

**v5 keeps the flat shape and deletes the other one. Every setting goes directly
on the view object, on every surface.**

The dimorphism has to exist somewhere — a saved session and an authored spec
arrive through the same door — so it is resolved **once, before any instance
exists**, in `withLaunchInput`: a `preProcessSnapshot` on each view's state
model that moves the keys a launcher has to resolve into an internal `launch`
property and leaves the rest for MST to restore. Each view type declares its own
launch keys, and `Record<keyof Commands, LaunchKeySpec>` makes a command the view
interprets and nobody registered a compile error.

**The collision did not force a rename.** `tracks` and `views` name both an
authored recipe (`tracks: ['genes']`) and built state (`view.tracks`, an array
of track models). Renaming the state props, or giving a prop a permanent union
type, would have reached every plugin reading `view.tracks`; instead each
colliding key registers the discriminator that tells the two apart per entry —
a built track snapshot cannot carry `trackId`, a built row is a view snapshot
and so carries a required `type`. A mixed array splits rather than picking one
meaning for the whole of it.

Two alternatives were rejected before this one, and are rejected on the same
grounds now.

- **Flattening `init` centrally in `loadSessionSpec`** erases the
  command-vs-prop distinction before the only code that can draw it has seen the
  snapshot, so `init: { colorByCDS: true }` would work from a spec while the
  identical config dropped it. A `preProcessSnapshot` "hoist" was written to
  paper over that asymmetry — a `types.frozen` blob quietly relocating its own
  keys — and both were backed out.
- **Teaching each launcher to accept both shapes** is per-view-type work every
  future launcher has to remember, so the accepted shape ends up differing by
  view type rather than by surface, which is worse.

What neither was measured against is the third option: make the resolution a
declared property of the view type rather than a central special case or a
per-launcher habit. That is what a registration plus one shared preprocessor
buys, and it is why the earlier reasoning can be right about the mechanism and
wrong about the conclusion.

## Consequences

The four broken artifacts above became correct verbatim. Moving a view between a
config, a URL and an `addView` call no longer means reshaping it, which was the
residual cost the old design accepted and named in its own diagnostic.

**One declaration now feeds four consumers**, none of which restates it:
`ViewType.acceptedKeys` (properties + launch keys + `passThrough`) is what
`loadSessionSpec` classifies a spec's keys against, what `jbrowse validate`
builds its `views` manifest group from, what `check-build-scripts.py` applies to
a build script's session JSON, and what the URL parameters page renders instead
of a hand-written table. The validator's view check is exhaustive from
`stateModelProps` alone rather than by enumeration, because those two sets are
the whole accepted surface.

**A typo is now reportable on both paths, and it was reportable on neither.** The
partition *moves* an unplaceable key into the blob rather than leaving MST to
drop it, so `afterAttach` can name it. A session spec never builds a snapshot, so
`loadSessionSpec` runs the same classification itself and reports through the
same wording — before this, `{type: 'LinearGenomeView', asembly: 'volvox'}`
yielded only the launcher's downstream `No assembly provided`.

**The report cannot live in the preprocessor**, and this is the constraint that
shapes the implementation more than any other: a session's view type is a
`types.union`, so MST runs every member's preprocessor against every candidate
snapshot while deciding which matches. A warning from in there fires for view
types the author never wrote. It is also why `.preProcessSnapshot` plus a
terminal cast is used rather than `types.snapshotProcessor`, which stops being a
`ModelType` and is silently dropped from the session's view union by
`PluginManager.pluggableMstType`.

**A view prop is authorable from the line that declares it.** `applyInitSettings`
writes the settings half as an MST patch against the model's own property list,
so there is no per-setting arm to forget — which is what left
`drawLocationMarkers` unauthorable and four DotplotView properties with no arm at
all under the old scheme.

Limits worth knowing. `CustomC` replaces the creation type, so a `.props()`
added after the widening cast is invisible to `SnapshotIn`; the cast is the
terminal link of every view factory. Excess-property checking is TypeScript's
literal-site check, so a spec built through untyped indirection still needs the
runtime path and the validator. And an out-of-tree view that registers no launch
keys keeps MST's silent drop until it does.

The v4 nested spelling is a migration question rather than a design one, and
`website/docs/developer_guides/upgrading_v5.md` is where it is answered.
