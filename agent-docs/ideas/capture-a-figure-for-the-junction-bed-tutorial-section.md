---
name: capture-a-figure-for-the-junction-bed-tutorial-section
description: the tutorial section on junction files as BED arcs has no figure, and capturing one needs a junction BED hosted first
---

# Capture a figure for the junction-BED tutorial section

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. Blocked on a data build and a host nobody has run, and
the section reads without it.

`bc04116182` added the RNA-seq tutorial section on loading junction files as BED
arcs and left it with prose only. Every other section on that page carries a
still, so the one route a reader is most likely to get wrong — which column the
score comes from, and what the arcs look like once they land — is the one with
nothing to compare against.

**The blocker is data, not capture.** The section names a junction BED that is
not hosted anywhere, so a spec pointing at it has nothing to fetch. That means a
`scripts/build_*.sh` producing the BED from a public RNA-seq alignment, then
`scripts/deploy-demo.sh` — never `aws s3 cp`, which does no versioning. Neither
has been run.

Once it is hosted the figure is ordinary: a spec in `website/scripts/specs/`,
`pnpm figures:push --filter`, commit `figures.lock`.
