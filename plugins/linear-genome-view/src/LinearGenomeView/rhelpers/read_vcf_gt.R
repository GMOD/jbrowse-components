# Read per-sample genotypes of a VCF region via the tabix index (Rsamtools - no
# VariantAnnotation) into a genotype matrix. Sample names come from the '#CHROM'
# header line; the GT subfield is located in each record's FORMAT column. Each
# variant's "most frequent ALT" allele is found across all samples (matching
# JBrowse's allele-count coloring). Two modes, mirroring the display's
# renderingMode:
#   collapsed (phased = FALSE): one column per sample, each cell classed ref /
#     het / hom (dosage of that ALT) / other (a secondary ALT) / nocall.
#   phased   (phased = TRUE):  one column per haplotype ("<sample> HP<n>",
#     n = ploidy of that sample seen in the region), each single allele classed
#     ref / alt (the most frequent ALT) / other / nocall.
# Also returns per-site minor-allele-frequency and no-call missingness (no-calls
# excluded from the MAF denominator, as in JBrowse) so sites can be filtered, and
# each site's 0-based half-open genomic span (start/end; symbolic SVs use INFO
# END) for displays that draw at genomic position rather than by column index.
read_vcf_gt <- function(uri, chrom, start, end, phased = FALSE) {
  tf <- TabixFile(uri)
  hdr <- headerTabix(tf)$header
  header_cols <- strsplit(sub("^#", "", hdr[length(hdr)]), "\t", fixed = TRUE)[[1]]
  samples <- header_cols[-(1:9)]
  ns <- length(samples)
  lines <- unlist(scanTabix(tf, param = GRanges(chrom, IRanges(start + 1, end))))
  if (!length(lines)) {
    cols <- if (phased) character() else samples
    return(list(cls = matrix(character(), 0, length(cols)),
                dose = matrix(numeric(), 0, length(cols)),
                maf = numeric(), missingness = numeric(), has_alt = logical(),
                start = integer(), end = integer(), samples = cols))
  }
  m <- do.call(rbind, strsplit(lines, "\t", fixed = TRUE))
  pos <- as.integer(m[, 2]); ref <- m[, 4]; alt <- sub(",.*", "", m[, 5])
  symbolic <- grepl("^<", alt)
  end_info <- suppressWarnings(as.integer(vapply(m[, 8], function(x) {
    r <- regmatches(x, regexpr("(?:^|;)END=([^;]*)", x, perl = TRUE))
    if (length(r)) sub(".*END=", "", r) else NA_character_
  }, character(1), USE.NAMES = FALSE)))
  vstart <- pos - 1L
  vend <- ifelse(symbolic & !is.na(end_info), end_info, pos + nchar(ref) - 1L)
  gt_field <- vapply(strsplit(m[, 9], ":", fixed = TRUE),
                     function(f) match("GT", f), integer(1))
  nv <- nrow(m)
  maf <- numeric(nv); missingness <- numeric(nv); has_alt <- logical(nv)
  toks_all <- vector("list", nv); mfa_all <- character(nv)
  for (i in seq_len(nv)) {
    raw <- m[i, 10:(9 + ns)]
    gi <- gt_field[i]
    gts <- if (is.na(gi)) raw else
      vapply(strsplit(raw, ":", fixed = TRUE), function(x) x[gi], character(1))
    toks <- strsplit(gts, "[/|]")
    toks_all[[i]] <- toks
    all_alleles <- unlist(toks)
    called <- all_alleles[all_alleles != "."]
    alt_tab <- table(called[called != "0"])
    mfa_all[i] <- if (length(alt_tab)) names(alt_tab)[which.max(alt_tab)] else NA_character_
    has_alt[i] <- !is.na(mfa_all[i])
    counts <- sort(as.integer(table(called)), decreasing = TRUE)
    maf[i] <- if (length(counts) >= 2) counts[2] / length(called) else 0
    missingness[i] <- sum(all_alleles == ".") / length(all_alleles)
  }
  if (phased) {
    # per-sample ploidy = max allele count across sites (samples never called
    # anywhere default to diploid), then one HP column per haplotype
    ploidy <- rep(2L, ns)
    for (i in seq_len(nv)) ploidy <- pmax(ploidy, lengths(toks_all[[i]]))
    hap_sample <- rep(seq_len(ns), ploidy)
    hap_idx <- unlist(lapply(ploidy, seq_len))
    hap_names <- paste0(samples[hap_sample], " HP", hap_idx - 1L)
    # site-by-haplotype allele matrix, then class every cell in one vectorized
    # pass (single allele per cell: ref / alt = most-frequent ALT / other / nocall)
    allele <- do.call(rbind, lapply(toks_all, function(toks)
      mapply(function(s, k) toks[[s]][k], hap_sample, hap_idx)))
    mfa <- matrix(mfa_all, nv, length(hap_sample))
    is_ref <- !is.na(allele) & allele == "0"
    is_alt <- !is.na(allele) & allele != "0" & allele != "." & allele == mfa
    is_oth <- !is.na(allele) & allele != "0" & allele != "." & allele != mfa
    cls <- matrix("nocall", nv, length(hap_sample))
    cls[is_ref] <- "ref"; cls[is_alt] <- "alt"; cls[is_oth] <- "other"
    dose <- ifelse(is_ref, 0, ifelse(is_alt | is_oth, 1, NA_real_))
    rownames(cls) <- seq_len(nv); colnames(cls) <- hap_names
    return(list(cls = cls, dose = dose, maf = maf, missingness = missingness,
                has_alt = has_alt, start = vstart, end = vend, samples = hap_names))
  }
  cls <- matrix("nocall", nv, ns); dose <- matrix(NA_real_, nv, ns)
  for (i in seq_len(nv)) {
    toks <- toks_all[[i]]; mfa <- mfa_all[i]
    for (j in seq_len(ns)) {
      a <- toks[[j]]
      if (all(a == ".")) next
      d <- if (is.na(mfa)) 0L else sum(a == mfa)
      other <- if (is.na(mfa)) 0L else sum(a != "0" & a != "." & a != mfa)
      dose[i, j] <- d
      cls[i, j] <- if (other > 0) "other" else if (d == 0) "ref" else if (d == 1) "het" else "hom"
    }
  }
  rownames(cls) <- seq_len(nv); colnames(cls) <- samples
  list(cls = cls, dose = dose, maf = maf, missingness = missingness,
       has_alt = has_alt, start = vstart, end = vend, samples = samples)
}
