# Per-read body fill for a color-by scheme, returned as literal hex so read
# bodies share one scale_fill_identity() with the mismatch ticks. Mirrors
# JBrowse's read color schemes: normal (grey, the default), strand (pink fwd /
# blue rev), mappingQuality (a fixed-saturation hue ramp over MAPQ, treating
# MAPQ as a hue in degrees like the GPU renderer), insertSize (pink short / red
# long / grey normal, thresholds = a robust median +/- 3*1.4826*MAD over the
# primary proper-pair |TLEN| values, matching getInsertSizeStats),
# pairOrientation (grey LR / teal RL / blue RR / green LL, with an unmapped-mate
# and an inter-chromosomal bucket that override the orientation hue like JBrowse).
read_fill_colors <- function(reads, color_by = "normal") {
  hue_ramp <- function(h) {
    hp <- (h %% 360) / 60; cc <- 0.5; mm <- 0.25
    x <- cc * (1 - abs(hp %% 2 - 1))
    r <- ifelse(hp < 1, cc, ifelse(hp < 2, x, ifelse(hp < 4, 0, ifelse(hp < 5, x, cc))))
    g <- ifelse(hp < 1, x, ifelse(hp < 3, cc, ifelse(hp < 4, x, 0)))
    b <- ifelse(hp < 2, 0, ifelse(hp < 3, x, ifelse(hp < 5, cc, x)))
    grDevices::rgb(r + mm, g + mm, b + mm)
  }
  if (color_by == "strand") {
    ifelse(reads$strand == "-", "#8F8FD8", "#EC8B8B")
  } else if (color_by == "mappingQuality") {
    hue_ramp(reads$mapq)
  } else if (color_by == "insertSize") {
    # JBrowse derives the short/long thresholds from primary proper-pair reads
    # only (SAM flag 0x2 set, 0x100/0x800 clear) with |TLEN| > 0, using a robust
    # spread: median +/- 3*1.4826*MAD, falling back to mean +/- 3*sd when MAD is 0,
    # lower bound clamped at 0. The MAD ignores the right-skewed SV tail that would
    # otherwise inflate sd and drive the lower bound negative, hiding every short
    # insert. sd is population (divide by n) to match getInsertSizeStats. A read
    # with |TLEN| == 0 (unpaired) is always "normal", never "short".
    is <- reads$isize
    proper <- bitwAnd(reads$flag, 0x2L) != 0 &
              bitwAnd(reads$flag, 0x100L) == 0 & bitwAnd(reads$flag, 0x800L) == 0
    obs <- is[proper & is > 0]
    if (length(obs)) {
      avg <- mean(obs); med <- median(obs); md <- median(abs(obs - med))
      s <- if (length(obs) > 1) sqrt(sum((obs - avg)^2) / length(obs)) else 0
      center <- if (md > 0) med else avg
      spread <- if (md > 0) 3 * 1.4826 * md else 3 * s
      upper <- center + spread; lower <- max(0, center - spread)
    } else { upper <- Inf; lower <- 0 }
    ifelse(is > upper, "#ff0000", ifelse(is > 0 & is < lower, "#ffc0cb", "#d3d3d3"))
  } else if (color_by == "pairOrientation") {
    pal <- c(LR = "#d3d3d3", RL = "#0099bb", RR = "#5555bb", LL = "#4d9a4d")
    col <- unname(pal[reads$orientation])
    col[is.na(col)] <- "#c8c8c8"                # unpaired / non-FR orientation
    col[reads$interchrom] <- "#6e4b3a"          # mate on another chromosome
    col[reads$mate_unmapped] <- "#b05a20"       # unmapped mate wins (like JBrowse)
    col
  } else {
    rep("#d3d3d3", nrow(reads))
  }
}
