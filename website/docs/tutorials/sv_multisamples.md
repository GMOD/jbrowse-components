---
id: sv_multisamples
title: Multi-sample SV visualization with 1000 Genomes
description:
  Inspect population-level SVs, explore a family trio, and characterize a large
  chromosomal inversion
guide_category: Tutorials
---

import Figure from '../figure'

This tutorial explores structural variants (SVs) from the 1000 Genomes Project
using JBrowse's multi-sample visualization tools. We cover three connected
analyses:

- Browsing population-level SV calls and their genotype distribution
- Examining SV inheritance in a parent–child trio
- Characterizing a large chromosomal inversion on chr19

For SNP-level trio analysis — phased genotypes, IBD blocks, and crossing-over
visualization — see the companion
[Analyzing a phased trio](/docs/tutorials/analyze_trio) tutorial.

## Dataset

The [1000 Genomes Project](https://www.internationalgenome.org/) sequenced
genomes from 2,504 individuals across 26 populations. The 2022 high-coverage
re-analysis produced a comprehensive SV callset
([Byrska-Bishop et al., 2022](https://doi.org/10.1016/j.cell.2022.08.004)) that
includes deletions, insertions, inversions, and translocations with per-sample
genotypes across all 2,504 individuals.

For this tutorial we use a pre-configured JBrowse instance that already has the
SV callset and trio BAM tracks loaded. No data download is required.

## Getting started

Open the 1000 Genomes demo instance and enable the variant track from the track
selector (top-left menu icon of any linear view):

[Open the 1000 Genomes demo](https://jbrowse.org/code/jb2/latest/?config=/genomes/GRCh38/1000genomes/config_1000genomes.json)

Under **Variant calls** in the track selector, enable the 1KGP 2022 Illumina
ensemble SV callset. A track of orange SV bars will appear across the genome.

## Browsing SVs with the SV inspector

The SV inspector combines a searchable/filterable table of all calls with a
whole-genome circular overview. Open it from the menu bar: **Add → SV Inspector
view**, then provide the VCF from the demo config (the URL is listed in the
track's About track menu). The circular view renders inter-chromosomal
translocations as orange chords; the table can be sorted and filtered by any
column.

<Figure caption="The SV inspector loaded with a large SV callset. The circular plot on the right renders inter-chromosomal events as orange chords connecting the two loci. The table on the left lists every call and can be sorted or filtered by SVTYPE, chromosome, quality, or any INFO field. Clicking a row navigates the linear view to that locus." src="/img/sv_inspector_importform_loaded.png" />

Useful filters to try:

- Type `DEL` in the SVTYPE column to isolate deletions
- Type `INV` to isolate inversions — these appear as arcs within a single
  chromosome arm rather than inter-chromosomal chords
- Click any row to jump directly to that locus in the linear view

For a full walkthrough of loading data into the SV inspector, see the
[SV inspector guide](/docs/user_guides/sv_inspector_view).

## Per-sample genotypes

With the SV track loaded in the linear view, click any variant bar to open its
feature details panel. Scroll to the **SAMPLES** section — this lists every
sample in the cohort with its genotype (GT), read depth, and other per-sample
fields.

To see the genotype pattern across many SVs at once, switch display modes:

**Track menu → Display types → Multi-sample variant display (regular)**

This draws one row per sample in the track so you can scan across many variants
simultaneously and spot which calls are private to a single sample, shared
within a family, or present at high allele frequency across the cohort. See
[Multi-sample variant displays](/docs/user_guides/multivariant_track) for
details on the display modes.

## Inspecting a trio

The demo includes BAM tracks for a parent–child trio, available under **1000
Genomes → Alignments** in the track selector. Load all three (mother, father,
child) to stack them beneath the variant track.

[Open the extended trio session](https://jbrowse.org/code/jb2/latest/?config=/genomes/GRCh38/1000genomes/config_1000genomes.json&session=share-SUK-mntGyB&password=eQF0F)

Once you have an SV of interest, check the three trio rows in the SAMPLES table
and the corresponding read tracks:

<Figure caption="Multi-sample SV view with trio BAM tracks loaded. The top track shows the 1KGP SV callset; the three alignment tracks below are the mother, child, and father. The feature details panel on the right shows the BREAKENDS section (with a link to open the breakpoint split view) and the SAMPLES table listing each sample's GT, depth, and other per-sample fields." src="/img/multi-sv-trio.png" />

| Genotype pattern            | Interpretation                               |
| --------------------------- | -------------------------------------------- |
| Child 0/1, both parents 0/0 | Candidate de novo SV                         |
| Child 0/1, one parent 0/1   | Inherited from that parent                   |
| Child 1/1, both parents 0/1 | Homozygous — inherited copy from each parent |
| Child 0/0                   | Not present in this individual               |

The trio alignment tracks let you verify read-level support for each genotype.
Look for coverage changes, soft-clipped reads, or orientation anomalies in each
family member's track at the SV locus. For a primer on reading these signals,
see the [SV visualization guide](/docs/user_guides/sv_visualization).

For SNP-level trio phasing and IBD block analysis with the matrix display, see
the [Analyzing a phased trio](/docs/tutorials/analyze_trio) tutorial.

## The chr19 large inversion

The 1KGP SV callset includes a large well-studied inversion polymorphism on
chromosome 19. Navigate to **chr19:41,700,000–42,000,000**.

At this scale the variant track shows the inversion call as a wide bar spanning
the region. To separate samples by genotype, use:

**Track menu → Cluster by genotype**

This groups samples into ref/ref (0/0), het (0/1), and hom-alt (1/1) rows,
making the population frequency of the inversion immediately visible — most
samples are reference homozygous, with a subset carrying one or two copies of
the inverted allele.

<Figure caption="chr19 region containing the large inversion shown in the 1KGP SV callset alongside pileup tracks from multiple samples. The dense colored variation in the alignment tracks reflects the two orientations of the inverted segment segregating in the population. The track selector panel on the right shows the 1000 Genomes track categories; enabling 1000 Genomes → Alignments adds coverage and pileup panels per sample." src="/img/multisv.png" />

[Open the inversion demo session](https://jbrowse.org/code/jb2/latest/?config=/genomes/GRCh38/1000genomes/config_1000genomes.json&session=share-DN_h4SIwo4&password=CxkLw)

### Read orientation evidence at the breakpoints

Zoom in to one of the inversion breakpoints (approximately chr19:41,749,000 or
chr19:41,902,000) and enable pair orientation coloring on a BAM track:

**Track menu → Pileup settings → Color by... → Pair orientation**

At the breakpoint you will see:

- **Teal (LL)** pairs — both mates mapping to the forward strand — and **dark
  blue (RR)** pairs — both mates mapping to the reverse strand — clustering at
  the junction. These are the hallmark orientation signal of an inversion: reads
  that straddle the breakpoint change from the normal LR orientation to same-
  direction LL or RR.
- **Soft-clipped reads** at the exact breakpoint edge, where reads cannot align
  through the junction sequence

Switch to the Read arc display (**Track menu → Display types → Read arc
display**) to see the long-range connections spanning the inversion. Arcs with
LL/RR coloring that span the inverted interval confirm the rearrangement.

See the
[SV visualization guide — Inversion section](/docs/user_guides/sv_visualization#inversion)
for diagrams of these orientation patterns.

### Breakpoint split view

Click the inversion bar in the variant track to open feature details. In the
**BREAKENDS** section, click the split view link. This opens both inversion
breakpoints side-by-side in synchronized panels, with splines connecting
supporting reads across both panels and the variant call drawn as a colored line
with directional feet.

For more on navigating the breakpoint split view, see
[Breakpoint split view](/docs/user_guides/sv_visualization#breakpoint-split-view).

## Summary

| Step                    | Tool                                        | What to look for                                             |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| Population triage       | SV inspector table + circular view          | SV type counts; inter-chr translocations as chords           |
| Per-sample genotypes    | Feature details → SAMPLES                   | GT 0/0 / 0/1 / 1/1 across all 2,504 samples                  |
| Genotype patterns       | Multi-sample display (regular)              | High-frequency vs private calls; row pattern per sample      |
| Trio inheritance        | Trio BAM tracks + SAMPLES table             | De novo vs inherited; which parent contributed the alt       |
| Inversion genotyping    | Cluster by genotype                         | Alt-genotype samples grouped into distinct rows              |
| Inversion read evidence | Pair orientation coloring; Read arc display | LL/RR pairs at breakpoints; long arcs spanning the inversion |
| Breakpoint detail       | Breakpoint split view                       | Splines + variant call across both junctions                 |

## See also

- [SV visualization guide](/docs/user_guides/sv_visualization) — reference for
  all SV display types and SV-type read signatures
- [SV inspector guide](/docs/user_guides/sv_inspector_view) — loading data into
  the SV inspector
- [Multi-sample variant displays](/docs/user_guides/multivariant_track) —
  regular and matrix display mode details
- [Analyzing a phased trio](/docs/tutorials/analyze_trio) — SNP-level trio
  phasing and IBD block analysis
- [Cancer Genome in a Bottle (SVs)](/docs/tutorials/sv_visualization_cgiab) —
  end-to-end SV workflow with a cancer dataset
