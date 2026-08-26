# Which modification types were basecalled on only ONE strand ("simplex"). The MM
# tag names each group's strand: "C+m" is 5mC on the read's own strand, "C-m" the
# same cytosine read from the other side. A type seen on '+' with no '-' partner
# anywhere was examined on one strand only, and mod_coverage must then divide by
# the reads on that strand alone - dividing by every read carrying the base would
# halve each bar, since half of them could never have shown the call.
#
# Takes the "<sign><type>" pairs bam_modifications hangs on its result as the
# "mm_strands" attribute, pooled over every region: simplex-ness is a property of
# the protocol, not of a read or a window, and a single read can lack the '-' call
# just by covering no eligible base. Mirrors detectSimplexModifications.
mod_simplex_types <- function(pairs) {
  pairs <- unique(pairs[!is.na(pairs)])
  if (!length(pairs)) return(character(0))
  mmsign <- substr(pairs, 1, 1); type <- substring(pairs, 2)
  setdiff(unique(type[mmsign == "+"]), unique(type[mmsign == "-"]))
}
