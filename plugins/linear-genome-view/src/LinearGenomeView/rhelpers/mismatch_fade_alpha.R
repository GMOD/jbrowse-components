# JBrowse's low-frequency mismatch fade, per tick: frequencyFade over
# computeMismatchFrequencies + the depth threshold. Zoomed in (<= 1 bp/px) every
# tick is opaque (1). Zoomed out, alpha = pxPerBp lifted toward 1 by the base's
# frequency (reads with that base at the column / depth, rounded to a 0-255 byte
# like the shader), and a base whose byte-frequency is below snp_freq_threshold(
# depth) is held at the faint pxPerBp noise floor. 'depth' is a bam_coverage()
# data.frame(pos, depth). Returns an alpha vector aligned to refpos/base.
mismatch_fade_alpha <- function(refpos, base, depth, bp_per_px) {
  n <- length(refpos)
  if (bp_per_px <= 1) return(rep(1, n))
  base_alpha <- 1 / bp_per_px
  count <- ave(refpos, refpos, base, FUN = length)     # reads with this base here
  d <- depth$depth[match(refpos, depth$pos)]
  freq <- ifelse(!is.na(d) & d > 0, count / d, 0)
  fb <- pmin(255L, as.integer(round(freq * 255)))      # frequency as a 0-255 byte
  thr <- snp_freq_threshold(d)
  fb[!is.na(thr) & (fb / 255) < thr] <- 0L             # below threshold -> noise floor
  base_alpha + (fb / 255) * (1 - base_alpha)
}
