# The read bars split at their skips, so a spliced read draws as its exon
# blocks: each read in 'reads' with a skip in 'skips' (joined on .region and
# read_index) becomes one row per block, keeping every other column.
read_blocks <- function(reads, skips) {
  if (!nrow(skips)) return(reads)
  key <- paste(reads$.region, reads$read_index)
  by_read <- split(skips, paste(skips$.region, skips$read_index))
  has <- key %in% names(by_read)
  blocks <- lapply(which(has), function(i) {
    s <- by_read[[key[i]]]
    s <- s[order(s$start), ]
    starts <- c(reads$start[i], s$end)
    ends <- c(s$start, reads$end[i])
    keep <- ends > starts
    r <- reads[rep(i, sum(keep)), , drop = FALSE]
    r$start <- starts[keep]; r$end <- ends[keep]
    r
  })
  out <- do.call(rbind, c(list(reads[!has, , drop = FALSE]), blocks))
  rownames(out) <- NULL
  out
}
