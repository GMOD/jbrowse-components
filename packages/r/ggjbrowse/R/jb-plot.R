#' Create Multi-Track JBrowse-style Plot
#'
#' A convenience function that creates a JBrowse-like multi-track view
#' by combining multiple ggplot2 plots using patchwork.
#'
#' @param session A jbrowseR session object (optional).
#' @param region A jbrowse_region or region string.
#' @param tracks Character vector of track IDs to display (if using session).
#' @param track_heights Relative heights for each track.
#' @param ... Additional ggplot objects to include.
#'
#' @return A patchwork plot object.
#'
#' @examples
#' \dontrun{
#' # Using individual ggplots
#' p_genes <- ggplot(genes, aes(xmin = start, xmax = end, y = strand)) +
#'   geom_gene() + theme_jbrowse_track()
#'
#' p_coverage <- ggplot(coverage, aes(x = start, y = score)) +
#'   geom_wiggle() + theme_jbrowse_track()
#'
#' jb_plot(
#'   region = "chr1:1000-5000",
#'   p_genes, p_coverage,
#'   track_heights = c(2, 1)
#' )
#'
#' # Using jbrowseR session
#' jb_plot(
#'   session = my_session,
#'   region = "chr1:1000-5000",
#'   tracks = c("genes", "coverage")
#' )
#' }
#'
#' @export
jb_plot <- function(session = NULL, region = NULL, tracks = NULL,
                    track_heights = NULL, ...) {

  if (!requireNamespace("patchwork", quietly = TRUE)) {
    stop("Package 'patchwork' is required. Install with: install.packages('patchwork')")
  }

  plots <- list(...)

  # If session provided, build plots from tracks
  if (!is.null(session) && !is.null(tracks)) {
    if (!requireNamespace("jbrowseR", quietly = TRUE)) {
      stop("Package 'jbrowseR' is required when using session argument")
    }

    # Parse region
    if (is.character(region)) {
      region_obj <- jbrowseR::jb_region(region)
    } else {
      region_obj <- region
    }

    for (track_id in tracks) {
      track <- session$tracks[[track_id]]
      if (is.null(track)) {
        warning("Track '", track_id, "' not found in session")
        next
      }

      # Get features
      features <- jbrowseR::jb_features(session, track_id, region_obj)

      # Create plot based on track type
      p <- create_track_plot(track, features, region_obj)
      plots <- c(plots, list(p))
    }
  }

  if (length(plots) == 0) {
    stop("No plots to combine")
  }

  # Add shared x scale to all plots
  if (!is.null(region)) {
    plots <- lapply(plots, function(p) {
      p + scale_x_genomic(region = region)
    })
  }

  # Combine with patchwork
  combined <- patchwork::wrap_plots(plots, ncol = 1)

  # Set heights if provided
  if (!is.null(track_heights)) {
    combined <- combined + patchwork::plot_layout(heights = track_heights)
  }

  # Add overall styling
  combined <- combined +
    patchwork::plot_annotation(
      theme = ggplot2::theme(
        plot.background = ggplot2::element_rect(fill = "white", colour = NA)
      )
    )

  combined
}

# Internal: Create a plot from a track and features
create_track_plot <- function(track, features, region) {
  track_type <- track$type
  track_name <- track$name

  if (track_type == "bigwig") {
    # Quantitative track
    ggplot2::ggplot(features, ggplot2::aes(x = .data$start, xend = .data$end, y = .data$score)) +
      geom_wiggle(fill = "steelblue", alpha = 0.7) +
      ggplot2::labs(title = track_name, y = "Score") +
      theme_jbrowse_track()

  } else if (track_type %in% c("gff3", "bed")) {
    # Feature track
    if ("strand" %in% names(features)) {
      ggplot2::ggplot(features, ggplot2::aes(
        xmin = .data$start, xmax = .data$end,
        y = .data$strand, label = .data$name
      )) +
        geom_gene(fill = "goldenrod") +
        scale_y_strand() +
        ggplot2::labs(title = track_name) +
        theme_jbrowse_track()
    } else {
      ggplot2::ggplot(features, ggplot2::aes(
        xmin = .data$start, xmax = .data$end, y = 0
      )) +
        geom_gene(fill = "goldenrod") +
        ggplot2::labs(title = track_name) +
        theme_jbrowse_track()
    }

  } else if (track_type == "vcf") {
    # Variant track
    ggplot2::ggplot(features, ggplot2::aes(
      x = .data$start,
      color = .data$type,
      label = .data$name
    )) +
      geom_variant(style = "lollipop") +
      ggplot2::labs(title = track_name) +
      theme_jbrowse_track()

  } else if (track_type == "bam") {
    # Alignment track - needs pileup computation
    features <- compute_pileup(features)
    ggplot2::ggplot(features, ggplot2::aes(
      xmin = .data$start, xmax = .data$end,
      y = .data$pileup_row,
      fill = factor(.data$strand)
    )) +
      geom_alignment() +
      ggplot2::scale_fill_manual(
        values = c("-1" = "#f4a582", "1" = "#92c5de"),
        labels = c("-1" = "Reverse", "1" = "Forward")
      ) +
      ggplot2::labs(title = track_name) +
      theme_jbrowse_track()

  } else {
    # Generic feature track
    ggplot2::ggplot(features, ggplot2::aes(
      xmin = .data$start, xmax = .data$end, y = 0
    )) +
      geom_gene(fill = "gray50") +
      ggplot2::labs(title = track_name) +
      theme_jbrowse_track()
  }
}
