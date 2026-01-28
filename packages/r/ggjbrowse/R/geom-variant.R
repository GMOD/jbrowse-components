#' Variant Track Geom
#'
#' Draws variant markers, similar to JBrowse's VariantTrack display.
#' Supports lollipop, bar, and diamond styles.
#'
#' @section Aesthetics:
#' `geom_variant()` understands the following aesthetics (required in bold):
#' * **x** - Position of the variant
#' * y - Y position (default: 0)
#' * colour - Marker color
#' * fill - Fill color
#' * shape - Marker shape
#' * size - Marker size
#' * label - Variant label
#'
#' @param mapping Set of aesthetic mappings.
#' @param data The data to display.
#' @param stat Statistical transformation.
#' @param position Position adjustment.
#' @param ... Other arguments.
#' @param style Marker style: "lollipop", "bar", "diamond", or "point".
#' @param stem_height Height of lollipop stem (0-1).
#' @param na.rm Remove NA values?
#' @param show.legend Show legend?
#' @param inherit.aes Inherit aesthetics?
#'
#' @return A ggplot2 layer.
#'
#' @examples
#' \dontrun{
#' variants <- data.frame(
#'   pos = c(1000, 2500, 5000, 7500),
#'   type = c("SNV", "deletion", "insertion", "SNV"),
#'   name = c("rs123", "del1", "ins1", "rs456")
#' )
#'
#' ggplot(variants, aes(x = pos, color = type, label = name)) +
#'   geom_variant(style = "lollipop") +
#'   theme_jbrowse_track()
#' }
#'
#' @export
geom_variant <- function(mapping = NULL, data = NULL,
                         stat = "identity", position = "identity",
                         ...,
                         style = "lollipop",
                         stem_height = 0.8,
                         na.rm = FALSE,
                         show.legend = NA,
                         inherit.aes = TRUE) {

  if (style == "point") {
    return(ggplot2::geom_point(
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
    geom = GeomVariant,
    position = position,
    show.legend = show.legend,
    inherit.aes = inherit.aes,
    params = list(
      style = style,
      stem_height = stem_height,
      na.rm = na.rm,
      ...
    )
  )
}

#' @rdname geom_variant
#' @format NULL
#' @usage NULL
#' @export
GeomVariant <- ggplot2::ggproto("GeomVariant", ggplot2::Geom,
  required_aes = c("x"),

  default_aes = ggplot2::aes(
    y = 0,
    colour = "steelblue",
    fill = "steelblue",
    size = 3,
    alpha = 1,
    shape = 21,
    stroke = 0.5
  ),

  draw_key = ggplot2::draw_key_point,

  draw_panel = function(data, panel_params, coord,
                        style = "lollipop", stem_height = 0.8) {

    coords <- coord$transform(data, panel_params)

    if (style == "lollipop") {
      # Draw stems and circles
      grobs <- lapply(seq_len(nrow(coords)), function(i) {
        row <- coords[i, ]

        # Stem line
        stem <- grid::segmentsGrob(
          x0 = row$x, y0 = 0,
          x1 = row$x, y1 = row$y + stem_height * 0.1,
          default.units = "native",
          gp = grid::gpar(
            col = scales::alpha(row$colour, row$alpha),
            lwd = 0.5
          )
        )

        # Circle head
        head <- grid::pointsGrob(
          x = row$x,
          y = row$y + stem_height * 0.1,
          pch = row$shape,
          size = grid::unit(row$size, "mm"),
          default.units = "native",
          gp = grid::gpar(
            col = scales::alpha(row$colour, row$alpha),
            fill = scales::alpha(row$fill, row$alpha),
            lwd = row$stroke
          )
        )

        grid::gTree(children = grid::gList(stem, head))
      })

      return(do.call(grid::gList, grobs))
    }

    if (style == "bar") {
      # Simple vertical bars
      grobs <- lapply(seq_len(nrow(coords)), function(i) {
        row <- coords[i, ]
        grid::rectGrob(
          x = row$x,
          y = 0,
          width = grid::unit(2, "mm"),
          height = row$y + 0.1,
          just = c("center", "bottom"),
          default.units = "native",
          gp = grid::gpar(
            fill = scales::alpha(row$fill, row$alpha),
            col = NA
          )
        )
      })

      return(do.call(grid::gList, grobs))
    }

    if (style == "diamond") {
      # Diamond shapes
      grobs <- lapply(seq_len(nrow(coords)), function(i) {
        row <- coords[i, ]
        size <- row$size * 0.01

        grid::polygonGrob(
          x = c(row$x, row$x + size, row$x, row$x - size),
          y = c(row$y + size * 1.5, row$y, row$y - size * 1.5, row$y),
          default.units = "native",
          gp = grid::gpar(
            fill = scales::alpha(row$fill, row$alpha),
            col = scales::alpha(row$colour, row$alpha),
            lwd = row$stroke
          )
        )
      })

      return(do.call(grid::gList, grobs))
    }

    # Default: points
    grid::pointsGrob(
      x = coords$x,
      y = coords$y,
      pch = coords$shape,
      size = grid::unit(coords$size, "mm"),
      default.units = "native",
      gp = grid::gpar(
        col = scales::alpha(coords$colour, coords$alpha),
        fill = scales::alpha(coords$fill, coords$alpha)
      )
    )
  }
)
