#' Get Quantitative Statistics for a Region
#'
#' Computes summary statistics for quantitative tracks (e.g., BigWig).
#'
#' @param session A jbrowse_session or jbrowse_track object.
#' @param track_id Character string specifying which track to query.
#' @param region A jbrowse_region object or region string.
#'
#' @return A list with min, max, mean, sd, and count.
#'
#' @export
jb_stats <- function(session, track_id = NULL, region) {
  features <- jb_features(session, track_id, region)

  if (!"score" %in% names(features)) {
    stop("Track does not have score data for statistics")
  }

  scores <- features$score[!is.na(features$score)]

  list(
    min = min(scores, na.rm = TRUE),
    max = max(scores, na.rm = TRUE),
    mean = mean(scores, na.rm = TRUE),
    sd = sd(scores, na.rm = TRUE),
    count = length(scores),
    sum = sum(scores, na.rm = TRUE)
  )
}

#' Get Reference Names from a Track
#'
#' Returns the list of reference/chromosome names available in a track.
#'
#' @param session A jbrowse_session or jbrowse_track object.
#' @param track_id Character string specifying which track to query.
#'
#' @return A character vector of reference names.
#'
#' @export
jb_ref_names <- function(session, track_id = NULL) {
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

  # For now, use rtracklayer to get seqinfo
  if (!requireNamespace("rtracklayer", quietly = TRUE)) {
    stop("Package 'rtracklayer' is required for jb_ref_names")
  }

  # Try to get sequence info from the file
  tryCatch({
    if (track$type == "bigwig") {
      seqinfo <- rtracklayer::seqinfo(rtracklayer::BigWigFile(track$uri))
    } else {
      # For indexed files, try to read the index
      seqinfo <- GenomeInfoDb::seqlevels(
        rtracklayer::import(track$uri, which = GenomicRanges::GRanges())
      )
      return(seqinfo)
    }
    GenomeInfoDb::seqlevels(seqinfo)
  }, error = function(e) {
    warning("Could not determine reference names: ", e$message)
    character(0)
  })
}

#' Get Track Header Information
#'
#' Returns header/metadata information from a track file.
#'
#' @param session A jbrowse_session or jbrowse_track object.
#' @param track_id Character string specifying which track to query.
#'
#' @return A list containing header information specific to the file type.
#'
#' @export
jb_header <- function(session, track_id = NULL) {
  # Handle direct track input
  if (inherits(session, "jbrowse_track")) {
    track <- session
  } else if (inherits(session, "jbrowse_session")) {
    if (is.null(track_id)) {
      stop("track_id is required when using a jbrowse_session")
    }
    track <- session$tracks[[track_id]]
  }

  if (track$type == "vcf") {
    if (!requireNamespace("VariantAnnotation", quietly = TRUE)) {
      stop("Package 'VariantAnnotation' is required")
    }
    vcf_file <- VariantAnnotation::VcfFile(track$uri, index = track$index)
    hdr <- VariantAnnotation::scanVcfHeader(vcf_file)

    list(
      samples = VariantAnnotation::samples(hdr),
      info = as.data.frame(VariantAnnotation::info(hdr)),
      format = as.data.frame(VariantAnnotation::geno(hdr)),
      meta = S4Vectors::metadata(hdr)
    )
  } else if (track$type == "bam") {
    if (!requireNamespace("Rsamtools", quietly = TRUE)) {
      stop("Package 'Rsamtools' is required")
    }
    hdr <- Rsamtools::scanBamHeader(track$uri)[[1]]

    list(
      targets = hdr$targets,
      text = hdr$text
    )
  } else {
    list(
      type = track$type,
      uri = track$uri,
      name = track$name
    )
  }
}

#' Launch Interactive JBrowse View
#'
#' Opens an interactive JBrowse 2 session in the default web browser.
#'
#' @param session A jbrowse_session object.
#' @param region Optional jbrowse_region or region string to navigate to.
#' @param ... Additional view options.
#'
#' @return Invisibly returns the URL opened.
#'
#' @export
jb_view <- function(session, region = NULL, ...) {
  # For now, generate a jbrowse.org URL with embedded config
  # In the future, this could spin up a local server

  if (!inherits(session, "jbrowse_session")) {
    stop("session must be a jbrowse_session object")
  }

  # Create a temporary config file
  config_file <- tempfile(fileext = ".json")
  jb_to_config(session, config_file)

  # Read back the config
  config <- jsonlite::read_json(config_file)

  # Encode as base64 for URL
  config_json <- jsonlite::toJSON(config, auto_unbox = TRUE)
  config_base64 <- base64enc::base64encode(charToRaw(as.character(config_json)))

  # Build URL
  base_url <- "https://jbrowse.org/code/jb2/main/"
  url <- paste0(base_url, "?config=", utils::URLencode(config_base64, reserved = TRUE))

  if (!is.null(region)) {
    if (is.character(region)) {
      region <- jb_region(region)
    }
    loc <- format_region(region)
    url <- paste0(url, "&loc=", utils::URLencode(loc, reserved = TRUE))
  }

  message("Opening JBrowse at: ", substr(url, 1, 100), "...")
  utils::browseURL(url)

  invisible(url)
}
