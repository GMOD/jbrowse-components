# read_bed()'s records in read_gff()'s shape (start, end, strand, type, id,
# parent, name), so the gene glyph draws either, by generateUcscTranscript's
# rule. A stranded BED12 record is an mRNA whose blocks split into CDS inside
# the thick range and five_prime_UTR or three_prime_UTR outside it, or, where
# it codes nothing, a transcript of exons: an empty thick range, or bigGenePred
# writing cdsStartStat and cdsEndStat "none" with no exonFrames at or above 0,
# as GENCODE does on every transcript. An unstranded one, or any under
# 'gene_heuristic' FALSE, is a feature of plain blocks; a record without blocks
# is one 'feature'. Columns past the shared ones ride on the record's own row.
#
# 'aggregate' names the column a BigBed groups records by, as the browser
# does: records sharing a value, other than "" or "none", that overlap become
# transcripts of one gene named by it; ones that do not overlap get a gene each.
# Records in different regions of a multi-region frame never share a gene.
bed_features <- function(b, aggregate = NULL, gene_heuristic = TRUE) {
  if (!nrow(b)) return(cbind(b, type = character(0), id = character(0),
    parent = character(0)))
  b$id <- paste0("bed", seq_len(nrow(b)))
  b$parent <- NA_character_
  blocked <- !is.na(b$block_starts)
  transcript <- blocked & gene_heuristic & b$strand != 0 &
    !is.na(b$thick_start) & !is.na(b$thick_end)
  frames_code <- if (is.null(b$exonFrames)) rep(FALSE, nrow(b)) else
    vapply(strsplit(as.character(b$exonFrames), ","),
      function(f) any(suppressWarnings(as.integer(f)) >= 0, na.rm = TRUE), TRUE)
  stat_none <- if (is.null(b$cdsStartStat) || is.null(b$cdsEndStat))
    rep(FALSE, nrow(b)) else b$cdsStartStat %in% "none" & b$cdsEndStat %in% "none"
  coding <- transcript & b$thick_start != b$thick_end & !(stat_none & !frames_code)
  b$type <- ifelse(coding, "mRNA", ifelse(transcript, "transcript", "feature"))
  kids <- lapply(which(blocked), function(i) {
    s <- b$start[i] + as.integer(strsplit(b$block_starts[i], ",")[[1]])
    e <- s + as.integer(strsplit(b$block_sizes[i], ",")[[1]])
    out <- if (coding[i]) {
      ts <- b$thick_start[i]; te <- b$thick_end[i]
      up <- if (b$strand[i] > 0) "five_prime_UTR" else "three_prime_UTR"
      down <- if (b$strand[i] > 0) "three_prime_UTR" else "five_prime_UTR"
      lo <- s < ts; mid <- s < te & e > ts; hi <- e > te
      rbind(
        data.frame(start = s[lo], end = pmin(e[lo], ts), type = rep(up, sum(lo))),
        data.frame(start = pmax(s[mid], ts), end = pmin(e[mid], te),
          type = rep("CDS", sum(mid))),
        data.frame(start = pmax(s[hi], te), end = e[hi], type = rep(down, sum(hi))))
    } else {
      data.frame(start = s, end = e, type = if (transcript[i]) "exon" else "block")
    }
    row <- b[rep(i, nrow(out)), , drop = FALSE]
    row$start <- out$start; row$end <- out$end; row$type <- out$type
    row$parent <- b$id[i]; row$name <- NA_character_
    row$id <- paste0(b$id[i], ".", seq_len(nrow(out)))
    row
  })
  key <- if (is.null(aggregate) || is.null(b[[aggregate]])) rep(NA, nrow(b)) else
    as.character(b[[aggregate]])
  key[key %in% c("", "none")] <- NA
  group <- if (is.null(b$.region)) key else
    ifelse(is.na(key), NA, paste(b$.region, key, sep = "\r"))
  genes <- lapply(split(seq_len(nrow(b)), group), function(i) {
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
