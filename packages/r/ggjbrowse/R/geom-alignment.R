#' Alignment Track Geom
#'
#' Draws aligned reads, similar to JBrowse's LinearPileupDisplay.
#' This is a simplified version - full pileup layout requires more
#' sophisticated positioning.
#'
#' @section Aesthetics:
#' `geom_alignment()` understands the following aesthetics:
#' * **xmin** - Start position of the read
#' * **xmax** - End position of the read
#' * **y** - Y position (pileup row)
#' * fill - Fill color (often mapped to strand)
#' * colour - Border color
#' * alpha - Transparency
#'
#' @param mapping Set of aesthetic mappings.
#' @param data The data to display.
#' @param stat Statistical transformation.
#' @param position Position adjustment.
#' @param ... Other arguments.
#' @param height Height of each read (0-1).
#' @param gap Gap between reads vertically.
#' @param na.rm Remove NA values?
#' @param show.legend Show legend?
#' @param inherit.aes Inherit aesthetics?
#'
#' @return A ggplot2 layer.
#'
#' @examples
#' \dontrun{
#' # Note: For proper pileup, you'd need to compute y positions
#' # using a pileup algorithm
#' reads <- data.frame(
#'   start = c(1000, 1050, 1100, 1150),
#'   end = c(1100, 1150, 1200, 1250),
#'   strand = c(1, -1, 1, -1),
#'   row = c(1, 1, 2, 2)  # Pre-computed pileup row
#' )
#'
#' ggplot(reads, aes(xmin = start, xmax = end, y = row, fill = factor(strand))) +
#'   geom_alignment() +
#'   scale_fill_manual(values = c("-1" = "salmon", "1" = "lightblue")) +
#'   theme_jbrowse_track()
#' }
#'
#' @export
geom_alignment <- function(mapping = NULL, data = NULL,
                           stat = "identity", position = "identity",
                           ...,
                           height = 0.8,
                           gap = 0.1,
                           na.rm = FALSE,
                           show.legend = NA,
                           inherit.aes = TRUE) {

  ggplot2::layer(
    data = data,
    mapping = mapping,
    stat = stat,
    geom = GeomAlignment,
    position = position,
    show.legend = show.legend,
    inherit.aes = inherit.aes,
    params = list(
      height = height,
      gap = gap,
      na.rm = na.rm,
      ...
    )
  )
}

#' @rdname geom_alignment
#' @format NULL
#' @usage NULL
#' @export
GeomAlignment <- ggplot2::ggproto("GeomAlignment", ggplot2::Geom,
  required_aes = c("xmin", "xmax", "y"),

  default_aes = ggplot2::aes(
    fill = "steelblue",
    colour = NA,
    alpha = 0.8,
    linewidth = 0.25
  ),

  draw_key = ggplot2::draw_key_rect,

  draw_panel = function(data, panel_params, coord,
                        height = 0.8, gap = 0.1) {

    coords <- coord$transform(data, panel_params)

    # Calculate adjusted y positions for stacking
    y_scale <- 1 / (max(data$y, na.rm = TRUE) + 1)
    adj_height <- height * y_scale

    grobs <- lapply(seq_len(nrow(coords)), function(i) {
      row <- coords[i, ]

      grid::rectGrob(
        x = (row$xmin + row$xmax) / 2,
        y = row$y,
        width = row$xmax - row$xmin,
        height = adj_height,
        default.units = "native",
        gp = grid::gpar(
          fill = scales::alpha(row$fill, row$alpha),
          col = if (is.na(row$colour)) NA else row$colour,
          lwd = row$linewidth
        )
      )
    })

    do.call(grid::gList, grobs)
  }
)

#' Compute Pileup Layout
#'
#' Computes non-overlapping row assignments for aligned reads.
#' This is a simple greedy algorithm.
#'
#' @param data Data frame with start and end columns.
#' @param start_col Name of start column (default "start").
#' @param end_col Name of end column (default "end").
#' @param padding Minimum gap between reads in same row.
#'
#' @return Data frame with added 'pileup_row' column.
#'
#' @export
compute_pileup <- function(data, start_col = "start", end_col = "end",
                           padding = 10) {
  # Sort by start position
  data <- data[order(data[[start_col]]), ]

  n <- nrow(data)
  if (n == 0) {
    data$pileup_row <- integer(0)
    return(data)
  }

  # Track end position of last read in each row
  row_ends <- numeric(0)
  rows <- integer(n)

  for (i in seq_len(n)) {
    read_start <- data[[start_col]][i]
    read_end <- data[[end_col]][i]

    # Find first row where this read fits
    placed <- FALSE
    for (r in seq_along(row_ends)) {
      if (row_ends[r] + padding <= read_start) {
        rows[i] <- r
        row_ends[r] <- read_end
        placed <- TRUE
        break
      }
    }

    # If no existing row fits, create new one
    if (!placed) {
      row_ends <- c(row_ends, read_end)
      rows[i] <- length(row_ends)
    }
  }

  data$pileup_row <- rows
  data
}
