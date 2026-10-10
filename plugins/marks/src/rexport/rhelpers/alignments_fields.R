# Add the read dimensions an alignments display colors and facets by, over a
# read_bam frame: firstOfPairStrand (a second mate's strand flipped), mapq (NA
# for unavailable), pairOrientation (LR, RL, RR or LL, "" for a read with
# none), insertSize (short, normal or long against the band below), and mate,
# which names the reads every mate-aware coloring paints alike: unmappedMate,
# then interchrom, else NA.
#
# The insert-size band is JBrowse's: median +/- 3 * 1.4826 * MAD of |TLEN| over
# primary proper pairs (mean +/- 3 sd where the MAD is 0), widened to at least
# 2x and at most 0.5x its centre. A band with no width colors nothing, and
# |TLEN| 0 is never short. Each region takes its own band, as the browser
# samples each region's reads alone. 'cuts', the display's two insert-size cut
# points, replace the band.
alignments_fields <- function(reads, cuts = NULL) {
  bit <- function(f) bitwAnd(reads$flags, f) != 0
  reads$firstOfPairStrand <- ifelse(bit(0x80L), -reads$strand, reads$strand)
  reads$mapq <- reads$score
  lr <- c(F1R2 = "LR", F2R1 = "LR", R1F2 = "RL", R2F1 = "RL",
          R1R2 = "RR", R2R1 = "RR", F1F2 = "LL", F2F1 = "LL")
  po <- unname(lr[reads$pair_orientation])
  reads$pairOrientation <- ifelse(is.na(po), "", po)
  tlen <- abs(reads$template_length)
  sampled <- bit(0x2L) & !bit(0x100L) & !bit(0x800L) & tlen > 0
  band_of <- function(sample) {
    if (!is.null(cuts)) return(c(lower = min(cuts), upper = max(cuts)))
    if (!length(sample)) return(NULL)
    med <- median(sample); mad <- median(abs(sample - med))
    center <- if (mad > 0) med else mean(sample)
    spread <- 3 * (if (mad > 0) 1.4826 * mad else sqrt(mean((sample - center)^2)))
    upper <- center + spread; lower <- max(0, center - spread)
    if (upper <= lower) return(NULL)
    mid <- (upper + lower) / 2
    c(lower = max(0, min(lower, mid * 0.5)), upper = max(upper, mid * 2))
  }
  region <- if (is.null(reads$.region)) rep(1L, nrow(reads)) else reads$.region
  reads$insertSize <- rep("normal", nrow(reads))
  for (i in split(seq_len(nrow(reads)), region)) {
    band <- band_of(tlen[i][sampled[i]])
    if (!is.null(band)) reads$insertSize[i] <- ifelse(tlen[i] > band[["upper"]], "long",
      ifelse(tlen[i] > 0 & tlen[i] < band[["lower"]], "short", "normal"))
  }
  interchrom <- bit(0x1L) & !is.na(reads$next_ref) & reads$next_ref != reads$refName
  reads$mate <- ifelse(bit(0x1L) & bit(0x8L), "unmappedMate",
    ifelse(interchrom, "interchrom", NA_character_))
  reads
}
