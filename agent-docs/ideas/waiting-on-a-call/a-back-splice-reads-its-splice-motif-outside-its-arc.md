---
name: a-back-splice-reads-its-splice-motif-outside-its-arc
description: A duplication-type split junction (a circRNA back-splice in RNA) reads no splice motif, so the non-canonical filter never drops one and the tooltip never says GT-AG. Its motif is two bases past each end of the arc. The call is which split classes read one and what the tooltip names.
---

# A back-splice reads its splice motif outside its arc

Found auditing circRNA support on 2026-11-12. A split junction reads no motif:
`computeSashimiJunctions` (`plugins/alignments/src/features/sashimi/compute.ts`)
ships `DINUCLEOTIDE_UNKNOWN` for both halves, `passesJunctionFilter`
(`junctions.ts`) counts unknown as canonical, and `formatSashimiTooltip`
(`LinearAlignmentsDisplay/components/tooltipUtils.ts`) leaves the motif and
strand lines off. So **Hide non-canonical** keeps every back-splice, and nothing
separates a real circle (GT-AG at the back-splice) from a reverse-transcription
template switch, which lands anywhere. find_circ and CIRI2 both check it.

## The mechanism

An N-gap splice spans the intron, so `spliceMotifDinucleotides` reads the donor
at `[start, start + 2)` and the acceptor at `[end - 2, end)`, inside the arc. A
back-splice's arc spans the circle's exons instead: the read leaves the donor
exon at the arc's `end` and re-enters at its `start`. Its GT is at
`[end, end + 2)` and its AG at `[start - 2, start)`, outside the arc. On the
demo's circHIPK3 (`chr11:33286412-33287511`) that reads `GT` and `AG`, the
canonical pair on the plus strand.

The rest is already built:

- `classifyEncodedSpliceMotif` takes the two halves as given, so the six
  canonical spellings and both strands work unchanged
- halves are encoded per end and merge independently (`mergeJunctions`), so an
  end outside one region's fetched sequence resolves from another's
- `junctionStrand` can tint a split junction by its motif's strand, as it does
  an N-gap splice that has no XS tag

The change is a sibling of `spliceMotifDinucleotides` that reads past the ends,
called for split junctions of the classes chosen below, and the tooltip lines
shown for them. The reference window needs 2 bp past the view edge, which the
N-gap path already risks and answers with unknown.

## The calls

- **Which classes read a motif.** Duplication-type is the back-splice. A
  deletion-type split in RNA is a linear splice the aligner wrote as chimeric,
  and it reads the inside motif like an N gap. Inversions have no splice
  reading. Recommended: duplication outside, deletion inside, inversion none.
- **What the filter does to DNA.** In a DNA library a tandem duplication's
  split reads nearly always land on non-canonical bases, so **Hide
  non-canonical** would start dropping them. That seems right, since the reader
  asked for it, but it changes what an SV figure with that filter set shows.
- **What the tooltip calls it.** ADR-231 keeps one class vocabulary for DNA and
  RNA, so `junction.class` stays `duplication`. The tooltip could add the motif
  line alone ("GT-AG (canonical)"), or name a canonical duplication-type split
  "back-splice". Recommended: the motif line alone, which says the same thing
  to an RNA reader without claiming biology on DNA.

## How it proves out

A unit test in `compute.test.ts` with a reference holding GT and AG outside a
`splitBack` junction, and the circRNA demo's ZKSCAN1 and circHIPK3 back-splices
hovering "GT-AG (canonical)". The RN7SL2/RN7SL3 artifact at chr14:49.85 Mb
(`demos/circrna/README.txt`) is the candidate for a non-canonical one.
