---
title: Sequence search
description:
  Search the reference sequence for a pattern, CRISPR guide, or named motif list
guide_category: Sequence tools
---

**TL;DR:** The linear genome view's **Sequence search** menu item searches the
reference sequence itself and adds the hits as a new track, whether or not a
sequence track is displayed. Three modes:

- Sequence pattern - find every occurrence of a single DNA motif or regex across
  the reference.
- CRISPR guide RNAs - discover candidate guides and their PAM sites directly
  against the reference.
- Motif list - search many named motifs at once, pasted as one per line. This is
  the mode for restriction enzymes; see below.

## Sequence pattern

Enter a sequence to find every occurrence in the reference. The field is a
regex, so `GAATTC` matches exactly and `TATA[AT]A[AT]` matches either variant.
Both strands are searched, case-insensitively; either can be turned off.

Most restriction sites are palindromic — the site reads the same on both
strands, which is how one enzyme cuts both — so such a hit is reported once,
unstranded, rather than twice at one position. This needs bare `ACGT`: regex
syntax has no reverse complement, and IUPAC codes are not regex (`N` matches a
literal N). Use [Motif list](#restriction-enzymes-and-other-named-motifs) for
IUPAC sites.

## CRISPR guide RNAs

Choose an enzyme preset (SpCas9 `NGG`, SaCas9 `NNGRRT`, Cas12a `TTTV`, ...) or
set the PAM, guide length, and PAM location by hand, and search either or both
strands. Each guide is drawn with a dedicated guide-RNA glyph: the protospacer
box, the PAM overpainted, and the predicted cut — one tick for a blunt cutter
like SpCas9, a staggered pair for Cas12a.

Clicking a guide reports its sequence, PAM, cut position, GC%, and two flags.
`hasPolyT` marks the `TTTT` run that terminates transcription from the pol III
promoters guides are usually expressed from. `softMasked` means the reference
lower-cased this protospacer, which marks it as repetitive. Both describe the
protospacer's own sequence; scoring a guide's specificity takes a genome-wide
search, and this mode runs a scan of the region in view. A protospacer that
reaches into an assembly gap is skipped.

To order oligos from a search, use **Save track data** on the track's menu. The
GFF3 export carries the guide sequence, PAM, cut positions, and flags as
attributes.

## Restriction enzymes and other named motifs

The **Motif list** mode takes a pasted list in the notation REBASE already uses,
one motif per line, with an optional name and an optional cut marker:

```
# name  site
EcoRI   G^AATTC
BamHI   G^GATCC
PstI    CTGCA^G
BsaI    GGTCTC(1/5)
```

There are two cut notations because there are two kinds of enzyme. A `^` marks a
cut inside the recognition site. The `(n/m)` form is for the type IIS enzymes
that cut _downstream_ of their site — BsaI, BsmBI, BbsI, SapI, AarI, the Golden
Gate workhorses — where `n` and `m` count from the site's 3' end to the top- and
bottom-strand cuts (negative numbers count back into the site).

The panel is prefilled with common cloning enzymes; wipe it and paste your own
set from REBASE or anywhere else. Sites may use
[IUPAC ambiguity codes](https://www.bioinformatics.org/sms/iupac.html) (e.g.
`GGTNACC`), blank lines and `#` comments are ignored, and a bare site with no
name names itself.

The cut notation carries the cuts themselves. `(n/m)` pins both strands' cuts
outright; a `^` pins the top-strand cut, and for a palindromic site the
bottom-strand cut mirrors it. So each hit reports both cut positions and whether
the enzyme leaves a 5' overhang, a 3' overhang, or a blunt end. The strand
checkboxes only appear when the list contains a motif that is actually stranded.

Because the list is just text, the same mode works for primers, adapters,
polylinker sites, or any other named motif set.

With more than one motif in the list, **Launch as one track** puts every motif's
matches in one track, distinguishable only by name, and **Launch one track per
motif** gives each its own lane.

<Video src="/media/ui/sequence_search_motifs.mp4" caption="The route on a view with no tracks open: the view menu's Sequence search, the Motif list mode and the enzymes it arrives prefilled with, three of them kept, and a lane per enzyme scanned out of the reference." />

## Ship a search in config.json

A search launched from the menu lives in your session. To put one in front of
everyone who opens the instance, write the same adapter into `config.json` as an
ordinary `FeatureTrack` — it names no file, since the assembly supplies the
sequence. Each adapter's page opens with a whole track config:
[](/docs/config/sequencesearchadapter), [](/docs/config/motiflistadapter) and
[](/docs/config/crisprguideadapter).

## See also

- [](/docs/user_guides/sequence_track)
- [](/docs/user_guides/feature_sequence)
- [](/docs/config_guides/file_types#computed-from-the-reference)
