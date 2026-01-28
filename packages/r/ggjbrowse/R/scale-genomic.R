#' Genomic Coordinate Scale
#'
#' A scale for genomic coordinates that handles large numbers nicely,
#' with optional unit conversion (bp, kb, Mb) and region limiting.
#'
#' @param region Optional jbrowse_region or region string to set limits.
#' @param unit Unit for axis labels: "auto", "bp", "kb", "Mb", or "Gb".
#' @param ... Arguments passed to `scale_x_continuous()`.
#'
#' @return A ggplot2 scale.
#'
#' @examples
#' \dontrun{
#' ggplot(data, aes(x = start, y = score)) +
#'   geom_point() +
#'   scale_x_genomic(region = "chr1:1000000-2000000", unit = "kb")
#' }
#'
#' @export
scale_x_genomic <- function(region = NULL, unit = "auto", ...) {
  # Parse region if provided
  limits <- NULL
  if (!is.null(region)) {
    if (is.character(region)) {
      # Parse region string
      region <- parse_region_simple(region)
    }
    if (is.list(region) && !is.na(region$start) && !is.na(region$end)) {
      limits <- c(region$start, region$end)
    }
  }

  # Create labeler function
  labeler <- label_genomic(unit = unit)

  ggplot2::scale_x_continuous(
    labels = labeler,
    limits = limits,
    expand = ggplot2::expansion(mult = 0.02),
    ...
  )
}

#' Genomic Coordinate Labeler
#'
#' Creates a labeling function for genomic coordinates.
#'
#' @param unit Unit for labels: "auto", "bp", "kb", "Mb", or "Gb".
#' @param accuracy Number of decimal places.
#'
#' @return A labeling function.
#'
#' @export
label_genomic <- function(unit = "auto", accuracy = 1) {
  function(x) {
    if (length(x) == 0) return(character(0))

    x <- x[!is.na(x)]
    if (length(x) == 0) return(character(0))

    range_val <- max(x) - min(x)

    # Auto-detect unit
    if (unit == "auto") {
      if (range_val >= 1e9) {
        unit <- "Gb"
      } else if (range_val >= 1e6) {
        unit <- "Mb"
      } else if (range_val >= 1e3) {
        unit <- "kb"
      } else {
        unit <- "bp"
      }
    }

    # Convert and format
    divisor <- switch(
      unit,
      "Gb" = 1e9,
      "Mb" = 1e6,
      "kb" = 1e3,
      "bp" = 1,
      1
    )

    values <- x / divisor

    # Format with appropriate precision
    if (unit == "bp") {
      scales::comma(x)
    } else {
      paste0(round(values, accuracy), " ", unit)
    }
  }
}

#' Strand Scale
#'
#' A discrete scale for strand values (-1, 0, 1) with meaningful labels.
#'
#' @param ... Arguments passed to `scale_y_discrete()`.
#'
#' @return A ggplot2 scale.
#'
#' @export
scale_y_strand <- function(...) {
  ggplot2::scale_y_continuous(
    breaks = c(-1, 0, 1),
    labels = c("-", ".", "+"),
    limits = c(-1.5, 1.5),
    ...
  )
}

# Simple region parser (doesn't require jbrowseR)
parse_region_simple <- function(region_string) {
  region_string <- gsub("[, ]", "", region_string)
  pattern <- "^([^:]+):([0-9]+)[-\\.\\.]+([0-9]+)$"

  if (!grepl(pattern, region_string)) {
    return(list(ref_name = NA, start = NA, end = NA))
  }

  matches <- regmatches(region_string, regexec(pattern, region_string))[[1]]
  list(
    ref_name = matches[2],
    start = as.integer(matches[3]) - 1L,  # Convert to 0-based
    end = as.integer(matches[4])
  )
}
