# Read VCF records in a region via the tabix index (Rsamtools - no
# VariantAnnotation needed) into data.frame(start, end, name, REF, ALT, QUAL,
# FILTER, type), plus one INFO.<key> column per key in 'info', the INFO fields
# the display reads - a flag key is TRUE where present and NA where not, and a
# column every value of which parses as a number becomes numeric. SV span (END)
# and SVTYPE come from INFO; sequence indels are classed by REF/ALT length.
# start is 0-based half-open (BED-style). A contig the index lacks reads as no
# records, as the browser draws it.
read_vcf <- function(uri, chrom, start, end, info = character(0)) {
  info_field <- function(inf, key) {
    pat <- paste0("(?:^|;)", key, "(?:=([^;]*))?(?:;|$)")
    vapply(inf, function(x) {
      m <- regmatches(x, regexec(pat, x, perl = TRUE))[[1]]
      if (!length(m)) NA_character_ else if (nzchar(m[2])) m[2] else "TRUE"
    }, character(1), USE.NAMES = FALSE)
  }
  tf <- TabixFile(uri)
  lines <- if (!chrom %in% seqnamesTabix(tf)) character(0) else
    unlist(scanTabix(tf, param = GRanges(chrom, IRanges(start + 1, end))))
  cols <- if (length(lines)) do.call(rbind, strsplit(lines, "\t", fixed = TRUE))
          else matrix(character(), 0, 8)
  pos <- as.integer(cols[, 2]); ref <- cols[, 4]
  alt <- sub(",.*", "", cols[, 5]); inf <- cols[, 8]
  symbolic <- grepl("^<", alt)
  end_info <- suppressWarnings(as.integer(info_field(inf, "END")))
  svtype <- info_field(inf, "SVTYPE")
  type <- ifelse(symbolic,
      ifelse(!is.na(svtype), svtype, gsub("[<>]", "", alt)),
    ifelse(nchar(ref) == 1 & nchar(alt) == 1, "SNV",
      ifelse(nchar(ref) < nchar(alt), "INS",
        ifelse(nchar(ref) > nchar(alt), "DEL", "MNV"))))
  df <- data.frame(start = pos - 1L,
             end = ifelse(symbolic & !is.na(end_info), end_info, pos + nchar(ref) - 1L),
             name = ifelse(cols[, 3] == ".", NA_character_, cols[, 3]),
             REF = ref, ALT = alt,
             QUAL = suppressWarnings(as.numeric(cols[, 6])),
             FILTER = cols[, 7], type = type,
             stringsAsFactors = FALSE, check.names = FALSE)
  for (k in info) df[[paste0("INFO.", k)]] <-
    utils::type.convert(info_field(inf, k), as.is = TRUE)
  df
}
