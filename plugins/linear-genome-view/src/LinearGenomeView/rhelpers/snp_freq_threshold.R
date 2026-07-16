# JBrowse's depth-dependent low-frequency threshold (featureFrequencyThreshold):
# a mismatch base is significant only above 80% of depth below 10x, easing to 30%
# at >=30x. Drives the pileup mismatch fade (mismatch_fade_alpha), not the coverage
# panel (which shows every fraction).
snp_freq_threshold <- function(depth) {
  ifelse(depth < 10, 0.8, ifelse(depth >= 30, 0.3, 0.8 + (depth - 10) / 20 * (0.3 - 0.8)))
}
