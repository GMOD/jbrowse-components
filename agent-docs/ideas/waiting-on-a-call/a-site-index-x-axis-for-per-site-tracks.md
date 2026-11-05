---
name: a-site-index-x-axis-for-per-site-tracks
description: methylartist plots methylation on a CpG-index x axis so a CpG island widens to the sites it holds. JBrowse has no ordinal x scale, and one would touch every shape, hit test, export and guide.
---

# A site-index x axis for per-site tracks

methylartist's `locus` and `region` plots place each CpG, or each window of
equal CpG count, in an equal-width column and draw lines from each column to its
genomic position. A CpG island then takes as much width as the sites in it. At
genomic x the same island spans a few pixels.

## What already answers the issue

The `window` step counts its `frame` in rows, so a moving average over a
per-CpG source runs over sites while the line stays at genomic x, under the
gene track. The methylation tutorial's last section is that view, on HG002's
two haplotypes over the Prader-Willi and Angelman domain. Issue 5510 asked to
read methylation against gene annotation, and genomic x puts the genes directly
above the line.

## What an index axis costs

- The variant matrix computes its `variantLayout: 'columns'` geometry and its
  connector lines (`plugins/variants/src/shared/ConnectorLines.tsx`,
  `connectorCoordsByColumn`) from its own cell payload and feature index.
- ADR-210 declined an ordinal x that would have let the matrix draw through the
  `cell` mark, on cost.
- An index axis is a new x scale kind: every shape's placement, the hit test,
  SVG export, the ruler and the guides would read it
  (`reference/GRAMMAR_OF_GRAPHICS.md`, "No ordinal x").
- At the tutorial's 4.7 Mb view one haplotype holds about 52,000 CpGs, about 37
  per pixel, so equal-width columns need binning in index space as well.

## The call

Whether the island-widening view is a target. If it is, propose one ordinal x
that the variant matrix moves onto too, so `ConnectorLines` moves to
display-kit with two consumers.
