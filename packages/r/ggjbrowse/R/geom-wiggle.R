#' Wiggle/Coverage Track Geom
#'
#' Draws a filled area or line plot for quantitative genomic data,
#' similar to JBrowse's LinearWiggleDisplay.
#'
#' @section Aesthetics:
#' `geom_wiggle()` understands the following aesthetics (required in bold):
#' * **x** - Start position (or use xend for ranges)
#' * **y** - Score/value at this position
#' * xend - End position (for step-like coverage plots)
#' * fill - Fill color for area
#' * colour - Line color
#' * alpha - Transparency
#'
#' @param mapping Set of aesthetic mappings.
#' @param data The data to display.
#' @param stat Statistical transformation.
#' @param position Position adjustment.
#' @param ... Other arguments passed to layer.
#' @param geom_type Type of geometry: "area" (filled), "line", or "step".
#' @param baseline Y-value for the baseline (default 0).
#' @param na.rm Remove NA values?
#' @param show.legend Show legend?
#' @param inherit.aes Inherit aesthetics?
#'
#' @return A ggplot2 layer.
#'
#' @examples
#' \dontrun{
#' coverage <- data.frame(
#'   start = seq(1000, 10000, by = 100),
#'   end = seq(1100, 10100, by = 100),
#'   score = runif(91, 0, 100)
#' )
#'
#' ggplot(coverage, aes(x = start, xend = end, y = score)) +
#'   geom_wiggle(fill = "steelblue", alpha = 0.7) +
#'   theme_jbrowse_track()
#' }
#'
#' @export
geom_wiggle <- function(mapping = NULL, data = NULL,
                        stat = "identity", position = "identity",
                        ...,
                        geom_type = "area",
                        baseline = 0,
                        na.rm = FALSE,
                        show.legend = NA,
                        inherit.aes = TRUE) {

  # For simple cases, we can use existing ggplot2 geoms
  if (geom_type == "line") {
    return(ggplot2::geom_line(
      mapping = mapping,
      data = data,
      stat = stat,
      position = position,
      na.rm = na.rm,
      show.legend = show.legend,
      inherit.aes = inherit.aes,
      ...
    ))
  }

  ggplot2::layer(
    data = data,
    mapping = mapping,
    stat = stat,
    geom = GeomWiggle,
    position = position,
    show.legend = show.legend,
    inherit.aes = inherit.aes,
    params = list(
      geom_type = geom_type,
      baseline = baseline,
      na.rm = na.rm,
      ...
    )
  )
}

#' @rdname geom_wiggle
#' @format NULL
#' @usage NULL
#' @export
GeomWiggle <- ggplot2::ggproto("GeomWiggle", ggplot2::Geom,
  required_aes = c("x", "y"),

  default_aes = ggplot2::aes(
    fill = "steelblue",
    colour = NA,
    alpha = 0.7,
    linewidth = 0.5,
    linetype = 1,
    xend = NULL
  ),

  draw_key = ggplot2::draw_key_rect,

  draw_panel = function(data, panel_params, coord,
                        geom_type = "area", baseline = 0) {

    # Sort by x position
    data <- data[order(data$x), ]

    # Handle xend for step-style coverage
    has_xend <- "xend" %in% names(data) && !all(is.na(data$xend))

    if (has_xend && geom_type == "area") {
      # Step-style coverage: create rectangles for each bin
      coords <- coord$transform(data, panel_params)
      baseline_y <- coord$transform(
        data.frame(x = 0, y = baseline),
        panel_params
      )$y

      # Transform xend
      data_end <- data
      data_end$x <- data_end$xend
      coords_end <- coord$transform(data_end, panel_params)

      grobs <- lapply(seq_len(nrow(coords)), function(i) {
        grid::rectGrob(
          x = coords$x[i],
          y = baseline_y,
          width = coords_end$x[i] - coords$x[i],
          height = coords$y[i] - baseline_y,
          just = c("left", "bottom"),
          default.units = "native",
          gp = grid::gpar(
            fill = scales::alpha(coords$fill[i], coords$alpha[i]),
            col = if (is.na(coords$colour[i])) NA else coords$colour[i],
            lwd = coords$linewidth[i]
          )
        )
      })

      return(do.call(grid::gList, grobs))
    }

    # Standard area plot
    coords <- coord$transform(data, panel_params)
    baseline_y <- coord$transform(
      data.frame(x = 0, y = baseline),
      panel_params
    )$y

    # Build polygon coordinates
    n <- nrow(coords)
    if (n < 2) return(grid::nullGrob())

    # Polygon: go along top, then back along baseline
    poly_x <- c(coords$x, rev(coords$x))
    poly_y <- c(coords$y, rep(baseline_y, n))

    grid::polygonGrob(
      x = poly_x,
      y = poly_y,
      default.units = "native",
      gp = grid::gpar(
        fill = scales::alpha(coords$fill[1], coords$alpha[1]),
        col = if (is.na(coords$colour[1])) NA else coords$colour[1],
        lwd = coords$linewidth[1]
      )
    )
  }
)

#' Bicolor Wiggle Geom
#'
#' Draws a wiggle plot with different colors above and below a pivot point.
#' Useful for strand-specific coverage or log-ratio data.
#'
#' @inheritParams geom_wiggle
#' @param pivot Y-value for the color pivot point (default 0).
#' @param pos_fill Fill color for values above pivot.
#' @param neg_fill Fill color for values below pivot.
#'
#' @export
geom_wiggle_bicolor <- function(mapping = NULL, data = NULL,
                                stat = "identity", position = "identity",
                                ...,
                                pivot = 0,
                                pos_fill = "blue",
                                neg_fill = "red",
                                na.rm = FALSE,
                                show.legend = NA,
                                inherit.aes = TRUE) {

  # Create two layers: one for positive, one for negative
  list(
    ggplot2::layer(
      data = data,
      mapping = mapping,
      stat = stat,
      geom = GeomWiggle,
      position = position,
      show.legend = show.legend,
      inherit.aes = inherit.aes,
      params = list(
        baseline = pivot,
        fill = pos_fill,
        na.rm = na.rm,
        filter_fn = function(d) dplyr::filter(d, .data$y >= pivot),
        ...
      )
    ),
    ggplot2::layer(
      data = data,
      mapping = mapping,
      stat = stat,
      geom = GeomWiggle,
      position = position,
      show.legend = show.legend,
      inherit.aes = inherit.aes,
      params = list(
        baseline = pivot,
        fill = neg_fill,
        na.rm = na.rm,
        filter_fn = function(d) dplyr::filter(d, .data$y < pivot),
        ...
      )
    )
  )
}
