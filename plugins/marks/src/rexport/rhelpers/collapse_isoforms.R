# Keep one transcript per gene, as the display's representative-transcript
# glyph mode does. Ranked as the browser ranks isoforms: a curated tag in
# 'canonical_tags' (by its position, held in the 'canonical_field' attribute,
# which read_gff must have been asked for), then coding over non-coding, then the
# longest protein (summed CDS bp, deduplicated) or widest span, a tie going to
# the later isoform. 'transcript_types' names the child types counted as
# isoforms; a gene with none treats its direct children as the isoforms.
collapse_isoforms <- function(f, transcript_types, canonical_field = NULL,
                              canonical_tags = character(0)) {
  if (is.null(f) || !nrow(f)) return(f)
  fid <- ifelse(is.na(f$id), paste0("_f", seq_len(nrow(f))), f$id)
  by_parent <- split(seq_len(nrow(f)), f$parent)   # drops the parent-less roots
  descendants <- function(id) {
    out <- integer(0); stack <- id
    while (length(stack)) {
      kids <- by_parent[[stack[1]]]; stack <- stack[-1]
      if (!is.null(kids)) { out <- c(out, kids); stack <- c(stack, fid[kids]) }
    }
    out
  }
  coding_bp <- function(idx) {
    cds <- idx[tolower(f$type[idx]) == "cds"]
    if (!length(cds)) return(0)
    keep <- !duplicated(paste(f$start[cds], f$end[cds]))
    sum(f$end[cds][keep] - f$start[cds][keep])
  }
  wanted <- tolower(canonical_tags)
  tags <- if (length(wanted) && !is.null(canonical_field)) f[[canonical_field]] else NULL
  canonical_rank <- function(idx) vapply(idx, function(i) {
    v <- tags[i]
    if (is.na(v)) return(Inf)
    hit <- match(tolower(trimws(strsplit(v, ",", fixed = TRUE)[[1]])), wanted)
    if (all(is.na(hit))) Inf else min(hit, na.rm = TRUE)
  }, numeric(1))
  tt <- tolower(transcript_types)
  drop <- integer(0)
  for (root in fid[is.na(f$parent)]) {
    kids <- by_parent[[root]]
    if (is.null(kids) || length(kids) < 2 || !any(fid[kids] %in% f$parent)) next
    iso <- kids[tolower(f$type[kids]) %in% tt]
    if (!length(iso)) iso <- kids
    if (length(iso) < 2) next
    subtrees <- lapply(iso, function(i) c(i, descendants(fid[i])))
    coding <- vapply(subtrees, coding_bp, numeric(1))
    size <- ifelse(coding > 0, coding, f$end[iso] - f$start[iso])
    rank <- if (is.null(tags)) rep(Inf, length(iso)) else canonical_rank(iso)
    winner <- order(rank, -(coding > 0), -size, -seq_along(iso))[1]
    drop <- c(drop, unlist(subtrees[-winner]))
  }
  if (length(drop)) f[-drop, , drop = FALSE] else f
}
