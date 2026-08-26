# Read BED features in a region into the same schema read_gff returns
# (start, end, strand, type, id, parent, name), so gene_layout and the gene
# panel treat BED and GFF alike. A BED12 record is expanded into a transcript
# root plus 'exon' subfeatures (its blocks) and 'CDS' subfeatures (each exon
# clipped to the thickStart/thickEnd coding range) - the same thin-exon /
# thick-CDS gene model a GFF gives. A plain BED (no block columns) yields one
# flat 'feature' per record. start is 0-based half-open (BED-style). rtracklayer
# returns block ranges relative to the feature start and thick as absolute
# 1-based coords; a zero-width thick range means non-coding (no CDS drawn).
# 'attrs' matches read_gff's signature so the gene panel can call either reader
# the same way; BED carries no GFF attributes, so each becomes an all-NA column
# (the jexl `undefined` case feature_filter() already handles).
# format = "bigBed" reads the same schema out of an indexed .bb instead.
read_bed <- function(uri, chrom, start, end, attrs = character(0),
                     format = c("bed", "bigBed")) {
  # NULL when the region held no features, which read_regions already treats as
  # "contributed nothing"; adding a column to it would build a bare list instead
  with_attrs <- function(df) {
    if (is.null(df)) return(NULL)
    for (a in attrs) df[[a]] <- rep(NA_character_, nrow(df))
    df
  }
  gr <- GRanges(chrom, IRanges(start + 1, end))
  g <- if (match.arg(format) == "bigBed") {
    # Name the fields we draw rather than take the whole record: a BigBed's
    # extra autoSql columns are read through the UCSC C library, and an itemRgb
    # spelled "0,0,200" fails as a signed integer - which aborts the WHOLE
    # import with "UCSC library operation failed", so every `bigBed 9 +` track
    # (UCSC's SV, ClinVar and repeat tracks are all one) was unreadable.
    # A file without blocks/thick just warns here; the flat-feature path below
    # is what it needs anyway.
    withCallingHandlers(
      import(uri, selection = BigBedSelection(gr,
        colnames = c("name", "score", "thick", "blocks"))),
      warning = function(w)
        if (grepl("Unavailable field", conditionMessage(w))) invokeRestart("muffleWarning"))
  } else import(uri, which = gr, format = "bed")
  m <- mcols(g)
  nm <- if (is.null(m$name)) paste0("bed", seq_along(g)) else as.character(m$name)
  fs <- start(g); fe <- end(g); str <- as.character(strand(g))
  flat <- function(i) data.frame(start = fs[i] - 1L, end = fe[i], strand = str[i],
    type = "feature", id = nm[i], parent = NA_character_, name = nm[i],
    stringsAsFactors = FALSE)
  if (is.null(m$blocks)) return(with_attrs(do.call(rbind, lapply(seq_along(g), flat))))
  out <- vector("list", length(g))
  for (i in seq_along(g)) {
    bl <- m$blocks[[i]]
    if (!length(bl)) { out[[i]] <- flat(i); next }
    ex_s <- fs[i] + start(bl) - 1L; ex_e <- fs[i] + end(bl) - 1L
    parts <- list(
      data.frame(start = fs[i] - 1L, end = fe[i], strand = str[i], type = "mRNA",
        id = nm[i], parent = NA_character_, name = nm[i], stringsAsFactors = FALSE),
      data.frame(start = ex_s - 1L, end = ex_e, strand = str[i], type = "exon",
        id = paste0(nm[i], ".exon", seq_along(bl)), parent = nm[i],
        name = NA_character_, stringsAsFactors = FALSE))
    if (!is.null(m$thick) && end(m$thick)[i] > start(m$thick)[i]) {
      ts <- start(m$thick)[i]; te <- end(m$thick)[i]
      cs <- pmax(ex_s, ts); ce <- pmin(ex_e, te); keep <- cs <= ce
      if (any(keep)) parts[[3]] <- data.frame(start = cs[keep] - 1L, end = ce[keep],
        strand = str[i], type = "CDS", id = paste0(nm[i], ".cds", which(keep)),
        parent = nm[i], name = NA_character_, stringsAsFactors = FALSE)
    }
    out[[i]] <- do.call(rbind, parts)
  }
  with_attrs(do.call(rbind, out))
}
