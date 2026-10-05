# read_bed()'s records in read_gff()'s shape (start, end, strand, type, id,
# parent, name), so the gene glyph draws either. A BED12 record becomes an
# mRNA with an exon per block and a CDS per block's stretch inside the thick
# range; any other record is one 'feature'. Columns past the shared ones ride
# on the record's own row.
bed_features <- function(b) {
  if (!nrow(b)) return(cbind(b, type = character(0), id = character(0),
    parent = character(0)))
  b$id <- paste0("bed", seq_len(nrow(b)))
  b$parent <- NA_character_
  b$type <- ifelse(is.na(b$block_starts), "feature", "mRNA")
  kids <- lapply(which(!is.na(b$block_starts)), function(i) {
    s <- b$start[i] + as.integer(strsplit(b$block_starts[i], ",")[[1]])
    e <- s + as.integer(strsplit(b$block_sizes[i], ",")[[1]])
    exon <- data.frame(start = s, end = e, type = "exon")
    lo <- pmax(s, b$thick_start[i]); hi <- pmin(e, b$thick_end[i])
    keep <- !is.na(lo) & hi > lo
    out <- rbind(exon, data.frame(start = lo[keep], end = hi[keep],
      type = rep("CDS", sum(keep))))
    row <- b[rep(i, nrow(out)), , drop = FALSE]
    row$start <- out$start; row$end <- out$end; row$type <- out$type
    row$parent <- b$id[i]; row$name <- NA_character_
    row$id <- paste0(b$id[i], ".", seq_len(nrow(out)))
    row
  })
  out <- do.call(rbind, c(list(b), kids))
  rownames(out) <- NULL
  out
}
