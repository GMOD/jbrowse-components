#' Gene/Feature Track Geom
#'
#' Draws gene-like features with optional directional arrows to indicate strand.
#' Similar to JBrowse's LinearBasicDisplay for gene annotations.
#'
#' @section Aesthetics:
#' `geom_gene()` understands the following aesthetics (required in bold):
#' * **xmin** - Start position of the feature
#' * **xmax** - End position of the feature
#' * **y** - Y position (typically strand: -1, 0, or 1)
#' * fill - Fill color
#' * colour - Border color
#' * alpha - Transparency
#' * label - Feature label to display
#' * type - Feature type (for coloring)
#'
#' @param mapping Set of aesthetic mappings created by `aes()`.
#' @param data The data to be displayed in this layer.
#' @param stat The statistical transformation to use.
#' @param position Position adjustment.
#' @param ... Other arguments passed to `layer()`.
#' @param arrow_size Size of the directional arrow (0 to disable).
#' @param height Height of the gene box (0-1 scale within y unit).
#' @param show_labels Whether to show feature labels.
#' @param label_position Position of labels: "above", "below", "inside", "none".
#' @param na.rm Remove NA values?
#' @param show.legend Show legend?
#' @param inherit.aes Inherit aesthetics from plot?
#'
#' @return A ggplot2 layer.
#'
#' @examples
#' \dontrun
#' library(ggplot2)
#'
#' genes <- data.frame(
#'   start = c(1000, 5000, 8000),
#'   end = c(3000, 7000, 12000),
#'   strand = c(1, -1, 1),
#'   name = c("Gene1", "Gene2", "Gene3"),
#'   type = c("protein_coding", "lncRNA", "protein_coding")
#' )
#'
#' ggplot(genes, aes(xmin = start, xmax = end, y = strand,
#'                   fill = type, label = name)) +
#'   geom_gene() +
#'   scale_y_strand() +
#'   theme_jbrowse_track()
#' }
#'
#' @export
geom_gene <- function(mapping = NULL, data = NULL,
                      stat = "identity", position = "identity",
                      ...,
                      arrow_size = 0.3,
                      height = 0.8,
                      show_labels = TRUE,
                      label_position = "above",
                      na.rm = FALSE,
                      show.legend = NA,
                      inherit.aes = TRUE) {

  ggplot2::layer(
    data = data,
    mapping = mapping,
    stat = stat,
    geom = GeomGene,
    position = position,
    show.legend = show.legend,
    inherit.aes = inherit.aes,
    params = list(
      arrow_size = arrow_size,
      height = height,
      show_labels = show_labels,
      label_position = label_position,
      na.rm = na.rm,
      ...
    )
  )
}

#' @rdname geom_gene
#' @format NULL
#' @usage NULL
#' @export
GeomGene <- ggplot2::ggproto("GeomGene", ggplot2::Geom,
  required_aes = c("xmin", "xmax", "y"),

  default_aes = ggplot2::aes(
    fill = "goldenrod",
    colour = NA,
    alpha = 1,
    linewidth = 0.5,
    linetype = 1,
    label = NA
  ),

  draw_key = ggplot2::draw_key_rect,

  draw_panel = function(data, panel_params, coord,
                        arrow_size = 0.3, height = 0.8,
                        show_labels = TRUE, label_position = "above") {

    # Transform coordinates
    coords <- coord$transform(data, panel_params)

    # Calculate box dimensions
    half_height <- height / 2

    # Create grobs for each feature
    grobs <- lapply(seq_len(nrow(coords)), function(i) {
      row <- coords[i, ]

      # Basic rectangle
      box_grob <- grid::rectGrob(
        x = (row$xmin + row$xmax) / 2,
        y = row$y,
        width = row$xmax - row$xmin,
        height = half_height * 2,
        default.units = "native",
        gp = grid::gpar(
          fill = scales::alpha(row$fill, row$alpha),
          col = if (is.na(row$colour)) NA else row$colour,
          lwd = row$linewidth,
          lty = row$linetype
        )
      )

      # Arrow indicator for strand
      arrow_grob <- NULL
      if (arrow_size > 0 && !is.na(row$y) && row$y != 0) {
        direction <- sign(row$y)
        arrow_x <- if (direction > 0) row$xmax else row$xmin

        # Simple arrow head
        arrow_grob <- grid::polygonGrob(
          x = c(arrow_x,
                arrow_x - direction * arrow_size * (row$xmax - row$xmin) * 0.1,
                arrow_x - direction * arrow_size * (row$xmax - row$xmin) * 0.1),
          y = c(row$y,
                row$y + half_height * 0.6,
                row$y - half_height * 0.6),
          default.units = "native",
          gp = grid::gpar(
            fill = scales::alpha(row$fill, row$alpha),
            col = NA
          )
        )
      }

      # Label
      label_grob <- NULL
      if (show_labels && !is.na(row$label) && label_position != "none") {
        label_y <- switch(
          label_position,
          "above" = row$y + half_height + 0.02,
          "below" = row$y - half_height - 0.02,
          "inside" = row$y,
          row$y + half_height + 0.02
        )

        label_grob <- grid::textGrob(
          label = row$label,
          x = (row$xmin + row$xmax) / 2,
          y = label_y,
          default.units = "native",
          gp = grid::gpar(
            fontsize = 9,
            col = "black"
          )
        )
      }

      grid::gTree(children = grid::gList(box_grob, arrow_grob, label_grob))
    })

    do.call(grid::gList, grobs)
  }
)
