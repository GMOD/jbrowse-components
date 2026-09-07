---
name: a-static-menu-tree-to-check-that-a-documented-path
description: A static menu TREE, to check that a documented path nests the way the app does
area: tooling-tests-and-docs
---

# A static menu TREE, to check that a documented path nests the way the app does

built and measured 2026-08-18, then dropped for a narrower gate.
`check-menu-labels` verifies every segment of a `**A → B**` path names a label
the app renders; it cannot see that B sits inside a submenu the path never
mentions, which is how three of the six view-menu paths in
`spec-recipe/fields.ts` came to send a reader to the top of a menu for a row
one level down. The tree was a TypeScript-API pass over `plugins/`,
`packages/` and `products/`: object literals with a `label`, edges from each
`subMenu`, calls followed into the helpers that return `MenuItem[]`.
It reached 207 labels and linked 99 of them to a parent — 48% of the figure
recipes' 238 paths, with real rows like `Show pileup` and `Show coverage`
missing outright because their menus are built through item factories
(`toggleItem('Show coverage', …)`) rather than `label:` properties. Two
independent faults, either one disqualifying. Coverage: half the corpus is
skipped and a skipped path looks exactly like a checked one. Soundness: menus
differ per display, so "is this row served at the top of a menu" has no single
answer — `Show legend` is top-level on one track and inside `Show...` on
another, and a doc path saying `Track menu → Show legend` passed the finished
check. A gate that passes its own sabotage is the failure this repo's checkers
are written against.
What it was worth was one run as a lead generator, which is how the noun bug
behind `check-spec-recipes`' height gate was found: 19 candidate paths, 18 of
them the tree's own gaps and one a real 31-figure defect. Run that way it needs
no committed exemption list and makes no promise. Reach for it again by
writing it, using it and deleting it; do not wire it into `check-docs`.
