---
name: workspace-layout
description: Panel maximize and where its flag must not live, a tab overflow menu and what has to measure for it, and the drag gesture having no keyboard equivalent.
---

# Workspace layout (tabs and panels)

`packages/app-core/src/WorkspaceLayout/`, whose CLAUDE.md is the design. These are
what was left on the table after the strip's drag, keyboard and overflow work, in
descending order of how much they are worth.

**Panel maximize / restore.** The one real dockview feature the rewrite did not
carry, and a genuinely useful one here — a genome view is tall, and "make this cell
the whole window for a minute" is a thing people do constantly in an IDE. The
design question is not the gesture, it is **where the flag lives**, and the obvious
answer is the wrong one.

Putting `maximized` on a `PanelNode` puts it inside `tree.ts`, which is the half
that carries the risk and is proven by a 2000-step randomised operation sequence
asserting canonical form after every step. Every operation would then have to say
what it does to the flag — a split of a maximized panel, a drag of its last tab
out, a normalize that collapses it into its parent — and the randomised test would
have to grow a new invariant to catch any of that going wrong.

Better: `maximizedPanelId` as a sibling prop on the **mixin**, beside
`activePanelId`, with `LayoutRenderer` short-circuiting to that panel when it is
set. `tree.ts` stays untouched, the pure functions keep their current contracts,
and the flag becomes exactly the same class of thing `activePanelId` already is —
including its failure mode, which the model already has the pattern for: an id
naming a panel that has since been closed must fall back rather than render
nothing. That repair is now one named function, `keepActivePanel`, stating the
invariant rather than "the panel I just closed" — so this is a line inside it
and not a third copy of it. Stated as the invariant is the part that matters:
a removal collapses branches on the way out, so the cell that disappears is not
always the one that was named.

The gesture is unassigned, and double-clicking the strip background is both the
IDE convention and free — `TabStrip`'s only `onDoubleClick` is the one on a
tab's own label, for rename.

Two things to settle before writing it. **Is it session state?** If it is, a shared
link opens maximized and undo steps through it, which is probably right and is the
cheap option since the mixin is already persisted. **What does it do to the GPU
budget?** Nothing, and that is worth checking rather than assuming: maximizing
mounts no new views (it is the same panel's same tab), so the 16-context ceiling in
`agent-docs/reference/GPU_CONTEXT_BUDGET.md` is untouched. A version that instead
_hid_ the other panels with `display: none` while leaving them mounted would be a
different proposal with a real cost, and is the version to reject.

**A tab overflow menu.** The strip scrolls and hides its scrollbar, so the wheel
now scrolls it and a tab that becomes current scrolls itself into view — but there
is still nothing on screen saying there are more tabs, which is the half that was
not fixed. A `⌄` button listing every tab, jumping to the one picked, is the
conventional answer and would beat wheel-scrolling as an affordance.

The part to get right is **when it appears**, and the cheap versions are both bad:
always showing it spends strip width on a control that is usually inert, and
showing it past a tab-count threshold is wrong at any threshold because tab width
depends on title length and cell width. The correct trigger is measurement —
`scrollWidth > clientWidth` — which means a ResizeObserver on the list, per panel.
That is a real cost and this repo has already declined its shape once: see
`useViewVisibility`'s comment on why a second observer per view whose every fire
re-renders the chrome was not worth it. So the honest options are (1) accept one
observer per panel and say why it is worth it here, or (2) find a CSS-only tell.
Nobody has looked for (2).

**A tab drag has no keyboard equivalent.** Activating a tab, moving focus along
the strip and moving a splitter are all operable; MOVING a tab between cells, or
reordering one within a strip, is pointer-only. The View menu's "move to new
tab" / "move to split view" cover the view level and are the reason this is
mildly rather than badly wrong — but they are per-view, so a tab holding a stack
of them has no keyboard move at all. dockview has no answer here either, so
there is nothing to transcribe: the design question is whether it is a pair of
tab-menu items (`Move tab left` / `Move tab right`, plus something for the cell
axis) or a modifier on the strip's existing arrow handling, and the second is
cheaper to reach but collides with the roving tabindex the arrows already own.
