# JBrowse's per-base-quality color ramp: each Phred score maps to HSL(hue, 55%,
# 50%) with hue = score * 1.5 (red at low quality -> yellow -> green at high), a
# maxed score pinned to green hue 150. Vectorized; HSL is converted to hex inline
# because base R has no HSL constructor (hsv() is a different color space).
quality_colors <- function(scores) {
  h <- ifelse(scores >= 255, 150, scores * 1.5)
  s <- 0.55; l <- 0.5
  cc <- (1 - abs(2 * l - 1)) * s
  x <- cc * (1 - abs((h / 60) %% 2 - 1))
  m <- l - cc / 2
  r <- g <- b <- numeric(length(h))
  i <- h < 60;             r[i] <- cc;   g[i] <- x[i]
  i <- h >= 60  & h < 120; r[i] <- x[i]; g[i] <- cc
  i <- h >= 120 & h < 180; g[i] <- cc;   b[i] <- x[i]
  i <- h >= 180 & h < 240; g[i] <- x[i]; b[i] <- cc
  i <- h >= 240 & h < 300; r[i] <- x[i]; b[i] <- cc
  i <- h >= 300;           r[i] <- cc;   b[i] <- x[i]
  rgb(r + m, g + m, b + m)
}
