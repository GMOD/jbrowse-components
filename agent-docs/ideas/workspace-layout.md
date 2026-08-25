---
name: workspace-layout
description: A tab overflow menu and what has to measure for it, and the drag gesture having no keyboard equivalent.
---

# Workspace layout (tabs and panels)

`packages/app-core/src/WorkspaceLayout/`, whose CLAUDE.md is the design. These are
what was left on the table after the strip's drag, keyboard and overflow work, in
descending order of how much they are worth. Panel maximize was the entry above
these and landed as designed — the flag on the mixin, the strip's double-click,
and the repair stated as an invariant rather than per gesture.

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
