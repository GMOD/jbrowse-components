---
title: Sequence search
description:
  Search the reference sequence for a pattern, CRISPR guide, or named motif list
guide_category: Other features
---

The linear genome view's menu has a **Sequence search** item that searches the
reference sequence itself and adds the hits as a new track. It works whether or
not a sequence track is currently displayed. It offers three modes:

- Sequence pattern - find every occurrence of a single DNA motif or regex across
  the reference.
- CRISPR guide RNAs - discover candidate guides and their PAM sites directly
  against the reference.
- Motif list - search many named motifs at once, pasted as one per line. This is
  the mode for restriction enzymes; see below.

## CRISPR guide RNAs

Choose an enzyme preset (SpCas9 `NGG`, SaCas9 `NNGRRT`, Cas12a `TTTV`, ...) or
set the PAM, guide length, and PAM location by hand, and search either or both
strands. Each guide is drawn with a dedicated guide-RNA glyph and annotated with
its GC% and a poly-T flag, so you can eyeball guide quality without leaving the
view.

## Restriction enzymes and other named motifs

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

With more than one motif in the list, two buttons are available:

- **Launch as one track** - all matches for every motif go into a single track,
  distinguishable from each other only by name (label or hover tooltip).
- **Launch one track per motif** - each motif gets its own track, so enzymes are
  visually separable without relying on labels.

## See also

- [Sequence track](/docs/user_guides/sequence_track)
- [Feature sequence panel](/docs/user_guides/feature_sequence)
