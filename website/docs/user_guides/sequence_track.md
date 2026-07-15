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
assembly config maps a reference sequence to a different genetic code (for
example a mitochondrial contig), the translation rows for that sequence use the
matching codon table. See
[Configuring alternative genetic codes](/docs/config_guides/assemblies/#configuring-alternative-genetic-codes-translation-tables)
for how to set this up.

You can also extract or copy the sequence underlying selected features; see the
[Feature sequence panel](/docs/user_guides/feature_sequence) guide.

<Figure caption="The sequence track showing the reference sequence (top row) and six-frame translation (three frames per strand) at single-base resolution." src="/img/sequence_track.png" />

## Searching the reference sequence

The sequence track menu's **Sequence search** item searches the reference
sequence itself and adds the hits as a new track. It offers three modes:

- Sequence pattern - find every occurrence of a single DNA motif or regex across
  the reference.
- CRISPR guide RNAs - discover candidate guides and their PAM sites directly
  against the reference. Choose an enzyme preset (SpCas9 `NGG`, SaCas9 `NNGRRT`,
  Cas12a `TTTV`, …) or set the PAM, guide length, and PAM location by hand, and
  search either or both strands. Each guide is drawn with a dedicated guide-RNA
  glyph and annotated with its GC% and a poly-T flag, so you can eyeball guide
  quality without leaving the view.
- Motif list - search many named motifs at once, pasted as one per line. This is
  the mode for restriction enzymes; see below.

### Restriction enzymes and other named motifs

The **Motif list** mode takes a pasted list in the notation REBASE already uses,
one motif per line, with an optional name and an optional `^` marking the cut:

```
# name  site
EcoRI   G^AATTC
BamHI   G^GATCC
PstI    CTGCA^G
```

The panel is prefilled with common cloning enzymes, but nothing about the list
is built in - wipe it and paste your own set from REBASE or anywhere else. Sites
may use [IUPAC ambiguity codes](https://www.bioinformatics.org/sms/iupac.html)
(e.g. `GGTNACC`), blank lines and `#` comments are ignored, and a bare site with
no name simply names itself.

The `^` is what makes this more than a motif search: it pins the top-strand cut,
and for a palindromic site (which most restriction sites are) the bottom-strand
cut mirrors it, so each hit reports both cut positions and whether the enzyme
leaves a 5' overhang, a 3' overhang, or a blunt end. Palindromic sites read the
same on both strands, so they are reported once rather than twice, and the
strand checkboxes only appear when the list contains a motif that is actually
stranded.

Because the list is just text, the same mode works for primers, adapters,
polylinker sites, or any other named motif set - not only enzymes.

## See also

- [Gene track](/docs/user_guides/gene_track) - per-transcript translation,
  color-by-CDS, and peptide lettering
- [Feature sequence panel](/docs/user_guides/feature_sequence) - extract a
  feature's CDS, protein, cDNA, or genomic sequence
- [Assembly configuration](/docs/config_guides/assemblies) - reference sequence
  adapters and alternative genetic codes
- [GC content track](/docs/user_guides/gc_content_track) - computed on the fly
  from this track's sequence, launched from its track menu
