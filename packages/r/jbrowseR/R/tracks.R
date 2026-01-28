#' Create a BigWig Track
#'
#' Creates a track configuration for BigWig quantitative data.
#'
#' @param uri URL or local path to the BigWig file.
#' @param name Display name for the track.
#' @param ... Additional track options.
#'
#' @return A jbrowse_track object.
#'
#' @examples
#' \dontrun{
#' track <- jb_track_bigwig("https://example.com/coverage.bw", name = "Coverage")
#' }
#'
#' @export
jb_track_bigwig <- function(uri, name = NULL, ...) {
  structure(
    list(
      type = "bigwig",
      uri = uri,
      name = name %||% basename(uri),
      options = list(...)
    ),
    class = c("jbrowse_track_bigwig", "jbrowse_track", "list")
  )
}

#' Create a VCF Track
#'
#' Creates a track configuration for VCF variant data.
#'
#' @param uri URL or local path to the VCF file (bgzipped).
#' @param index URL or local path to the tabix index (.tbi).
#'   If NULL, assumes index is at `uri`.tbi.
#' @param name Display name for the track.
#' @param ... Additional track options.
#'
#' @return A jbrowse_track object.
#'
#' @export
jb_track_vcf <- function(uri, index = NULL, name = NULL, ...) {
  if (is.null(index)) {
    index <- paste0(uri, ".tbi")
  }

  structure(
    list(
      type = "vcf",
      uri = uri,
      index = index,
      name = name %||% basename(uri),
      options = list(...)
    ),
    class = c("jbrowse_track_vcf", "jbrowse_track", "list")
  )
}

#' Create a GFF3 Track
#'
#' Creates a track configuration for GFF3 annotation data.
#'
#' @param uri URL or local path to the GFF3 file (optionally bgzipped).
#' @param index URL or local path to the tabix index (.tbi).
#'   If NULL and uri ends with .gz, assumes index is at `uri`.tbi.
#' @param name Display name for the track.
#' @param ... Additional track options.
#'
#' @return A jbrowse_track object.
#'
#' @export
jb_track_gff3 <- function(uri, index = NULL, name = NULL, ...) {
  if (is.null(index) && grepl("\\.gz$", uri)) {
    index <- paste0(uri, ".tbi")
  }

  structure(
    list(
      type = "gff3",
      uri = uri,
      index = index,
      name = name %||% basename(uri),
      options = list(...)
    ),
    class = c("jbrowse_track_gff3", "jbrowse_track", "list")
  )
}

#' Create a BAM Track
#'
#' Creates a track configuration for BAM alignment data.
#'
#' @param uri URL or local path to the BAM file.
#' @param index URL or local path to the BAM index (.bai).
#'   If NULL, assumes index is at `uri`.bai.
#' @param name Display name for the track.
#' @param ... Additional track options.
#'
#' @return A jbrowse_track object.
#'
#' @export
jb_track_bam <- function(uri, index = NULL, name = NULL, ...) {
  if (is.null(index)) {
    index <- paste0(uri, ".bai")
  }

  structure(
    list(
      type = "bam",
      uri = uri,
      index = index,
      name = name %||% basename(uri),
      options = list(...)
    ),
    class = c("jbrowse_track_bam", "jbrowse_track", "list")
  )
}

#' Create a BED Track
#'
#' Creates a track configuration for BED feature data.
#'
#' @param uri URL or local path to the BED file (optionally bgzipped).
#' @param index URL or local path to the tabix index (.tbi).
#'   If NULL and uri ends with .gz, assumes index is at `uri`.tbi.
#' @param name Display name for the track.
#' @param ... Additional track options.
#'
#' @return A jbrowse_track object.
#'
#' @export
jb_track_bed <- function(uri, index = NULL, name = NULL, ...) {
  if (is.null(index) && grepl("\\.gz$", uri)) {
    index <- paste0(uri, ".tbi")
  }

  structure(
    list(
      type = "bed",
      uri = uri,
      index = index,
      name = name %||% basename(uri),
      options = list(...)
    ),
    class = c("jbrowse_track_bed", "jbrowse_track", "list")
  )
}

#' Print method for jbrowse_track
#' @param x A jbrowse_track object
#' @param ... Additional arguments (ignored)
#' @export
print.jbrowse_track <- function(x, ...) {
  cat("JBrowse Track\n")
  cat("  Type:", x$type, "\n")
  cat("  Name:", x$name, "\n")
  cat("  URI:", x$uri, "\n")
  if (!is.null(x$index)) {
    cat("  Index:", x$index, "\n")
  }
  invisible(x)
}

# Null coalescing operator (if not already defined)
if (!exists("%||%")) {
  `%||%` <- function(x, y) if (is.null(x)) y else x
}
