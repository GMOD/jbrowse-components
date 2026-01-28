#' JBrowse-style Theme
#'
#' A ggplot2 theme that mimics the JBrowse 2 visual style.
#'
#' @param base_size Base font size.
#' @param base_family Base font family.
#'
#' @return A ggplot2 theme.
#'
#' @examples
#' \dontrun{
#' ggplot(data, aes(x = start, y = score)) +
#'   geom_point() +
#'   theme_jbrowse()
#' }
#'
#' @export
theme_jbrowse <- function(base_size = 11, base_family = "") {
  ggplot2::theme_minimal(base_size = base_size, base_family = base_family) +
    ggplot2::theme(
      # Panel
      panel.background = ggplot2::element_rect(fill = "white", colour = NA),
      panel.grid.major = ggplot2::element_line(colour = "#f0f0f0", linewidth = 0.25),
      panel.grid.minor = ggplot2::element_blank(),
      panel.border = ggplot2::element_rect(colour = "#e0e0e0", fill = NA, linewidth = 0.5),

      # Axes
      axis.line = ggplot2::element_blank(),
      axis.ticks = ggplot2::element_line(colour = "#cccccc", linewidth = 0.25),
      axis.text = ggplot2::element_text(colour = "#333333", size = base_size * 0.9),
      axis.title = ggplot2::element_text(colour = "#333333", size = base_size),

      # Legend
      legend.background = ggplot2::element_rect(fill = "white", colour = NA),
      legend.key = ggplot2::element_rect(fill = "white", colour = NA),
      legend.text = ggplot2::element_text(size = base_size * 0.85),
      legend.title = ggplot2::element_text(size = base_size * 0.9),

      # Strip (for facets)
      strip.background = ggplot2::element_rect(fill = "#f5f5f5", colour = "#e0e0e0"),
      strip.text = ggplot2::element_text(colour = "#333333", size = base_size * 0.9),

      # Plot
      plot.background = ggplot2::element_rect(fill = "white", colour = NA),
      plot.title = ggplot2::element_text(
        size = base_size * 1.2,
        hjust = 0,
        margin = ggplot2::margin(b = base_size / 2)
      ),
      plot.subtitle = ggplot2::element_text(
        size = base_size,
        colour = "#666666",
        hjust = 0,
        margin = ggplot2::margin(b = base_size / 2)
      ),
      plot.margin = ggplot2::margin(base_size, base_size, base_size, base_size)
    )
}

#' JBrowse Track Theme
#'
#' A minimal theme optimized for individual tracks in a multi-track view.
#' Has minimal margins and decorations for tight stacking.
#'
#' @param base_size Base font size.
#' @param base_family Base font family.
#'
#' @return A ggplot2 theme.
#'
#' @examples
#' \dontrun{
#' ggplot(coverage, aes(x = start, y = score)) +
#'   geom_wiggle() +
#'   theme_jbrowse_track()
#' }
#'
#' @export
theme_jbrowse_track <- function(base_size = 10, base_family = "") {
  ggplot2::theme_minimal(base_size = base_size, base_family = base_family) +
    ggplot2::theme(
      # Minimal panel
      panel.background = ggplot2::element_rect(fill = "white", colour = NA),
      panel.grid.major.x = ggplot2::element_blank(),
      panel.grid.major.y = ggplot2::element_line(colour = "#f0f0f0", linewidth = 0.25),
      panel.grid.minor = ggplot2::element_blank(),
      panel.border = ggplot2::element_rect(colour = "#e0e0e0", fill = NA, linewidth = 0.5),

      # Minimal axes
      axis.line = ggplot2::element_blank(),
      axis.ticks.x = ggplot2::element_line(colour = "#cccccc", linewidth = 0.25),
      axis.ticks.y = ggplot2::element_blank(),
      axis.text.x = ggplot2::element_text(colour = "#666666", size = base_size * 0.85),
      axis.text.y = ggplot2::element_text(colour = "#666666", size = base_size * 0.8),
      axis.title.x = ggplot2::element_blank(),
      axis.title.y = ggplot2::element_text(
        colour = "#333333",
        size = base_size * 0.9,
        angle = 0,
        vjust = 0.5
      ),

      # No legend by default
      legend.position = "none",

      # Minimal margins
      plot.background = ggplot2::element_rect(fill = "white", colour = NA),
      plot.title = ggplot2::element_text(
        size = base_size,
        hjust = 0,
        margin = ggplot2::margin(b = 2)
      ),
      plot.margin = ggplot2::margin(2, 5, 2, 5)
    )
}

#' JBrowse Dark Theme
#'
#' A dark mode variant of the JBrowse theme.
#'
#' @param base_size Base font size.
#' @param base_family Base font family.
#'
#' @return A ggplot2 theme.
#'
#' @export
theme_jbrowse_dark <- function(base_size = 11, base_family = "") {
  ggplot2::theme_minimal(base_size = base_size, base_family = base_family) +
    ggplot2::theme(
      # Dark panel
      panel.background = ggplot2::element_rect(fill = "#1e1e1e", colour = NA),
      panel.grid.major = ggplot2::element_line(colour = "#333333", linewidth = 0.25),
      panel.grid.minor = ggplot2::element_blank(),
      panel.border = ggplot2::element_rect(colour = "#444444", fill = NA, linewidth = 0.5),

      # Light text on dark
      axis.line = ggplot2::element_blank(),
      axis.ticks = ggplot2::element_line(colour = "#555555", linewidth = 0.25),
      axis.text = ggplot2::element_text(colour = "#cccccc", size = base_size * 0.9),
      axis.title = ggplot2::element_text(colour = "#cccccc", size = base_size),

      # Legend
      legend.background = ggplot2::element_rect(fill = "#1e1e1e", colour = NA),
      legend.key = ggplot2::element_rect(fill = "#1e1e1e", colour = NA),
      legend.text = ggplot2::element_text(colour = "#cccccc", size = base_size * 0.85),
      legend.title = ggplot2::element_text(colour = "#cccccc", size = base_size * 0.9),

      # Strip
      strip.background = ggplot2::element_rect(fill = "#2d2d2d", colour = "#444444"),
      strip.text = ggplot2::element_text(colour = "#cccccc", size = base_size * 0.9),

      # Plot
      plot.background = ggplot2::element_rect(fill = "#1e1e1e", colour = NA),
      plot.title = ggplot2::element_text(colour = "#ffffff", size = base_size * 1.2, hjust = 0),
      plot.subtitle = ggplot2::element_text(colour = "#999999", size = base_size, hjust = 0),
      plot.margin = ggplot2::margin(base_size, base_size, base_size, base_size)
    )
}
