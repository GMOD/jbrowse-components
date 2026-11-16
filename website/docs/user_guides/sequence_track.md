---
title: Sequence track
description: Reference sequence display
guide_category: Track types
---

The sequence track appears when an assembly is loaded, showing the reference
sequence and a six-frame translation (three frames per strand), drawn only at
base resolution. In a horizontally flipped view the sequence is
reverse-complemented and the forward and reverse strand rows swap places.

The translation uses the standard genetic code (NCBI table 1), or the code the
assembly config maps a reference sequence to, such as a mitochondrial contig's;
see
[Configuring alternative genetic codes](/docs/config_guides/assemblies/#configuring-alternative-genetic-codes-translation-tables).
To extract the sequence under a feature, see
[](/docs/user_guides/feature_sequence).

<Figure caption="The sequence track showing the reference sequence (top row) and six-frame translation (three frames per strand) at single-base resolution." src="/img/sequence_track.png" />

Searching the reference sequence for a pattern, CRISPR guide, or restriction
site is a view-level feature; see [](/docs/user_guides/sequence_search).

## Getting the sequence out

The track menu's **Launch → Get sequence (visible region)...** opens the
sequence for the window as FASTA, with reverse and complement toggles and a
download. A
[rubberband selection](/docs/user_guides/basic_usage#rubberband-selection) opens
the same panel for a span narrower than the window.

## See also

- [](/docs/user_guides/gene_track)
- [](/docs/user_guides/feature_sequence)
- [Assembly configuration](/docs/config_guides/assemblies)
- [](/docs/user_guides/gc_content_track)
- [](/docs/user_guides/sequence_search)
