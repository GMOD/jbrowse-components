# Collapse each gene to a single transcript, reproducing the display's
# "Longest coding transcript" gene glyph mode (geneGlyphMode). Without it the
# panel draws every isoform a gene has, which at gene-scale zoom is what the
# browser deliberately stops doing - a 6 kb window over one hg38 gene came out
# as a solid block of stacked transcripts.
#
# "Longest coding" is the longest PROTEIN - summed CDS bp over the transcript's
# subtree, deduped by (start, end) because duplicated CDS rows are a real GFF3
# quirk and counting one twice would win it the pick - not the widest genomic
# footprint, which an isoform with a big intron could take with a shorter
# protein. A gene whose isoforms are all non-coding falls back to the widest
# span. An exact tie resolves to the LATER isoform, matching the display.
#
# 'transcript_types' names the child types that count as isoforms; a gene with
# no child of those types treats its direct children as the isoform list, as
# getIsoforms does. Matched case-insensitively, like every other type test here.
collapse_isoforms <- function(f, transcript_types) {
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
  tt <- tolower(transcript_types)
  drop <- integer(0)
  for (root in fid[is.na(f$parent)]) {
    kids <- by_parent[[root]]
    if (is.null(kids) || length(kids) < 2) next
    iso <- kids[tolower(f$type[kids]) %in% tt]
    if (!length(iso)) iso <- kids
    if (length(iso) < 2) next
    subtrees <- lapply(iso, function(i) c(i, descendants(fid[i])))
    size <- vapply(subtrees, coding_bp, numeric(1))
    if (all(size == 0)) size <- f$end[iso] - f$start[iso]
    winner <- max(which(size == max(size)))          # tie -> later isoform
    drop <- c(drop, unlist(subtrees[-winner]))
  }
  if (length(drop)) f[-drop, , drop = FALSE] else f
}
