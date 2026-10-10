# read_bed()'s records in read_gff()'s shape (start, end, strand, type, id,
# parent, name), so the gene glyph draws either. A BED12 record becomes an
# mRNA with an exon per block and a CDS per block's stretch inside the thick
# range; any other record is one 'feature'. Columns past the shared ones ride
# on the record's own row.
#
# 'aggregate' names the column a BigBed groups records by, as the browser
# does: records sharing a value, other than "" or "none", that overlap become
# transcripts of one gene named by it; ones that do not overlap get a gene each.
bed_features <- function(b, aggregate = NULL) {
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
  key <- if (is.null(aggregate) || is.null(b[[aggregate]])) rep(NA, nrow(b)) else
    as.character(b[[aggregate]])
  key[key %in% c("", "none")] <- NA
  genes <- lapply(split(seq_len(nrow(b)), key), function(i) {
    i <- i[order(b$start[i])]
    overlap <- length(i) > 1 && any(b$start[i][-1] < cummax(b$end[i])[-length(i)])
    groups <- if (overlap) list(i) else as.list(i)
    lapply(groups, function(g) {
      gene <- b[g[1], , drop = FALSE]
      gene$id <- paste0(b$id[g[1]], ".gene"); gene$parent <- NA_character_
      gene$type <- "gene"; gene$name <- key[g[1]]
      gene$start <- min(b$start[g]); gene$end <- max(b$end[g])
      s <- b$strand[g][b$strand[g] != 0]
      gene$strand <- if (length(s)) s[1] else 1L
      b$parent[g] <<- gene$id
      gene
    })
  })
  out <- do.call(rbind, c(unlist(genes, recursive = FALSE), list(b), kids))
  rownames(out) <- NULL
  out
}
