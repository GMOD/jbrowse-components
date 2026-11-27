---
name: collinear-gene-ribbons-merge-into-block-ribbons
description: A multiway lane pair over a gene-pair source draws one thin ribbon per ortholog group even where they run collinear; chaining each run into one block ribbon cuts the clutter and the SVG node count but changes what a ribbon is for hover.
---

# Collinear gene ribbons merge into block ribbons

Most `MultiWaySyntenyDisplay` ribbons are individually thin and collectively
collinear. Collapsing each collinear run into one block ribbon, per lane pair,
would cut both the clutter and the SVG node count. The chaining is
DAGchainer's: walk the shared groups in the upper lane's order and extend a run
while the lower lane's rank advances by one in the same direction.

A source that states its own blocks, an MCScan `.anchors` file, draws them under
its gene ribbons already
([ADR-281](../../architecture-decision-records/adr-281-a-sources-blocks-draw-under-its-gene-pairs.md)),
with the gene ribbons still the hover unit. This is for the sources that state
none.

Lane ordering could use the runs too: seed with the densest lane, then append
whichever unused lane shares the most collinear runs with the last one placed,
which shortens the travel and keeps the density-first property that keeps
chains running.

## The call

Hover reads one ortholog group today. A run either becomes the hover unit or
carries its members, and which is the call.

Drawing blocks only below a zoom threshold was declined on 2026-09-21: ribbons
switching between blocks and genes at the threshold read as flicker now that
lane moves animate.
