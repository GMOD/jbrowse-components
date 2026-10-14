---
name: a-site-index-x-axis-for-per-site-tracks
description: methylartist draws its smoothed methylation on an x axis of CpG index, one equal-width column per site or per equal-CpG window, tied back to the genome by connector lines, so a CpG island widens to the sites it holds. The `window` step already smooths over sites at genomic x (issue 5510's figures), with the gene track above the line. An index axis is a new ordinal x scale that every shape, hit test, SVG export and guide reads, and the variant matrix computes its columns inside its own display (ADR-210 declined an ordinal x there). Build it as one ordinal x the matrix moves onto too, once someone names the island-widening view as the target.
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
