#' Parse a Region String
#'
#' Parses a JBrowse-style region string into its components.
#' Supports formats like "chr1:1000-2000" or "chr1:1,000-2,000".
#'
#' @param region_string A character string specifying a genomic region.
#'   Format: "refName:start-end" (1-based, inclusive coordinates).
#'   Commas in numbers are allowed and will be stripped.
#'
#' @return A jbrowse_region object (list with ref_name, start, end).
#'   Coordinates are converted to 0-based, half-open internally.
#'
#' @examples
#' region <- jb_region("chr17:7,668,421-7,687,490")
#' region$ref_name  # "chr17"
#' region$start     # 7668420 (0-based)
#' region$end       # 7687490
#'
#' @export
jb_region <- function(region_string) {
  # Remove commas and whitespace
  region_string <- gsub("[, ]", "", region_string)

  # Parse the region string
  # Supports: chr1:1000-2000, chr1:1000..2000, chr1:1000
  pattern <- "^([^:]+):([0-9]+)[-\\.\\.]+([0-9]+)?$"

  if (!grepl(pattern, region_string)) {
    # Try simpler pattern (just refName:start)
    pattern_simple <- "^([^:]+):([0-9]+)$"
    if (grepl(pattern_simple, region_string)) {
      matches <- regmatches(region_string, regexec(pattern_simple, region_string))[[1]]
      ref_name <- matches[2]
      start <- as.integer(matches[3])
      end <- start + 1  # Single base
    } else if (!grepl(":", region_string)) {
      # Just a chromosome name
      return(structure(
        list(
          ref_name = region_string,
          start = NA_integer_,
          end = NA_integer_
        ),
        class = c("jbrowse_region", "list")
      ))
    } else {
      stop("Invalid region format: ", region_string,
           "\nExpected format: 'chr:start-end' (e.g., 'chr1:1000-2000')")
    }
  } else {
    matches <- regmatches(region_string, regexec(pattern, region_string))[[1]]
    ref_name <- matches[2]
    start <- as.integer(matches[3])
    end <- as.integer(matches[4])
  }

  # Convert from 1-based inclusive to 0-based half-open
  # JBrowse uses 0-based internally, but region strings are typically 1-based
  start_0based <- start - 1L

  structure(
    list(
      ref_name = ref_name,
      start = start_0based,
      end = end
    ),
    class = c("jbrowse_region", "list")
  )
}

#' Format a Region as a String
#'
#' Converts a jbrowse_region object back to a string.
#'
#' @param region A jbrowse_region object.
#' @param format Output format: "jbrowse" (0-based) or "ucsc" (1-based).
#'
#' @return A character string.
#'
#' @examples
#' region <- jb_region("chr1:1000-2000")
#' format_region(region)  # "chr1:1000-2000"
#'
#' @export
format_region <- function(region, format = "ucsc") {
  if (is.na(region$start) || is.na(region$end)) {
    return(region$ref_name)
  }

  if (format == "jbrowse") {
    # 0-based
    sprintf("%s:%d-%d", region$ref_name, region$start, region$end)
  } else {
    # 1-based (UCSC style)
    sprintf("%s:%d-%d", region$ref_name, region$start + 1L, region$end)
  }
}

#' Print method for jbrowse_region
#' @param x A jbrowse_region object
#' @param ... Additional arguments (ignored)
#' @export
print.jbrowse_region <- function(x, ...) {
  cat("JBrowse Region:", format_region(x), "\n")
  cat("  ref_name:", x$ref_name, "\n")
  cat("  start:", x$start, "(0-based)\n")
  cat("  end:", x$end, "\n")
  cat("  length:", x$end - x$start, "bp\n")
  invisible(x)
}

#' Convert Region to GRanges
#'
#' Converts a jbrowse_region to a GenomicRanges::GRanges object.
#' Requires the GenomicRanges package.
#'
#' @param region A jbrowse_region object.
#'
#' @return A GRanges object.
#'
#' @export
region_to_granges <- function(region) {
  if (!requireNamespace("GenomicRanges", quietly = TRUE)) {
    stop("Package 'GenomicRanges' is required. Install with: BiocManager::install('GenomicRanges')")
  }

  # GRanges uses 1-based coordinates
  GenomicRanges::GRanges(
    seqnames = region$ref_name,
    ranges = IRanges::IRanges(
      start = region$start + 1L,  # Convert to 1-based
      end = region$end
    )
  )
}
