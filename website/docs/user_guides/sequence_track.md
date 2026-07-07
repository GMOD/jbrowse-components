---
title: Sequence track
description: Reference sequence display
guide_category: Track types
---

The sequence track appears automatically when an assembly is loaded. It shows
the reference sequence and a six-frame translation (three frames per strand).
The sequence and translation are only visible when zoomed in to base resolution,
and are hidden when zoomed further out. If the view is horizontally flipped, the
sequence is shown reverse-complemented, and the forward/reverse strand rows swap
places accordingly.

By default the translation uses the standard genetic code (NCBI table 1). If the
assembly config maps a reference sequence to a different genetic code — for
example a mitochondrial contig — the translation rows for that sequence use the
matching codon table. See
[Configuring alternative genetic codes](/docs/config_guides/assemblies/#configuring-alternative-genetic-codes-translation-tables)
for how to set this up.

You can also extract or copy the sequence underlying selected features; see the
[Feature sequence panel](/docs/user_guides/feature_sequence) guide.

<Figure caption="The sequence track showing the reference sequence (top row) and six-frame translation (three frames per strand) at single-base resolution." src="/img/sequence_track.png" />

## See also

- [Gene track](/docs/user_guides/gene_track) — per-transcript translation,
  color-by-CDS, and peptide lettering
- [Feature sequence panel](/docs/user_guides/feature_sequence) — extract a
  feature's CDS, protein, cDNA, or genomic sequence
- [Assembly configuration](/docs/config_guides/assemblies) — reference sequence
  adapters and alternative genetic codes
- [GC content track](/docs/user_guides/gc_content_track) — computed on the fly
  from this track's sequence, launched from its track menu
