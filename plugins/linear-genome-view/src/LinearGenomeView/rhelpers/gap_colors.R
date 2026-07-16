# JBrowse's CIGAR-gap colors: deletion grey, skip/intron teal, insertion purple.
# A deletion paints a grey full-height rect over the read body; a spliced intron
# erases the body and leaves a thin teal connector line; an insertion is a thin
# purple tick marking sequence absent from the reference.
gap_colors <- c(D = "#808080", N = "#009a8a", I = "#800080")
