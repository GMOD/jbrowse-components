# Read VCF records in a region via the tabix index (Rsamtools - no
# VariantAnnotation needed) into data.frame(start, end, name, REF, ALT, QUAL,
# FILTER, type), plus one INFO.<key> column per key in 'info', the INFO fields
# the display reads - a flag key is TRUE where present and NA where not, and a
# column every value of which parses as a number becomes numeric. SV span (END)
# comes from INFO, and type is the browser's SO term from the alleles: SNV,
# substitution, insertion, deletion, breakend, a symbolic alt's class, joined
# across alts.
# start is 0-based half-open (BED-style). A contig the index lacks reads as no
# records, as the browser draws it.
read_vcf <- function(uri, chrom, start, end, info = character(0), index = paste0(uri, ".tbi")) {
  info_field <- function(inf, key) {
    pat <- paste0("(?:^|;)", key, "(?:=([^;]*))?(?:;|$)")
    vapply(inf, function(x) {
      m <- regmatches(x, regexec(pat, x, perl = TRUE))[[1]]
      if (!length(m)) NA_character_ else if (nzchar(m[2])) m[2] else "TRUE"
    }, character(1), USE.NAMES = FALSE)
  }
  tf <- TabixFile(uri, index = index)
  lines <- if (!chrom %in% seqnamesTabix(tf)) character(0) else
    unlist(scanTabix(tf, param = GRanges(chrom, IRanges(start + 1, end))))
  cols <- if (length(lines)) do.call(rbind, strsplit(lines, "\t", fixed = TRUE))
          else matrix(character(), 0, 8)
  pos <- as.integer(cols[, 2]); ref <- cols[, 4]
  alt <- sub(",.*", "", cols[, 5]); inf <- cols[, 8]
  symbolic <- grepl("^<", alt)
  end_info <- suppressWarnings(as.integer(info_field(inf, "END")))
  symbolic_terms <- c(DEL = "deletion", INS = "insertion", DUP = "duplication",
    INV = "inversion", INVDUP = "inverted_duplication",
    CNV = "copy_number_variation", TRA = "translocation",
    "DUP:TANDEM" = "tandem_duplication", NON_REF = "sequence_variant",
    "*" = "sequence_variant")
  so_term <- function(a, r) {
    if (a == ".") return("remark")
    if (startsWith(a, "<")) {
      parts <- strsplit(substr(a, 2, nchar(a) - 1), ":", fixed = TRUE)[[1]]
      for (i in rev(seq_along(parts))) {
        term <- paste(parts[seq_len(i)], collapse = ":")
        if (term %in% names(symbolic_terms)) return(symbolic_terms[[term]])
        if (grepl("^CN[0-9]+$", term)) return("copy_number_variation")
      }
      return("variant")
    }
    if (a == "*") return("sequence_variant")
    if (grepl("[][]", a)) return("breakend")
    if (nchar(r) == 1 && nchar(a) == 1) "SNV"
    else if (nchar(r) == nchar(a)) "substitution"
    else if (nchar(r) < nchar(a)) "insertion"
    else "deletion"
  }
  type <- as.character(unlist(Map(function(r, a) paste(unique(
    vapply(strsplit(a, ",", fixed = TRUE)[[1]], so_term, "", r = r)),
    collapse = ","), ref, cols[, 5], USE.NAMES = FALSE)))
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
