# Collapse each gene to a single transcript, reproducing the display's
# representative-transcript gene glyph mode (geneGlyphMode 'longestCoding').
# Without it the panel draws every isoform a gene has, which at gene-scale zoom
# is what the browser deliberately stops doing - a 6 kb window over one hg38
# gene came out as a solid block of stacked transcripts.
#
# The ranking is rankIsoforms', in its order:
#
# 1. The CURATED TAG the annotation carries, by its position in
#    'canonical_tags' - a tag outranks every measurement, because it is the
#    choice a human made, and for a gene whose longest protein is a minor
#    variant it is the only thing that gets that gene right. The position
#    matters rather than a boolean: one gene can carry both 'MANE Select' and
#    'MANE Plus Clinical', and the second is often the longer.
# 2. Coding isoforms above non-coding ones.
# 3. Size: the longest PROTEIN for a coding isoform - summed CDS bp over its
#    subtree, deduped by (start, end) because duplicated CDS rows are a real
#    GFF3 quirk and counting one twice would win it the pick - and the widest
#    span for a non-coding one, which it is only ever compared against other
#    non-coding ones on.
# 4. An exact tie resolves to the LATER isoform, matching the display.
#
# 'canonical_field' names the attribute the tag lives in ('tag' in NCBI's and
# GENCODE's GFF3) and read_gff has to have been asked for it; a comma list in it
# matches on any member, case-insensitively. With no field or no tags the
# ranking is measurement alone, which is what a BED or BigBed track gets.
#
# 'transcript_types' names the child types that count as isoforms; a gene with
# no child of those types treats its direct children as the isoform list, as
# getIsoforms does. Matched case-insensitively, like every other type test here.
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
    if (is.null(kids) || length(kids) < 2) next
    iso <- kids[tolower(f$type[kids]) %in% tt]
    if (!length(iso)) iso <- kids
    if (length(iso) < 2) next
    subtrees <- lapply(iso, function(i) c(i, descendants(fid[i])))
    coding <- vapply(subtrees, coding_bp, numeric(1))
    size <- ifelse(coding > 0, coding, f$end[iso] - f$start[iso])
    rank <- if (is.null(tags)) rep(Inf, length(iso)) else canonical_rank(iso)
    winner <- order(-(coding > 0), -size, -seq_along(iso))[1]
    drop <- c(drop, unlist(subtrees[-winner]))
  }
  if (length(drop)) f[-drop, , drop = FALSE] else f
}
