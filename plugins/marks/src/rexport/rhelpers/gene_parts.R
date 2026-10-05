# The boxes each lane of gene_layout() draws, one row per box: start, end, y
# and 'part', which is "CDS", "UTR" (drawn thinner) or "box". A lane with a CDS
# child draws the children whose type 'sub_parts' names, plus, with
# 'implied_utrs', the untranslated ends its exons (or, lacking exons, its own
# bounds) reach past the outermost CDS on a side no UTR row covers. A lane with
# other children draws them all; a lane with none is one box.
gene_parts <- function(f, lanes, sub_parts = c("CDS", "UTR", "five_prime_UTR",
                       "three_prime_UTR"), implied_utrs = TRUE) {
  utr <- function(type) grepl("(\\bUTR|_UTR|untranslated[_ ]region)\\b", type,
                              ignore.case = TRUE, perl = TRUE)
  kids <- split(f, factor(f$parent, levels = unique(lanes$id)))
  parts <- lapply(seq_len(nrow(lanes)), function(i) {
    l <- lanes[i, ]
    k <- kids[[l$id]]
    box <- function(s, e, part) if (length(s)) data.frame(start = s, end = e,
      part = part, lane = l$id, y = l$y, .region = l$.region,
      stringsAsFactors = FALSE, check.names = FALSE)
    if (is.null(k) || !nrow(k)) {
      return(box(l$start, l$end, if (tolower(l$type) == "cds") "CDS" else "box"))
    }
    cds <- tolower(k$type) == "cds"
    if (!any(cds)) return(box(k$start, k$end, "box"))
    lo <- min(k$start[cds]); hi <- max(k$end[cds])
    shown <- k[tolower(k$type) %in% tolower(sub_parts), , drop = FALSE]
    out <- list(box(shown$start, shown$end, ifelse(utr(shown$type), "UTR", "CDS")))
    if (implied_utrs) {
      u <- utr(k$type)
      ex <- k[tolower(k$type) == "exon", , drop = FALSE]
      if (!nrow(ex)) ex <- l
      if (!any(k$start[u] < lo)) {
        s <- ex$start < lo
        out <- c(out, list(box(ex$start[s], pmin(ex$end[s], lo), "UTR")))
      }
      if (!any(k$end[u] > hi)) {
        s <- ex$end > hi
        out <- c(out, list(box(pmax(ex$start[s], hi), ex$end[s], "UTR")))
      }
    }
    do.call(rbind, out)
  })
  out <- do.call(rbind, parts)
  if (is.null(out)) out <- data.frame(start = numeric(0), end = numeric(0),
    part = character(0), lane = character(0), y = numeric(0),
    .region = integer(0), check.names = FALSE)
  out
}
