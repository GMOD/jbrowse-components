`groupBy` splits a pileup into labeled lanes, each laid out independently — by
haplotype (`HP`), cell barcode, or any tag the BAM/CRAM carries. Pairing
`colorBy` on the same tag shades each lane distinctly, so `HP:0`, `HP:1` and the
unassigned reads read apart at a glance.

Both are
[LinearAlignmentsDisplay](https://jbrowse.org/jb2/docs/config/linearalignmentsdisplay/)
slots, set here as a `displaySnapshot` on an `init.tracks` entry. See
[custom display options](../alignments-tracks/#alignments-track-options) for the
rest of them.
