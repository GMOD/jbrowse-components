---
status: Accepted
summary: "dockview stays an npm dependency; the friction at the workspaces seam is two state machines both owning layout, which vendoring the library would not collapse"
---

# ADR-057: dockview stays external; the seam is ours

## Status

Accepted (2026-08). Recurring proposal — this ADR exists because the question
has been reopened several times and each time re-derived the same answer from
scratch.

## Context

`@jbrowse/app-core` embeds [dockview](https://dockview.dev) as the tiled window
manager behind the workspaces mode. The seam between it and the rest of the app
is genuinely awkward to work in — enough that
[app-core/CLAUDE.md](../../packages/app-core/CLAUDE.md) devotes most of its
length to explaining it, and that everything hard in `useDockviewController.ts`
is keeping dockview and MST consistent rather than doing anything a window
manager does.

The recurring proposal is to vendor dockview into the repo: copy the source in,
own it outright, and make the boundary disappear. A secondary complaint drives
it — dockview obliges consumers to load a stylesheet, which is unusual for a
package in our dependency tree and shows up in `@jbrowse/react-app2`'s public
surface.

## Decision

**Keep dockview external.** Four reasons.

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

Not vendoring: **making MST the sole owner and dockview a pure projection.**
Derive dockview's serialized grid from `DockviewLayoutNode`, `fromJSON` it, and
never write `api.toJSON()` back. That retires the echo problem, `layoutsEqual`,
the suppression flag, and makes undo correct by construction, because there is
only one thing to rewind.

The cost is real and already documented: `DockviewLayoutNode` is not isomorphic
to dockview's grid — orientation alternates by depth — so we would have to model
sizes and nesting ourselves. That is also exactly what blocks honouring `size`
at depth today, so it is work with two payoffs. It is roughly the size of
`dockviewUtils.ts`, not of a vendored library.

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
