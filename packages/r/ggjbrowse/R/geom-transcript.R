#' Transcript Glyph Geom
#'
#' Draws gene/transcript features with exon/intron structure, similar to
#' JBrowse's ProcessedTranscript glyph. Shows:
#' - Thick boxes for CDS (coding regions)
#' - Thinner boxes for UTRs
#' - Lines with optional chevrons connecting exons (introns)
#'
#' This geom expects pre-processed data with subfeatures. Use
#' `prepare_gene_data()` to prepare your GFF3 data first.
#'
#' @section Aesthetics:
#' Required aesthetics for the main features (genes/transcripts):
#' * **xmin** - Start position
#' * **xmax** - End position
#' * **y** - Y position (typically from layout_row)
#'
#' For subfeatures, provide a separate data frame with:
#' * **xmin**, **xmax** - Subfeature positions
#' * **y** - Same y as parent (layout_row)
#' * **type** - Feature type (exon, CDS, UTR, etc.)
#'
#' @param mapping Aesthetic mappings.
#' @param data Data for main features (genes/transcripts).
#' @param subfeatures Data frame of subfeatures (exons, CDS, UTRs).
#' @param stat Statistical transformation.
#' @param position Position adjustment.
#' @param ... Other arguments.
#' @param intron_style How to draw introns: "line", "chevron", or "none".
#' @param cds_height Height of CDS boxes (0-1 scale).
#' @param utr_height Height of UTR boxes (0-1 scale).
#' @param exon_height Height of plain exon boxes (0-1 scale).
#' @param show_strand Show strand direction with chevrons on introns.
#' @param chevron_size Size of strand chevrons.
#' @param na.rm Remove NA values?
#' @param show.legend Show legend?
#' @param inherit.aes Inherit aesthetics?
#'
#' @return A list of ggplot2 layers.
#'
#' @examples
#' \dontrun{
#' # Prepare data
#' gene_data <- prepare_gene_data(features)
#'
#' ggplot() +
#'   geom_transcript(
#'     data = gene_data$genes,
#'     aes(xmin = start, xmax = end, y = layout_row),
#'     subfeatures = gene_data$subfeatures
#'   ) +
#'   theme_jbrowse_track()
#' }
#'
#' @export
geom_transcript <- function(mapping = NULL, data = NULL,
                            subfeatures = NULL,
                            stat = "identity", position = "identity",
                            ...,
                            intron_style = "chevron",
                            cds_height = 0.8,
                            utr_height = 0.5,
                            exon_height = 0.6,
                            show_strand = TRUE,
                            chevron_size = 0.3,
                            na.rm = FALSE,
                            show.legend = NA,
                            inherit.aes = TRUE) {

  # Build list of layers
  layers <- list()

  # Layer 1: Intron lines (backbone connecting exons)
  # We'll draw a thin line spanning the entire gene
  layers[[1]] <- ggplot2::geom_segment(
    mapping = ggplot2::aes(x = .data$xmin, xend = .data$xmax,
                           y = .data$y, yend = .data$y),
    data = data,
    linewidth = 0.5,
    color = "gray40",
    na.rm = na.rm,
    show.legend = FALSE,
    inherit.aes = FALSE
  )

  # Layer 2: Subfeatures (exons, CDS, UTRs)
  if (!is.null(subfeatures) && nrow(subfeatures) > 0) {
    # CDS - thick boxes
    cds_data <- subfeatures[subfeatures$type == "CDS", , drop = FALSE]
    if (nrow(cds_data) > 0) {
      layers[[length(layers) + 1]] <- ggplot2::geom_rect(
        mapping = ggplot2::aes(
          xmin = .data$start, xmax = .data$end,
          ymin = .data$layout_row - cds_height / 2,
          ymax = .data$layout_row + cds_height / 2
        ),
        data = cds_data,
        fill = "#c9a857",  # JBrowse gold color
        color = "#8b7355",
        linewidth = 0.3,
        na.rm = na.rm,
        show.legend = FALSE,
        inherit.aes = FALSE
      )
    }

    # UTRs - thinner boxes
    utr_data <- subfeatures[grepl("UTR", subfeatures$type, ignore.case = TRUE), , drop = FALSE]
    if (nrow(utr_data) > 0) {
      layers[[length(layers) + 1]] <- ggplot2::geom_rect(
        mapping = ggplot2::aes(
          xmin = .data$start, xmax = .data$end,
          ymin = .data$layout_row - utr_height / 2,
          ymax = .data$layout_row + utr_height / 2
        ),
        data = utr_data,
        fill = "#c9a857",
        color = "#8b7355",
        linewidth = 0.3,
        alpha = 0.6,
        na.rm = na.rm,
        show.legend = FALSE,
        inherit.aes = FALSE
      )
    }

    # Plain exons (when no CDS/UTR info) - medium boxes
    exon_data <- subfeatures[subfeatures$type == "exon", , drop = FALSE]
    # Only draw exons that don't have corresponding CDS
    if (nrow(exon_data) > 0 && nrow(cds_data) == 0) {
      layers[[length(layers) + 1]] <- ggplot2::geom_rect(
        mapping = ggplot2::aes(
          xmin = .data$start, xmax = .data$end,
          ymin = .data$layout_row - exon_height / 2,
          ymax = .data$layout_row + exon_height / 2
        ),
        data = exon_data,
        fill = "#c9a857",
        color = "#8b7355",
        linewidth = 0.3,
        na.rm = na.rm,
        show.legend = FALSE,
        inherit.aes = FALSE
      )
    }
  }

  # Layer 3: Strand chevrons on introns
  if (show_strand && intron_style == "chevron" && !is.null(subfeatures)) {
    chevron_data <- make_intron_chevrons(data, subfeatures, chevron_size)
    if (nrow(chevron_data) > 0) {
      layers[[length(layers) + 1]] <- ggplot2::geom_segment(
        mapping = ggplot2::aes(
          x = .data$x, xend = .data$xend,
          y = .data$y, yend = .data$yend
        ),
        data = chevron_data,
        linewidth = 0.4,
        color = "gray30",
        na.rm = na.rm,
        show.legend = FALSE,
        inherit.aes = FALSE
      )
    }
  }

  # Layer 4: Labels
  if (!is.null(data) && "name" %in% names(data)) {
    layers[[length(layers) + 1]] <- ggplot2::geom_text(
      mapping = ggplot2::aes(
        x = .data$xmin,
        y = .data$y + 0.6,
        label = .data$name
      ),
      data = data[!is.na(data$name), , drop = FALSE],
      hjust = 0,
      vjust = 0,
      size = 2.5,
      color = "black",
      na.rm = na.rm,
      show.legend = FALSE,
      inherit.aes = FALSE
    )
  }

  layers
}

#' Create chevron data for introns
#'
#' Generates line segments for strand-indicating chevrons in intron regions.
#'
#' @param genes Gene/transcript data frame.
#' @param subfeatures Subfeature data frame.
#' @param chevron_size Relative size of chevrons.
#'
#' @return Data frame with x, xend, y, yend for chevron segments.
#'
#' @keywords internal
make_intron_chevrons <- function(genes, subfeatures, chevron_size = 0.3) {
  if (is.null(genes) || nrow(genes) == 0) {
    return(data.frame(x = numeric(), xend = numeric(),
                      y = numeric(), yend = numeric()))
  }

  chevrons <- list()

  for (i in seq_len(nrow(genes))) {
    gene <- genes[i, ]
    gene_id <- gene$feature_id
    strand <- if (!is.null(gene$strand)) gene$strand else 1
    row_y <- gene$layout_row

    # Find subfeatures for this gene (direct children or grandchildren)
    # Look for features whose parent matches this gene or its children
    gene_subs <- subfeatures[
      !is.na(subfeatures$parent_id) &
      (subfeatures$parent_id == gene_id |
       subfeatures$parent_id %in% subfeatures$feature_id[subfeatures$parent_id == gene_id]),
      , drop = FALSE
    ]

    # Also match by layout_row
    if (nrow(gene_subs) == 0) {
      gene_subs <- subfeatures[subfeatures$layout_row == row_y, , drop = FALSE]
    }

    if (nrow(gene_subs) < 2) next

    # Get exon/CDS positions sorted
    exon_like <- gene_subs[gene_subs$type %in% c("exon", "CDS"), , drop = FALSE]
    if (nrow(exon_like) < 2) next

    exon_like <- exon_like[order(exon_like$start), , drop = FALSE]

    # Create chevrons in intron regions
    for (j in seq_len(nrow(exon_like) - 1)) {
      intron_start <- exon_like$end[j]
      intron_end <- exon_like$start[j + 1]
      intron_mid <- (intron_start + intron_end) / 2
      intron_width <- intron_end - intron_start

      # Skip if intron is too small
      if (intron_width < 100) next

      # Chevron points in direction of strand
      chev_width <- min(intron_width * 0.2, 500)
      chev_height <- chevron_size * 0.3

      if (strand >= 0) {
        # Forward strand: > shape
        chevrons[[length(chevrons) + 1]] <- data.frame(
          x = intron_mid - chev_width / 2,
          xend = intron_mid,
          y = row_y - chev_height,
          yend = row_y
        )
        chevrons[[length(chevrons) + 1]] <- data.frame(
          x = intron_mid,
          xend = intron_mid - chev_width / 2,
          y = row_y,
          yend = row_y + chev_height
        )
      } else {
        # Reverse strand: < shape
        chevrons[[length(chevrons) + 1]] <- data.frame(
          x = intron_mid + chev_width / 2,
          xend = intron_mid,
          y = row_y - chev_height,
          yend = row_y
        )
        chevrons[[length(chevrons) + 1]] <- data.frame(
          x = intron_mid,
          xend = intron_mid + chev_width / 2,
          y = row_y,
          yend = row_y + chev_height
        )
      }
    }
  }

  if (length(chevrons) == 0) {
    return(data.frame(x = numeric(), xend = numeric(),
                      y = numeric(), yend = numeric()))
  }

  do.call(rbind, chevrons)
}

#' Simple Gene Boxes with Layout
#'
#' A simpler alternative to geom_transcript that just draws rectangular
#' boxes with automatic stacking layout. Good for quick visualization
#' without the full exon/intron structure.
#'
#' @param data Feature data (will compute layout automatically).
#' @param mapping Aesthetic mappings.
#' @param padding Padding for layout computation (in bp).
#' @param box_height Height of feature boxes.
#' @param fill_col Column to use for fill color.
#' @param ... Other arguments passed to geom_rect.
#'
#' @return A list of ggplot2 layers.
#'
#' @export
geom_gene_simple <- function(data, mapping = NULL, padding = 500,
                             box_height = 0.7, fill_col = "type", ...) {
  # Compute layout
  data <- compute_layout(data, padding = padding)

  # Default mapping
  if (is.null(mapping)) {
    mapping <- ggplot2::aes()
  }

  list(
    ggplot2::geom_rect(
      mapping = ggplot2::aes(
        xmin = .data$start, xmax = .data$end,
        ymin = .data$layout_row - box_height / 2,
        ymax = .data$layout_row + box_height / 2
      ),
      data = data,
      fill = "#E07A5F",
      color = "#B5563E",
      linewidth = 0.3,
      ...
    ),
    ggplot2::geom_text(
      mapping = ggplot2::aes(
        x = .data$start,
        y = .data$layout_row + box_height / 2 + 0.15,
        label = .data$name
      ),
      data = data[!is.na(data$name), , drop = FALSE],
      hjust = 0,
      size = 2.5,
      ...
    )
  )
}
