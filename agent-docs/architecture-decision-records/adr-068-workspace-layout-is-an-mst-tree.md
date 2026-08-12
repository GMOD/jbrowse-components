---
status: Accepted
summary: "The workspace layout is one MST tree that React renders; dockview is gone. Supersedes ADR-057, whose ~8-9k-line estimate against this was about four times too high and was the thing holding the decision"
---

# ADR-068: the workspace layout is an MST tree, and dockview is gone

## Status

Accepted (2026-08-12). Supersedes
[ADR-057](adr-057-dockview-stays-external.md), which decided the opposite four
times.

## Context

The workspaces mode used [dockview](https://dockview.dev) for its tiled window
manager. dockview owned the grid as an opaque `dockviewLayout` blob; MST owned
`panelViewAssignments`, because "a tab holds a stack of JBrowse views" is our
concept and not dockview's. Everything hard in the seam was keeping the two
consistent.

ADR-057 argued four times that the seam was ours and the dependency was fine.
Its central claim held: **every hard bug there was on our side of the line.**
Of six real ones, five were ownership bugs and one was a plugin-API regression;
none was "dockview does the wrong thing".

What it also argued, and what turned out to be wrong, was the cost of the
alternative: **~8–9k lines**. That number measured `dockview-core` — gridview,
splitview, the whole dnd subsystem, tab overflow, popout windows, floating
groups — rather than the subset a JBrowse workspace needs.

## Decision

**Replace it.** The layout is one MST tree, React renders it, and a gesture is
an action.

The measurement that changed the decision, from a spike built rather than
estimated:

| | source lines |
| --- | ---: |
| The dockview seam it replaced | **1,178** |
| `WorkspaceLayout/` as shipped | **~1,940** |

So: **about four times cheaper than the estimate, and about 60% more code than
the seam it deleted** — in exchange for the dependency and its stylesheet going
away. Not a free lunch, and worth stating in that order; the estimate being
wrong is what moved the decision, not the line count being smaller.

Two pieces expected to be expensive were not:

- **The grid engine is flexbox.** Sizes are `flex-grow`, so proportional
  relayout on container resize is the browser's job. There is no pixel maths in
  the repo for it — this was the part most likely to be got subtly wrong.
- **The dnd geometry is one pure function** over a rect (`dropZoneAt`): edge
  bands, the corner tie-break, what counts as the middle. Tested with no DOM.

## What this bought, concretely

Not "less complexity" in the abstract — these specific things are **deleted, not
reimplemented**, because there is no second owner and no mid-mutation state:

- the three mechanisms guarding one seam against re-entrancy (an origin filter,
  a last-seen-layout comparison, and a deferral onto a microtask), all added in
  the same session that removed them
- `layoutsEqual` and the layout echo. One owner means no echo, and a settled
  layout now emits no snapshots at all — so nothing can truncate the redo stack
- `withSuppressedPanelRemoval`, which was unenforceable: nothing made a new
  restructure remember to wrap itself, and a forgotten wrap deleted views
- `init`. The layout is reachable by an action, so a session spec is *applied*
  rather than *requested*, and `ViewMenu`'s fork (call the api if a workspace is
  up, write an `init` if not) collapsed to one path
- `size` working only on the top-level split. dockview forces branch
  orientation to alternate by depth, so `row` inside `row` was not
  representable. It is now, and `size` works at any depth

## What it cost, and what replaced the risk

Reconciliation is replaced by **normalisation**: after a split or a removal the
tree is usually not canonical and every operation has to put it back. That is
real work and it is where this design's bugs live.

The difference is that it is *pure* — `tree.ts` is plain functions over plain
snapshots, no nodes, no lifecycle, no timing — so it is checked by a 2000-step
randomised operation sequence asserting canonical form, and no duplicated or
stranded tab or view, after **every** step. The imperative bridge could never
have that test, because there "correct" depended on what dockview did next.

Four integrity bugs were found by an adversarial pass after it worked, and the
worst is worth repeating: panel and tab ids were minted by a module-level
counter, which restarts at zero on every page load while the restored snapshot
still holds `panel-1`, `tab-1`, .... The obvious test cannot see it — within one
process the counter keeps advancing — so the test that catches it restarts the
module graph with `jest.resetModules()`.

## Migration: none, deliberately

MST ignores snapshot properties a model no longer declares. A session saved with
`dockviewLayout`/`panelViewAssignments` loads without error and loses only its
*arrangement*; every view survives in `session.views` and is homed. Sanctioned
by the maintainer as an acceptable trade, and it cost no importer.

## The chrome is dockview's, on purpose

`dockviewTheme.ts` transcribes dockview's `.dockview-theme-dark` block
verbatim. The look is not a new design, so nothing changed for users when the
engine underneath it did. The values are **fixed, not `theme.palette`** — dark
in a light JBrowse theme too, the way the app bar is.

## Consequences

- Details of the tree, its invariants, and the two runtime-looked-up members
  that fail silently live in
  [app-core/CLAUDE.md](../../packages/app-core/CLAUDE.md).
- `@jbrowse/react-app2/styles.css` stays exported and is now empty. Owning that
  entry point is what let the dependency go without breaking a single embedder's
  import — the one part of ADR-057's reasoning that paid off exactly as written.
- **Three things were scoped out at the time and have since been built**, which
  is the part of this ADR most likely to be read as still true: tab overflow
  (the strip translates the wheel and scrolls the current tab into view),
  keyboard/a11y (a roving tabindex on the strip, an operable splitter), and
  min-size constraints. The last is `splitter.ts` and is dockview's own number —
  `MINIMUM_DOCKVIEW_GROUP_PANEL_WIDTH` is 100 — because a flex share of zero is
  legal and a pane dragged to it takes its tab strip with it. None was blocked
  by the design, which is what the original entry predicted.
- **Cross-referencing the dependency after removing it is cheap and worth
  doing.** Reading `dockview-core@8.0.0` — from npm; the package is gone from
  every `package.json` and from the lockfile — settled three questions that
  would otherwise have been guesses: the
  remove-then-insert index adjustment for a same-strip tab move is character for
  character what dockview does, the 100px group minimum above was simply
  missing, and the two deliberate divergences are now written down as
  divergences — corners resolve to the proportionally deeper edge rather than by
  a fixed left/right/top/bottom priority, and closing a tab falls to its left
  neighbour rather than to dockview's most-recently-used.
- **The lesson worth keeping is about the estimate, not the engine.** ADR-057
  was reopened four times and re-derived the same answer each time from a number
  nobody had checked. A day of building replaced it, and the answer inverted.
  When a decision rests on a cost estimate that has never been measured, measure
  it rather than restating it.
