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

#' Create a CRAM Track
#'
#' Creates a track configuration for CRAM alignment data.
#'
#' @param uri URL or local path to the CRAM file.
#' @param index URL or local path to the CRAM index (.crai).
#'   If NULL, assumes index is at `uri`.crai.
#' @param name Display name for the track.
#' @param ... Additional track options.
#'
#' @return A jbrowse_track object.
#'
#' @export
jb_track_cram <- function(uri, index = NULL, name = NULL, ...) {
  if (is.null(index)) {
    index <- paste0(uri, ".crai")
  }

  structure(
    list(
      type = "cram",
      uri = uri,
      index = index,
      name = name %||% basename(uri),
      options = list(...)
    ),
    class = c("jbrowse_track_cram", "jbrowse_track", "list")
  )
}

#' Create a Multi-BigWig Track
#'
#' Creates a track that combines multiple BigWig files into a single
#' multi-source quantitative display.
#'
#' @param uris Character vector of URLs or local paths to BigWig files.
#' @param names Optional character vector of source names.
#' @param name Display name for the combined track.
#' @param ... Additional track options.
#'
#' @return A jbrowse_track object.
#'
#' @export
jb_track_multi_bigwig <- function(uris, names = NULL, name = NULL, ...) {
  if (is.null(names)) {
    names <- tools::file_path_sans_ext(basename(uris))
  }

  structure(
    list(
      type = "multi_bigwig",
      uris = uris,
      source_names = names,
      name = name %||% "Multi-BigWig",
      options = list(...)
    ),
    class = c("jbrowse_track_multi_bigwig", "jbrowse_track", "list")
  )
}

#' Create a TwoBit GC Content Track
#'
#' Creates a track that computes GC content from a 2bit reference sequence
#' file using a sliding window, similar to JBrowse's GCContentDisplay.
#'
#' @param uri URL or local path to the .2bit file.
#' @param name Display name for the track.
#' @param window_size Sliding window size in base pairs (default 100).
#' @param window_delta Step size between windows (default same as window_size).
#' @param ... Additional track options.
#'
#' @return A jbrowse_track object.
#'
#' @export
jb_track_gc_content <- function(uri, name = NULL, window_size = 100,
                                window_delta = window_size, ...) {
  structure(
    list(
      type = "gc_content",
      uri = uri,
      name = name %||% "GC Content",
      window_size = window_size,
      window_delta = window_delta,
      options = list(...)
    ),
    class = c("jbrowse_track_gc_content", "jbrowse_track", "list")
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
