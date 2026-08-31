---
name: open-the-four-late-migrated-views-in-a-browser
description: circular, spreadsheet, sv-inspector and breakpoint took the flat launch shape with only jsdom behind them, and sv-inspector backs five captured figures
metadata:
  area: views, embedded, figures
  category: ready
  order: 4
  first_move: "drive the three surfaces per view — flat spec URL, flat defaultSession, and a typo-only snapshot — reading the canvas pixel census rather than the screenshot"
---

# Open the four late-migrated views in a browser

[ADR-099](../architecture-decision-records/adr-099-a-view-takes-one-authored-object.md)
moved every view to one authored object. `LinearGenomeView`, `LinearSyntenyView`
and `DotplotView` were verified in a real browser: each opens and paints from a
flat spec, a flat `defaultSession` and a nested `init`, and per view type the
canvas pixel census came out **identical to the decimal** across the three, which
is the equivalence the design rests on.

`CircularView`, `SpreadsheetView`, `SvInspectorView` and `BreakpointSplitView`
migrated afterwards and have only jsdom, typechecks and goldens behind them.
Nothing there changes rendering in principle — but jsdom cannot see a view that
comes up blank, sits on a readiness gate, or falls back to its import form, and
"the view silently shows the wrong thing" is the failure class this whole change
exists to end. `SvInspectorView` additionally backs five captured figures.

These four were also the ones that ignored extra keys in silence before the
migration, and the ones whose readiness lines are least alike — spreadsheet and
sv-inspector consume their launch input up front, circular gates on
`displayedRegions`, breakpoint on `views.length`.

## What to drive

Per view type, the three surfaces, since they were separately broken before:

- a flat `?session=spec-` URL
- a flat `defaultSession` in a config — the surface the old shape silently failed
  on, and the reason for the change
- a typo-only snapshot, which must open on its import form and report the key
  rather than waiting forever on data that is not coming

Then re-shoot or spot-check the five `SvInspectorView` figures.

## How to not get a false pass

The `jbrowse-capture` skill has the readiness guidance and it is load-bearing
here. Use the positive session gate plus `waitForDisplaysDone`, never a fixed
sleep, and read a **canvas pixel census** rather than eyeballing the screenshot —
a picture of an empty browser is the classic false pass.

One trap already cost a pass on this work: for a couple of seconds the view body
reads "Loading…" while `data-app-phase` **already reads `ready`**. That is
`[data-view-component-pending]`, the lazy React component, not the launch
machine. Anyone shooting on the app marker alone photographs what looks exactly
like a hang.
