---
name: tighten-the-gff3-redispatch-bound-to-records-whose-id-some
description: Tighten the GFF3 redispatch bound to records whose `ID` some line in the query actually names as a `Parent`, and let the layout take a gene's row count from the gene rather than from the children the fetch returned
area: rendering-and-displays
---

# Tighten the GFF3 redispatch bound to records whose `ID` some line in the query actually names as a `Parent`, and let the layout take a gene's row count from the gene rather than from the children the fetch returned

declined
2026-09-01, closing `handoffs/row-count-follows-the-fetch-window.md`.

The bound is total (every record with an `ID`, gff-nostream's `hasIdAttribute`) because
`layoutSubfeatures` sums the heights of whatever `subfeatures` the fetch
returned, so the count of children a window happens to cover sets the gene's
height and, through `GranularRectLayout`, every neighbour's row. Under the
parenthood bound `ctgA:12000-13000` on `volvox.sort.gff3.gz` returns 0
children for `BAC:999-20000` and `mRNA:12999-17200` where the shipped bound
returns 2 and 3 — 15 of 3000 sampled windows differ — and the gene drops from
an N-row stack to one bare row as the user pans.

The row count cannot come from the feature: GFF3 has no child-count attribute
and a parent line carries only its span, so a one-transcript and a
twelve-transcript gene read identically until their children are read. A
monotone per-`ID` height cache on the main thread would stop the pan-jitter
after a gene's children had been seen once, but not the first sight of a wide
parent whose children all lie outside the window — which the tighter bound
never fetches — and it would make layout depend on fetch history. The
payoff was also small: on every hosted and in-tree GFF3 surveyed the `ID` rule
already reduces the bound to what parenthood would, the one known exception
being hosted hg19 RefSeq's chromosome-long `region` record. The dependence of
layout on the fetched subfeature set is therefore what keeps the bound total,
and it is deliberate.
