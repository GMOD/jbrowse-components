---
status: Superseded
summary: "Decided four times that dockview stays; superseded by ADR-068, which replaced it. Kept for the part that held — every hard bug at the seam was ours — and for the cost estimate that did not, which was ~4x too high and was the thing deciding it"
---

# ADR-057: dockview stays external; the seam is ours

## Status

**Superseded** by [ADR-068](adr-068-workspace-layout-is-an-mst-tree.md)
(2026-08-12), which replaced dockview with an MST-native layout. dockview is no
longer a dependency of any package.

Kept rather than deleted, because the two halves of it aged very differently and
both are worth having.

**What held.** Every hard bug at that seam was on our side of the line — five of
six were ownership bugs, one was a plugin-API regression, none was "dockview
does the wrong thing". The vendoring argument (§1–4 below) was never the weak
part and was never what got reversed: nobody vendored anything, the dependency
was simply removed.

**What did not.** The cost of replacing it, given as ~8–9k lines in "On
rewriting it ourselves". That measured `dockview-core` — its whole dnd
subsystem, popout windows, floating groups, tab overflow — rather than the
subset a JBrowse workspace needs. The shipped replacement is **~1,940 source
lines**: about four times cheaper than the estimate, and about 60% *more* code
than the 1,178-line seam it deleted, in exchange for the dependency going away.
That is a trade worth making and it is not a free lunch — say it that way
round.

**And that is the reason this file is still here.** It was reopened four times
and each time re-derived the same answer from a number nobody had checked. One
day of building replaced the estimate and the answer inverted. When a decision
rests on a cost that has never been measured, measure it.

Read below for the analysis of the seam itself, which ADR-068 does not repeat.

## Context

`@jbrowse/app-core` embeds [dockview](https://dockview.dev) as the tiled window
manager behind the workspaces mode. The seam between it and the rest of the app
is genuinely awkward to work in — enough that app-core's own working notes
devoted most of their length to explaining it, and that everything hard in
`useDockviewController.ts` is keeping dockview and MST consistent rather than
doing anything a window manager does.

The proposal arrives in two forms, and they need separate answers:

1. **Vendor it** — copy the source in and own it outright. A secondary
   complaint drives this one: dockview obliges consumers to load a stylesheet,
   which is unusual in our dependency tree and shows up in
   `@jbrowse/react-app2`'s public surface.
2. **Replace it** — write our own tiling window manager, driven declaratively
   from MST and rendered by React, and delete the imperative bridge.

## Decision

**Keep dockview external — do not vendor it.** Four reasons, below, and none of
them has weakened.

**On reimplementing it: the cost argument that used to settle this has
collapsed, and the decision is now genuinely open.** A measured spike puts a
replacement at *fewer* lines than the seam it deletes. What remains is a trade
between two coherent positions rather than a right answer:

- **Don't**, if the goal is fewer bugs. Zero of the six real seam bugs are in
  anything a rewrite would rebuild, and dockview 8's `DockviewOrigin` retired
  the worst of the reconciliation rules for free.
- **Do**, if the goal is that layout be MST-native like the rest of JBrowse.
  Three separate mechanisms now guard one seam against re-entrancy, all of them
  justified, all of them existing purely because dockview is imperative and
  event-driven while the session is reactive. That mismatch is permanent. A
  React-rendered tree has no mid-mutation window to defend, so those three
  vanish rather than being reimplemented.

This ADR does not decide the second question, because it is a judgement about
what the codebase should be rather than a defect count, and the numbers that
used to make it look like a defect count were wrong.

### 1. The ownership-to-surface ratio is bad by two orders of magnitude

Ten files import from `dockview-react`. **Nine of them are `import type`.** The
only value import in the repository is `import { DockviewReact }` in
`TiledViewsContainer.tsx`, plus the stylesheet. Everything else consumes
`DockviewApi`, `DockviewGroupPanel`, `SerializedDockview`,
`IDockviewPanelProps` — types, which vendoring does not help us control.

Against that, `dockview-core` 7.0.4 ships 13,844 lines of `.d.ts` alone: split
view, grid view, pane view, drag-and-drop, serialization, popout windows,
floating groups. Vendoring means taking all of it into lint, typecheck,
tsserver's heap and our own maintenance in order to gain control over one
component import.

### 2. Every hard bug at this seam is on our side of the line

This is the decisive one. Three known problems, none of which closes by owning
the source:

- **The layout echo truncating the redo stack.** `onDidLayoutChange` is an
  `AsapEvent` that `queueMicrotask`s its fire, so a synchronous suppression flag
  can never guard it. Fixed by comparing before writing (`layoutsEqual`). If we
  owned the source the tempting fix would be making the event synchronous — but
  it is asap-batched precisely so a burst of resize events coalesces into one
  fire. Making it synchronous fires it per-frame during a divider drag. We would
  have re-derived the same reconciliation fix, after breaking something.
- **The many-view freeze.** Width-thrash was instrumented and disproven; the
  leading hypothesis is that `JBrowseViewPanel` has no windowing, so all N views
  cram into one panel. That is our component.
- **The `protein/connected` sideBySide regression.** The protein3d plugin is
  version-pinned, and it traces to our own `setPendingMove` channel change — a
  feature-detecting caller silently losing a capability.

Zero of the three would have been prevented, or made easier, by a vendored copy.

### 3. The roughness is two state machines, not two codebases

dockview owns the grid as an opaque `dockviewLayout` blob; MST owns
`panelViewAssignments`, because "a panel holds a stack of JBrowse views" is our
concept and not dockview's. MST is also the TimeTraveller's target, so every
echo from dockview reads as a user edit. That duality is where
`withSuppressedPanelRemoval`, `layoutsEqual`, and the
one-autorun-three-ordered-steps rule all come from.

Vendoring does not collapse it. Both state machines still exist, still disagree,
and we now maintain both halves instead of one.

### 4. Upstream is fast-moving and we have been getting it for free

Adopted 2025-12-07 at `^4.11.0`; now on `^7.0.4`, the current release. **Three
major versions absorbed in eight months**, and every bump rode in on a routine
release or dependency sweep — none is a "repair the seam after upgrading"
commit. There is no `patchedDependencies` entry and never has been.

Total repair cost across three majors: one commit, `f5b86239c2`, fixing the CSS
import paths when 6.0 moved them.

That cadence is the strongest argument *for* vendoring, and it inverts on
inspection: a fast-moving upstream we track at a cost of one commit per three
majors is doing work for us. Vendoring freezes us at 7.0.4 and converts that
into our backlog.

*Amendment 2026-08-12:* now four majors. dockview 8 rode in on `4a976d7d6c`
("Bump deps") with zero repair commits, and it carried the API that retired the
seam's worst rule — see "What dockview 8 changed" below.

## On rewriting it ourselves

The instinct behind this one is sound and the ADR agrees with its diagnosis: the
friction is that layout has two owners synced bidirectionally.

**This section first argued the rewrite was ~8–9k lines. That number was wrong,
and it was wrong in the direction that supported the conclusion already
reached.** It measured `dockview-core` — gridview, splitview, the whole dnd
subsystem, tab overflow, serialization — rather than the subset a JBrowse
workspace needs. Two gestures, not a general dnd framework. No floating groups,
popout windows, edge groups or cross-window drag.

The estimate was replaced with a working spike
(`packages/app-core/src/WorkspaceLayout/`), because a number nobody has checked
is an opinion:

| | source lines |
| --- | ---: |
| Current dockview seam (`useDockviewController` + `dockviewUtils` + `DockviewLayout` + containers) | **1,178** |
| Spike: pure layout tree, MST model, renderer with splitters | 461 |
| Spike: drag-and-drop, both gestures with drop indicators | 402 |
| **Spike total** | **863** |

So a replacement is *smaller than the glue it deletes*, and it also drops the
dependency. Two of the pieces that looked expensive turned out not to be:

- **The grid engine is flexbox.** Sizes are `flex-grow`, so proportional
  relayout on container resize is the browser's job and there is no pixel maths
  to get wrong. This was expected to be the riskiest part and it is ~30 lines.
- **The dnd geometry is one pure function** over a rect. Edge bands, the corner
  tie-break, what counts as the middle — all decided in `dropZoneAt`, tested
  without a DOM or a synthetic pointer.

What the spike demonstrates rather than asserts, with tests:

- **`size` works at any depth.** dockview forces orientation to alternate by
  depth, which is why `size` only ever applied to the top-level split. A tree
  that can nest `row` in `row` and normalise it does not have that limit.
- **Undo is `applySnapshot` with nothing to notify**, and a settled layout emits
  no further snapshots — no echo, so nothing can truncate the redo stack.
- **The scenario that needs three separate mechanisms in the seam** — a reaction
  rearranging the workspace during a user close — **is two actions.** MST
  finishes one before reactions run; there is no half-applied state to catch.

The trade is real and is not "complexity for none": reconciliation is replaced
by **tree normalisation** (collapsing single-child branches, flattening
same-direction nesting, keeping sizes summing to 1). That is where this design's
bugs would live. The difference is that it is pure, so it is checked by a
2000-step randomised operation sequence asserting canonical form and no
duplicated or stranded view after every step — a property the imperative bridge
could never have, because there "correct" depended on what dockview did next.

**What remains unbuilt**, and is the honest residual cost: tab overflow,
keyboard/a11y, min-size constraints (flex alone lets a panel shrink to nothing),
and an importer for persisted `dockviewLayout` blobs so saved sessions and
shared session URLs survive. That last one is the only item that can lose user
data, and it is unavoidable in a rewrite.

The bug-count argument still stands and still says don't: of six real seam bugs,
five are ownership bugs and one is a plugin-API regression; **zero** are
"dockview does the wrong thing", and zero are in the parts a rewrite rebuilds.
What the corrected numbers change is that this is no longer also a cost
argument. It is a genuine trade, and the deciding axis is architectural — see
below.

## What dockview 8 changed

`DockviewOrigin` (`'user' | 'api'`) is documented upstream as being for exactly
this: *"Lets consumers (e.g. an undo stack, or a context-sync listener) treat
the app's own programmatic changes differently from end-user gestures."* It
arrives on `onDidActivePanelChange`, and `onWillMutateLayout` /
`onDidMutateLayout` bracket each top-level structural mutation with
`{kind, origin}`, joining nested calls into the outermost bracket.

That is the seam's hardest question — *did the user do this, or did I?* — asked
and answered by the library. `278f320601` deleted
`withSuppressedPanelRemoval` in favour of it and filtered the `activePanelId`
write on `origin === 'user'`, which removes the re-entrancy class that caused
the disposal crash rather than guarding its consequences.

The flag was not merely redundant, it was **unenforceable**: nothing made a
newly added restructure remember to wrap itself, and a forgotten wrap silently
closes the user's views. Reading an origin cannot be forgotten.

This is the second time tracking upstream has paid a dividend we did not ask
for, and it is worth noticing which way that cuts: the argument for owning the
code is that the boundary costs us. Here the boundary *delivered* the fix.

## On the CSS import

The complaint is real in general and mostly already paid down here:

- The single-view embedded components — `@jbrowse/react-linear-genome-view2`,
  `@jbrowse/react-circular-genome-view2` — have **no dockview dependency at
  all**. Most consumers never encounter it.
- `@jbrowse/react-app2` exposes one stylesheet of our own,
  `@jbrowse/react-app2/styles.css`, whose only content today is an `@import` of
  dockview's. dockview is an implementation detail behind our entry point, so
  swapping it out is our problem and not every consumer's. `scripts/flattenCss.ts`
  inlines it for publish, so the shipped file is self-contained and also works
  as a plain `<link href>`.

What is left is that a stylesheet import exists at all for the one product that
has a tiled window manager. That is inherent to any layout library, it is one
line, and the remaining gap is documentation rather than architecture — see
Consequences.

## What actually reduces the friction

Neither vendoring nor rewriting: **making MST the sole owner and dockview a
projection.** Derive dockview's serialized grid from `DockviewLayoutNode`,
`fromJSON` it, and stop treating `api.toJSON()` as a source of truth.

*Amendment 2026-08-12 — most of this has now been collected, and the rest got
smaller and more expensive.* The origin work above already retired the
suppression flag and the echo-driven re-entrancy. What a full projection would
still buy:

- deleting `init` as a separate channel — under MST ownership the layout *is*
  the state, so there is no request to apply late
- deleting step 2 of the sync autorun (re-apply on undo) — undo would rewind the
  tree and the projection would follow
- `size` honoured at depth, which is a documented limitation today

And what it would cost, beyond the exporter/importer pair:

- **`dockviewLayout` is persisted.** It is in saved sessions and in shared
  session URLs. Changing the storage format means either carrying an importer
  for old blobs forever or breaking every saved workspace — a user-visible data
  loss that none of the bugs above ever caused.
- `layoutsEqual` does **not** go away with it. Splitter drags are not structural
  mutations and produce no origin; the only signal is the coalesced
  `onDidLayoutChange`, so sizes still have to be read back and compared.

So the remaining payoff is one documented feature limitation, and the remaining
cost includes a persisted-format migration. **Do not start this speculatively.**
Do it when `size` at depth is actually wanted, and let that requirement pay for
the migration.

## Consequences

- dockview stays a normal dependency, tracked at current release.
- **If a specific dockview bug ever blocks us, the tool is `pnpm patch`, not a
  fork.** It gives us the ability to fix it on our own schedule without
  inheriting the maintenance, and it leaves a visible entry saying what we
  changed and why.
- The seam is `useDockviewController.ts` + `dockviewUtils.ts` and it is ours.
  Bugs there are ours to fix; don't diagnose them as boundary problems.
- Reopen this if any of the following becomes true: upstream goes unmaintained
  (releases were current as of 2026-08); a major bump costs more to absorb than
  the seam costs to maintain; or a `pnpm patch` entry has to be carried for more
  than a release or two, which is the signal that our needs and upstream's have
  actually diverged.
- **For the rewrite specifically**, reopen if we need layout semantics dockview
  structurally cannot express. Nested splits with independent sizing was the
  near-miss; it turned out to be expressible by building the serialized grid
  ourselves, which is the projection above and not a rewrite. "The seam is
  annoying" is not a trigger — it has been the stated reason all four times, and
  each time the annoyance turned out to be fixable in our own ~600 lines.
- One upstream inconsistency is worth knowing and is **not** worth patching:
  `DockviewApi.addGroup` is the only mutating method not wrapped in
  `withOrigin('api')`, so our own `addGroup` reports `'user'`. It is harmless
  because adding a group removes no panels, but don't write a rule that depends
  on it. Noted in [app-core/CLAUDE.md](../../packages/app-core/CLAUDE.md).
