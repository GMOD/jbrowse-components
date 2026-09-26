# Read the GFF3 features in a region through the file's tabix index into a
# data.frame(start, end, strand, type, source, score, phase, id, parent, name),
# plus one column per name in 'attrs', the column-9 attributes the display
# reads: matched without regard to case, as JBrowse matches them; numeric where
# every value parses as a number, as a channel reads it; all NA where the file
# lacks the attribute. start is 0-based half-open. A contig the index lacks
# reads as no features, as the browser draws it.
read_gff <- function(uri, chrom, start, end, attrs = character(0)) {
  tf <- TabixFile(uri)
  g <- if (!chrom %in% seqnamesTabix(tf)) GRanges() else withCallingHandlers(
    import(tf, which = GRanges(chrom, IRanges(start + 1, end)), format = "gff3"),
    # rtracklayer rewinds the connection it opened itself and warns about it
    warning = function(w) if (grepl("rewinding", conditionMessage(w))) invokeRestart("muffleWarning"))
  m <- mcols(g)
  # A GFF attribute can hold a comma list, which rtracklayer surfaces as a
  # CharacterList - and as.character() on one errors rather than flattening, so
  # join it back to the spelling the file used.
  col <- function(nm) {
    hit <- match(tolower(nm), tolower(names(m)))
    v <- if (is.na(hit)) NULL else m[[hit]]
    if (is.null(v)) rep(NA_character_, length(g))
    else if (methods::is(v, "List")) vapply(v, function(x)
      if (length(x)) paste(as.character(x), collapse = ",") else NA_character_,
      character(1))
    else as.character(v)
  }
  parent <- if (is.null(m$Parent)) rep(NA_character_, length(g)) else
    vapply(m$Parent, function(v) if (length(v)) as.character(v[[1]]) else NA_character_, character(1))
  df <- data.frame(start = start(g) - 1L, end = end(g), strand = as.character(strand(g)),
             type = col("type"), source = col("source"),
             score = suppressWarnings(as.numeric(col("score"))),
             phase = suppressWarnings(as.integer(col("phase"))),
             id = col("ID"), parent = parent, name = col("Name"),
             stringsAsFactors = FALSE, check.names = FALSE)
  for (a in attrs) df[[a]] <- utils::type.convert(col(a), as.is = TRUE)
  df
}
