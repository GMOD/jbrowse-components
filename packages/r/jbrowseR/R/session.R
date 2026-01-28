#' Create a JBrowse Session
#'
#' Creates a session object that holds references to genomic data tracks,
#' similar to a JBrowse 2 session configuration.
#'
#' @param assembly Character string specifying the assembly name (e.g., "hg38", "mm10")
#'   or an assembly object created with `jb_assembly()`.
#' @param tracks A named list of track objects created with `jb_track_*()` functions.
#' @param ... Additional session options.
#'
#' @return A jbrowse_session object containing track configurations.
#'
#' @examples
#' \dontrun{
#' session <- jb_session(
#'   assembly = "hg38",
#'   tracks = list(
#'     genes = jb_track_gff3("https://example.com/genes.gff3.gz"),
#'     coverage = jb_track_bigwig("https://example.com/sample.bw")
#'   )
#' )
#' }
#'
#' @export
jb_session <- function(assembly, tracks = list(), ...) {
  if (is.character(assembly)) {
    assembly <- list(name = assembly)
  }

  session <- structure(
    list(
      assembly = assembly,
      tracks = tracks,
      options = list(...)
    ),
    class = "jbrowse_session"
  )

  session
}

#' Print method for jbrowse_session
#' @param x A jbrowse_session object
#' @param ... Additional arguments (ignored)
#' @export
print.jbrowse_session <- function(x, ...) {
 cat("JBrowse Session\n")
 cat("Assembly:", x$assembly$name, "\n")
 cat("Tracks:", length(x$tracks), "\n")
 if (length(x$tracks) > 0) {
    for (name in names(x$tracks)) {
      track <- x$tracks[[name]]
      cat("
 -", name, "(", track$type, ")\n")
    }
  }
  invisible(x)
}

#' Load JBrowse Session from Config File
#'
#' Loads a JBrowse 2 configuration file and creates a session object.
#'
#' @param config_path Path to a JBrowse 2 config.json file or URL.
#'
#' @return A jbrowse_session object.
#'
#' @examples
#' \dontrun{
#' session <- jb_from_config("config.json")
#' }
#'
#' @export
jb_from_config <- function(config_path) {
  if (grepl("^https?://", config_path)) {
    config <- jsonlite::fromJSON(config_path)
  } else {
    config <- jsonlite::fromJSON(config_path)
  }

  # Extract assembly
  assembly <- if (!is.null(config$assembly)) {
    config$assembly
  } else if (!is.null(config$assemblies) && length(config$assemblies) > 0) {
    config$assemblies[[1]]
  } else {
    list(name = "unknown")
  }

  # Extract tracks
  tracks <- list()
  if (!is.null(config$tracks)) {
    for (i in seq_along(config$tracks)) {
      track_conf <- config$tracks[[i]]
      track_id <- track_conf$trackId %||% paste0("track_", i)
      adapter <- track_conf$adapter

      if (!is.null(adapter)) {
        track <- switch(
          adapter$type,
          "BigWigAdapter" = jb_track_bigwig(
            adapter$bigWigLocation$uri,
            name = track_conf$name
          ),
          "VcfTabixAdapter" = jb_track_vcf(
            adapter$vcfGzLocation$uri,
            index = adapter$index$location$uri,
            name = track_conf$name
          ),
          "Gff3TabixAdapter" = jb_track_gff3(
            adapter$gffGzLocation$uri,
            index = adapter$index$location$uri,
            name = track_conf$name
          ),
          "BamAdapter" = jb_track_bam(
            adapter$bamLocation$uri,
            index = adapter$index$location$uri,
            name = track_conf$name
          ),
          # Default: create generic track
          structure(
            list(
              type = adapter$type,
              adapter = adapter,
              name = track_conf$name
            ),
            class = c("jbrowse_track", "list")
          )
        )
        tracks[[track_id]] <- track
      }
    }
  }

  jb_session(assembly = assembly, tracks = tracks)
}

#' Export Session to JBrowse Config
#'
#' Exports a jbrowse_session object to a JBrowse 2 configuration file.
#'
#' @param session A jbrowse_session object.
#' @param path Output file path.
#' @param pretty Logical, whether to pretty-print the JSON.
#'
#' @return Invisibly returns the session.
#'
#' @export
jb_to_config <- function(session, path, pretty = TRUE) {
  stopifnot(inherits(session, "jbrowse_session"))

  config <- list(
    assemblies = list(session$assembly),
    tracks = lapply(names(session$tracks), function(track_id) {
      track <- session$tracks[[track_id]]
      list(
        trackId = track_id,
        name = track$name %||% track_id,
        type = track_to_jbrowse_type(track),
        adapter = track_to_adapter_config(track)
      )
    })
  )

  jsonlite::write_json(
    config,
    path,
    pretty = pretty,
    auto_unbox = TRUE
  )

  invisible(session)
}

# Helper to convert track to JBrowse track type
track_to_jbrowse_type <- function(track) {
  switch(
    track$type,
    "bigwig" = "QuantitativeTrack",
    "vcf" = "VariantTrack",
    "gff3" = "FeatureTrack",
    "bam" = "AlignmentsTrack",
    "bed" = "FeatureTrack",
    "FeatureTrack"
  )
}

# Helper to convert track to adapter config
track_to_adapter_config <- function(track) {
  switch(
    track$type,
    "bigwig" = list(
      type = "BigWigAdapter",
      bigWigLocation = list(uri = track$uri)
    ),
    "vcf" = list(
      type = "VcfTabixAdapter",
      vcfGzLocation = list(uri = track$uri),
      index = list(location = list(uri = track$index))
    ),
    "gff3" = list(
      type = "Gff3TabixAdapter",
      gffGzLocation = list(uri = track$uri),
      index = list(location = list(uri = track$index))
    ),
    "bam" = list(
      type = "BamAdapter",
      bamLocation = list(uri = track$uri),
      index = list(location = list(uri = track$index))
    ),
    "bed" = list(
      type = "BedTabixAdapter",
      bedGzLocation = list(uri = track$uri),
      index = list(location = list(uri = track$index))
    ),
    track$adapter
  )
}

# Null coalescing operator
`%||%` <- function(x, y) if (is.null(x)) y else x
