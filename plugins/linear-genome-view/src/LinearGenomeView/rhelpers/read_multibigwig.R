# Read several BigWig files into one long data.frame with a 'source' column
# (a factor ordered to match 'names'), reusing read_bigwig per file.
read_multibigwig <- function(uris, names, chrom, start, end) {
  parts <- Map(function(uri, nm) {
    df <- read_bigwig(uri, chrom, start, end)
    if (nrow(df)) { df$source <- nm; df }
  }, uris, names)
  out <- do.call(rbind, parts)
  out$source <- factor(out$source, levels = unique(names))
  out
}
