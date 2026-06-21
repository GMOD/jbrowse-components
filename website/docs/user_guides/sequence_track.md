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
