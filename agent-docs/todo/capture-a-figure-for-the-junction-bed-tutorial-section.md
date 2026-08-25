---
name: capture-a-figure-for-the-junction-bed-tutorial-section
description: the tutorial section on junction files as BED arcs has no figure, and capturing one needs a junction BED hosted first
metadata:
  area: figures, rnaseq
  category: ready
---

# Capture a figure for the junction-BED tutorial section

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
