---
id: multivariant_track
title: Multi-sample variant displays
description: Population-level variant views
guide_category: Track types
---

A VCF can contain genotypes for many samples. JBrowse shows them with one of two
displays, switchable from the track menu:

- **Multi-sample variant display (regular)** — variants drawn at their true
  genomic positions, one row per sample
- **Multi-sample variant display (matrix)** — variants laid out as a heatmap,
  one row per sample and one column per variant

## Regular — best for full SV detail

Each variant is drawn at its real genomic position. This is the only
multi-sample display that renders structural variants at the right scale;
overlapping calls use slight transparency so you can still tell them apart.

If overlaps overwhelm the view, use "Edit filters" in the track menu to hide
variants by size, name, or any Jexl expression.

## Matrix — best for SNP/indel patterns

Each visible variant gets one column and each sample gets one row, regardless of
how far apart the variants are on the genome. A thin black line connects each
column to its real genomic position.

This packs sparse small variants into a readable layout. A 100kb region with one
SNP per kb has ~100 variants on screen — only 1–2px wide each in the regular
display, but ~20px each in the matrix display on a 2000px screen. Patterns like
shared haplotypes, runs of homozygosity, and population structure become visible
at a glance.

## Walkthroughs

- [Phased trio analysis](/docs/tutorials/analyze_trio) — matrix display with a
  phased SNP trio
- [Multi-sample SVs (1000 Genomes)](/docs/tutorials/sv_multisamples) — regular
  display across a large SV cohort
