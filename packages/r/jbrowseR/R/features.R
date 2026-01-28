#' Get Features from a Track
#'
#' Fetches features from a track within a specified genomic region.
#' This is the main data access function, equivalent to JBrowse's
#' `adapter.getFeatures()` method.
#'
#' @param session A jbrowse_session object, or a jbrowse_track object.
#' @param track_id Character string specifying which track to query
#'   (only needed if session is a jbrowse_session).
#' @param region A jbrowse_region object or region string (e.g., "chr1:1000-2000").
#' @param ... Additional options passed to the adapter.
#'
#' @return A tibble containing features with columns appropriate to the track type:
#'   - All tracks: ref_name, start, end, feature_id
#'   - Gene tracks: strand, type, name, parent_id, phase
#'   - Quantitative tracks: score
#'   - Variant tracks: ref, alt, qual, filter
#'
#' @examples
#' \dontrun{
#' session <- jb_session(
#'   assembly = "hg38",
#'   tracks = list(
#'     genes = jb_track_gff3("genes.gff3.gz")
#'   )
#' )
#' features <- jb_features(session, "genes", "chr1:1000000-2000000")
#' }
#'
#' @export
jb_features <- function(session, track_id = NULL, region, ...) {
  # Handle direct track input
  if (inherits(session, "jbrowse_track")) {
    track <- session
  } else if (inherits(session, "jbrowse_session")) {
    if (is.null(track_id)) {
      stop("track_id is required when using a jbrowse_session")
    }
    track <- session$tracks[[track_id]]
    if (is.null(track)) {
      stop("Track '", track_id, "' not found in session")
    }
  } else {
    stop("session must be a jbrowse_session or jbrowse_track object")
  }

  # Parse region if it's a string
  if (is.character(region)) {
    region <- jb_region(region)
  }

  # Dispatch to appropriate fetcher based on track type
  UseMethod("jb_features_impl", track)
}

#' @export
jb_features_impl <- function(track, region, ...) {
  UseMethod("jb_features_impl")
}

#' @export
jb_features_impl.jbrowse_track_bigwig <- function(track, region, ...) {
  fetch_bigwig_features(track, region, ...)
}

#' @export
jb_features_impl.jbrowse_track_vcf <- function(track, region, ...) {
  fetch_vcf_features(track, region, ...)
}

#' @export
jb_features_impl.jbrowse_track_gff3 <- function(track, region, ...) {
  fetch_gff3_features(track, region, ...)
}

#' @export
jb_features_impl.jbrowse_track_bam <- function(track, region, ...) {
  fetch_bam_features(track, region, ...)
}

#' @export
jb_features_impl.jbrowse_track_bed <- function(track, region, ...) {
  fetch_bed_features(track, region, ...)
}

#' @export
jb_features_impl.default <- function(track, region, ...) {
  stop("Unknown track type: ", class(track)[1])
}

# Internal: Fetch BigWig features using rtracklayer
fetch_bigwig_features <- function(track, region, ...) {
  if (!requireNamespace("rtracklayer", quietly = TRUE)) {
    stop("Package 'rtracklayer' is required. Install with: BiocManager::install('rtracklayer')")
  }

  gr <- region_to_granges(region)

  # Import BigWig data
  bw_data <- rtracklayer::import(track$uri, which = gr)

  # Convert to tibble
  tibble::tibble(
    ref_name = as.character(GenomicRanges::seqnames(bw_data)),
    start = GenomicRanges::start(bw_data) - 1L,  # Convert to 0-based
    end = GenomicRanges::end(bw_data),
    score = GenomicRanges::score(bw_data)
  )
}

# Internal: Fetch VCF features using VariantAnnotation
fetch_vcf_features <- function(track, region, ...) {
  if (!requireNamespace("VariantAnnotation", quietly = TRUE)) {
    stop("Package 'VariantAnnotation' is required. Install with: BiocManager::install('VariantAnnotation')")
  }

  gr <- region_to_granges(region)

  # Open VCF file
  vcf_file <- VariantAnnotation::VcfFile(track$uri, index = track$index)
  vcf_param <- VariantAnnotation::ScanVcfParam(which = gr)

  # Read VCF data
  vcf <- VariantAnnotation::readVcf(vcf_file, param = vcf_param)
  row_ranges <- SummarizedExperiment::rowRanges(vcf)

  if (length(row_ranges) == 0) {
    return(tibble::tibble(
      ref_name = character(),
      start = integer(),
      end = integer(),
      feature_id = character(),
      name = character(),
      ref = character(),
      alt = character(),
      qual = numeric(),
      filter = character(),
      type = character()
    ))
  }

  # Convert to tibble
  tibble::tibble(
    ref_name = as.character(GenomicRanges::seqnames(row_ranges)),
    start = GenomicRanges::start(row_ranges) - 1L,
    end = GenomicRanges::end(row_ranges),
    feature_id = names(row_ranges),
    name = names(row_ranges),
    ref = as.character(VariantAnnotation::ref(vcf)),
    alt = sapply(VariantAnnotation::alt(vcf), function(x) paste(as.character(x), collapse = ",")),
    qual = VariantAnnotation::qual(vcf),
    filter = sapply(VariantAnnotation::filt(vcf), paste, collapse = ";"),
    type = classify_variant_type(
      as.character(VariantAnnotation::ref(vcf)),
      VariantAnnotation::alt(vcf)
    )
  )
}

# Internal: Fetch GFF3 features using rtracklayer
fetch_gff3_features <- function(track, region, ...) {
  if (!requireNamespace("rtracklayer", quietly = TRUE)) {
    stop("Package 'rtracklayer' is required. Install with: BiocManager::install('rtracklayer')")
  }

  gr <- region_to_granges(region)

  # Import GFF3 data
  gff_data <- rtracklayer::import(track$uri, which = gr)

  if (length(gff_data) == 0) {
    return(tibble::tibble(
      ref_name = character(),
      start = integer(),
      end = integer(),
      feature_id = character(),
      strand = integer(),
      type = character(),
      name = character(),
      parent_id = character(),
      phase = integer(),
      source = character()
    ))
  }

  # Extract metadata columns
  mcols <- S4Vectors::mcols(gff_data)

  # Convert strand
  strand_vec <- as.character(GenomicRanges::strand(gff_data))
  strand_int <- dplyr::case_when(
    strand_vec == "+" ~ 1L,
    strand_vec == "-" ~ -1L,
    TRUE ~ 0L
  )

  tibble::tibble(
    ref_name = as.character(GenomicRanges::seqnames(gff_data)),
    start = GenomicRanges::start(gff_data) - 1L,
    end = GenomicRanges::end(gff_data),
    feature_id = if ("ID" %in% names(mcols)) as.character(mcols$ID) else paste0("feature_", seq_along(gff_data)),
    strand = strand_int,
    type = if ("type" %in% names(mcols)) as.character(mcols$type) else NA_character_,
    name = if ("Name" %in% names(mcols)) {
      as.character(mcols$Name)
    } else if ("gene_name" %in% names(mcols)) {
      as.character(mcols$gene_name)
    } else {
      NA_character_
    },
    parent_id = if ("Parent" %in% names(mcols)) {
      sapply(mcols$Parent, function(x) if (length(x) > 0) paste(x, collapse = ",") else NA_character_)
    } else {
      NA_character_
    },
    phase = if ("phase" %in% names(mcols)) as.integer(mcols$phase) else NA_integer_,
    source = if ("source" %in% names(mcols)) as.character(mcols$source) else NA_character_
  )
}

# Internal: Fetch BAM features using Rsamtools
fetch_bam_features <- function(track, region, max_records = 10000, include_sequence = FALSE, ...) {
  if (!requireNamespace("Rsamtools", quietly = TRUE)) {
    stop("Package 'Rsamtools' is required. Install with: BiocManager::install('Rsamtools')")
  }

  gr <- region_to_granges(region)

  # Set up BAM parameters
  what <- c("qname", "flag", "mapq", "cigar", "isize", "mrnm", "mpos")
  if (include_sequence) {
    what <- c(what, "seq", "qual")
  }

  param <- Rsamtools::ScanBamParam(which = gr, what = what)

  # Read BAM data
  bam <- Rsamtools::scanBam(track$uri, index = track$index, param = param)[[1]]

  if (length(bam$qname) == 0) {
    return(tibble::tibble(
      ref_name = character(),
      start = integer(),
      end = integer(),
      feature_id = character(),
      name = character(),
      strand = integer(),
      flags = integer(),
      mapq = integer(),
      cigar = character()
    ))
  }

  # Limit records
  n <- min(length(bam$qname), max_records)

  # Calculate strand from flags
  strand_int <- ifelse(bitwAnd(bam$flag[1:n], 16) > 0, -1L, 1L)

  tibble::tibble(
    ref_name = as.character(GenomicRanges::seqnames(gr))[1],
    start = bam$pos[1:n] - 1L,
    end = bam$pos[1:n] + nchar(bam$cigar[1:n]),  # Approximate
    feature_id = paste0("read_", seq_len(n)),
    name = bam$qname[1:n],
    strand = strand_int,
    flags = bam$flag[1:n],
    mapq = bam$mapq[1:n],
    cigar = bam$cigar[1:n]
  )
}

# Internal: Fetch BED features using rtracklayer
fetch_bed_features <- function(track, region, ...) {
  if (!requireNamespace("rtracklayer", quietly = TRUE)) {
    stop("Package 'rtracklayer' is required. Install with: BiocManager::install('rtracklayer')")
  }

  gr <- region_to_granges(region)

  # Import BED data
  bed_data <- rtracklayer::import(track$uri, which = gr)

  if (length(bed_data) == 0) {
    return(tibble::tibble(
      ref_name = character(),
      start = integer(),
      end = integer(),
      feature_id = character(),
      name = character(),
      strand = integer(),
      score = numeric()
    ))
  }

  mcols <- S4Vectors::mcols(bed_data)

  # Convert strand
  strand_vec <- as.character(GenomicRanges::strand(bed_data))
  strand_int <- dplyr::case_when(
    strand_vec == "+" ~ 1L,
    strand_vec == "-" ~ -1L,
    TRUE ~ 0L
  )

  tibble::tibble(
    ref_name = as.character(GenomicRanges::seqnames(bed_data)),
    start = GenomicRanges::start(bed_data) - 1L,
    end = GenomicRanges::end(bed_data),
    feature_id = if ("name" %in% names(mcols)) {
      as.character(mcols$name)
    } else {
      paste0("feature_", seq_along(bed_data))
    },
    name = if ("name" %in% names(mcols)) as.character(mcols$name) else NA_character_,
    strand = strand_int,
    score = if ("score" %in% names(mcols)) as.numeric(mcols$score) else NA_real_
  )
}

# Helper: Classify variant type
classify_variant_type <- function(ref, alt_list) {
  sapply(seq_along(ref), function(i) {
    ref_len <- nchar(ref[i])
    alt <- alt_list[[i]]
    if (length(alt) == 0) return("unknown")

    alt_lens <- nchar(as.character(alt))

    if (all(ref_len == 1 & alt_lens == 1)) {
      "SNV"
    } else if (all(ref_len > alt_lens)) {
      "deletion"
    } else if (all(ref_len < alt_lens)) {
      "insertion"
    } else {
      "substitution"
    }
  })
}
