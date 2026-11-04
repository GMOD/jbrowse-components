---
name: screenshot-anchors-for-reads-arcs-blocks-and-cells
description: Screenshot callouts and clicks that still guess a fraction of a track because nothing names what they point at - an alignments read, a sashimi arc or link mark, a synteny chain block or multi-way lane record, an MSA cell, a wiggle value, an alignments group band - plus VCF records labelled only by their allele list or drawn with no label. Each new anchor kind asks the display, as `featuresNamed` and the tree sidebar's row geometry already answer `feature` and `row`.
---

# Anchors for what `feature` and `row` cannot name

The `feature` and `row` anchors (`products/jbrowse-capture/src/featureAnchor.ts`,
`rowAnchor.ts`) cover records, genes, codons and rows. What is left of a spec's
`fracY`/pixel guesses points at things neither names. Each needs the display to
say where it drew one, the way `featuresNamed` does, resolved through capture's
`resolveAnchor` so a click and its callout cannot part.

- **A record with no usable name**: `graph-hprc.ts`'s KIV-2 and ABCA7
  tandem-repeat clicks (`RECORD_BAR`). With no ID, or an ID followed by every
  allele, the label is the whole allele list. A record whose band draws no
  label at all, `cancer_sv/derivative_inserts`'s collapsed truth set
  (`truthset_8_1`), has nothing to match either. Matching a record's VCF ID on
  its own, beside the label's two lines and whether or not a label is drawn,
  would cover all three.
- **An alignments read** (`alignments.ts`, `ui.ts`, `cancer_sv.ts`,
  `bovine_bola`), by read name.
- **A sashimi arc or `link` mark** (`alignments.ts`, `cancer_sv.ts` K562,
  `protein_figure_met_ex14.ts`), by its two ends.
- **A synteny chain block or multi-way lane record** (`synteny.ts`,
  `videos/synteny.ts`).
- **An MSA cell** (`msa.ts`, `protein_variants.ts`'s `hoverAlignment` pixel
  offsets on `msa_canvas`), by row name and column. `sod1_codon_hover`'s hover
  moved from dog_query to rabbit when the ortholog set above it lost a row.
- **A wiggle value** (`dog10k.ts` `fstY` copies the plot inset), by locus and
  score through the display's own y scale.
- **An alignments group band** (`methylation/hg002_snrpn_grouped`, held by a
  `text` stopgap).
- **The dotplot drag** in `synteny_from_dotplot_view` wants its corners as
  `hLoc`/`vLoc` loci, which clicks already accept.

One record anchor needs no new kind: `videos/sv.ts`'s HGSV_1821 click becomes
`{ trackId, feature: 'HGSV_1821' }` when that tour is next filmed.

A fraction stays the right word on a score axis, a whole-track box, a pileup's
or a matrix's whole extent, a ribbon, and a label parked in empty lane space
(`protein/snca_e46k`'s "5.8 kb not shown", `protein/hbb_gwas_catalog`'s stack of
every GWAS hit, `ld/lct_haploblock`'s two cluster pills).
