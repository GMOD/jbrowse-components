---
name: a-feature-past-a-chromosome-end-draws-as-one-in-the-linear-view
description: A feature crossing a circular origin draws as two pieces at opposite chromosome ends, and a soft clip past an unpadded chromosome end (T2T, de novo, telomeres) has nowhere to draw. Decide whether either wants a padded or wrapped range, or stays cut.
---

# A feature past a chromosome end draws as one in the linear view

Left over from GMOD/jbrowse-components#2471, closed 2026-11-25.

## What exists

The circular view, `circularRefNames`, and the GFF3 origin cut that rejoins the
pieces in the feature details (`plugins/gff3/src/originSpanning.ts`,
`recordAcrossOrigin`) answer the issue's "make a circular viewer" half.

## What is open

- **A wrapped feature is two pieces in the linear view**, one at each end of the
  chromosome. Drawing it as one needs coordinates past the end (adapters
  already tend to emit those) and a view that lets the range run past the
  sequence.
- **Soft clips and telomeres past the ends.** hg19 and hg38 pad the ends with
  Ns, so **Show soft clipped** extends into the padding. T2T and most de novo
  assemblies have none, so the clip has nowhere to draw.

## The call

Whether the linear view ever scrolls past a chromosome end (a padded region) or
keeps the cut. The cut is cheap and already shipped; the padded range touches
every renderer's region bounds.
