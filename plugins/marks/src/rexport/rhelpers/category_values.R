# The palette entry each categorical value takes, by the browser's rule: a
# non-negative integer takes the slot it names anchored at 1, anything else
# hashes in (hashString: 31 * h + code unit, as a signed 32-bit integer). A
# value in 'listed' (a named vector) keeps the entry listed for it. Answers a
# vector named by value, for scale_*_manual(values = ).
category_values <- function(values, palette, listed = NULL) {
  hash <- function(s) {
    h <- 0
    for (ch in utf8ToInt(s)) h <- (h * 31 + ch) %% 4294967296
    abs(if (h >= 2147483648) h - 4294967296 else h)
  }
  slot <- function(v) {
    num <- if (nzchar(v) && !nzchar(trimws(v))) 0 else suppressWarnings(as.numeric(v))
    if (nzchar(v) && is.finite(num) && num == floor(num) && num >= 0)
      (num + length(palette) - 1) %% length(palette)
    else hash(v) %% length(palette)
  }
  values <- unique(as.character(values[!is.na(values)]))
  out <- palette[vapply(values, slot, numeric(1)) + 1]
  names(out) <- values
  c(listed, out[setdiff(values, names(listed))])
}
