#' Compute Non-Overlapping Layout for Features
#'
#' Assigns row numbers to features so that overlapping features are placed
#' in different rows, similar to JBrowse's layout system.
#'
#' @param data Data frame with start and end columns.
#' @param start_col Name of start column (default "start").
#' @param end_col Name of end column (default "end").
#' @param padding Minimum gap between features in same row (in base pairs).
#' @param group_col Optional column to group features (e.g., by strand).
#'
#' @return Data frame with added 'layout_row' column.
#'
#' @examples
#' \dontrun{
#' genes <- data.frame(
#'   start = c(100, 150, 300, 320),
#'   end = c(200, 250, 400, 450),
#'   name = c("gene1", "gene2", "gene3", "gene4")
#' )
#' genes_layout <- compute_layout(genes)
#' # gene1 and gene2 overlap, so they get different rows
#' }
#'
#' @export
compute_layout <- function(data, start_col = "start", end_col = "end",
                           padding = 100, group_col = NULL) {
  if (nrow(data) == 0) {
    data$layout_row <- integer(0)
    return(data)
 }

  # If grouping, compute layout within each group
 if (!is.null(group_col) && group_col %in% names(data)) {
    groups <- unique(data[[group_col]])
    result_list <- lapply(groups, function(g) {
      subset_data <- data[data[[group_col]] == g, , drop = FALSE]
      computed <- compute_layout_internal(subset_data, start_col, end_col, padding)
      computed
    })
    return(do.call(rbind, result_list))
  }

  compute_layout_internal(data, start_col, end_col, padding)
}

#' Internal layout computation
#' @keywords internal
compute_layout_internal <- function(data, start_col, end_col, padding) {
  # Sort by start position
  order_idx <- order(data[[start_col]])
  data <- data[order_idx, , drop = FALSE]

  n <- nrow(data)
  if (n == 0) {
    data$layout_row <- integer(0)
    return(data)
  }

  # Track end position of last feature in each row
  row_ends <- numeric(0)
  rows <- integer(n)

  for (i in seq_len(n)) {
    feat_start <- data[[start_col]][i]
    feat_end <- data[[end_col]][i]

    # Find first row where this feature fits
    placed <- FALSE
    for (r in seq_along(row_ends)) {
      if (row_ends[r] + padding <= feat_start) {
        rows[i] <- r
        row_ends[r] <- feat_end
        placed <- TRUE
        break
      }
    }

    # If no existing row fits, create new one
    if (!placed) {
      row_ends <- c(row_ends, feat_end)
      rows[i] <- length(row_ends)
    }
  }

  data$layout_row <- rows

  # Restore original order
  data[order(order_idx), , drop = FALSE]
}

#' Prepare Gene Data for Plotting
#'
#' Processes hierarchical GFF3 data to prepare it for gene glyph rendering.
#' Groups subfeatures (exons, CDS, UTRs) under their parent transcripts/genes.
#'
#' @param data Feature data frame from jb_features().
#' @param top_level_types Feature types to treat as top-level (default: gene, mRNA, transcript).
#' @param subfeature_types Feature types to treat as subfeatures.
#' @param padding Padding for layout computation.
#'
#' @return A list with:
#'   - `genes`: Top-level features with layout_row assigned
#'   - `subfeatures`: Subfeatures linked to their parents
#'
#' @export
prepare_gene_data <- function(data,
                              top_level_types = c("gene", "mRNA", "transcript", "ncRNA"),
                              subfeature_types = c("exon", "CDS", "five_prime_UTR", "three_prime_UTR", "UTR"),
                              padding = 500) {

  if (nrow(data) == 0) {
    return(list(
      genes = data.frame(),
      subfeatures = data.frame()
    ))
  }

  # Identify top-level features (genes/transcripts)
  # These are features with no parent, or whose type is in top_level_types
  is_top_level <- is.na(data$parent_id) | data$type %in% top_level_types

  # For features with parents, check if parent exists in data
  # If parent doesn't exist, treat as top-level
  parent_ids <- unique(data$parent_id[!is.na(data$parent_id)])
  existing_parents <- parent_ids[parent_ids %in% data$feature_id]

  # Features whose parent doesn't exist in data should be top-level
  has_missing_parent <- !is.na(data$parent_id) & !(data$parent_id %in% data$feature_id)
  is_top_level <- is_top_level | has_missing_parent

  # Also treat mRNA/transcript as top-level for display purposes
  is_top_level <- is_top_level | data$type %in% c("mRNA", "transcript")

  # Get top-level features
  top_level <- data[is_top_level, , drop = FALSE]

  # Remove duplicates (same gene might appear multiple times)
  if (nrow(top_level) > 0) {
    # Prefer mRNA/transcript over gene for the same region
    top_level <- top_level[order(top_level$type != "gene"), , drop = FALSE]
    # Keep unique by feature_id
    top_level <- top_level[!duplicated(top_level$feature_id), , drop = FALSE]
  }

  # Compute layout for top-level features
  if (nrow(top_level) > 0) {
    top_level <- compute_layout(top_level, padding = padding)
  }

  # Get subfeatures
  subfeatures <- data[data$type %in% subfeature_types, , drop = FALSE]

  # Link subfeatures to their parent's layout row
  if (nrow(subfeatures) > 0 && nrow(top_level) > 0) {
    # Create lookup for parent layout rows
    parent_rows <- stats::setNames(top_level$layout_row, top_level$feature_id)

    # Assign layout rows to subfeatures based on parent
    subfeatures$layout_row <- sapply(subfeatures$parent_id, function(pid) {
      if (is.na(pid)) return(NA_integer_)
      # Try direct parent
      if (pid %in% names(parent_rows)) return(parent_rows[[pid]])
      # Parent might be grandparent relationship - find any ancestor
      NA_integer_
    })

    # For subfeatures without assigned row, try to find their transcript parent
    unassigned <- is.na(subfeatures$layout_row)
    if (any(unassigned)) {
      # Look up parent chain
      for (i in which(unassigned)) {
        pid <- subfeatures$parent_id[i]
        # Find the parent feature
        parent_feat <- data[data$feature_id == pid, , drop = FALSE]
        if (nrow(parent_feat) > 0 && !is.na(parent_feat$parent_id[1])) {
          grandparent_id <- parent_feat$parent_id[1]
          if (grandparent_id %in% names(parent_rows)) {
            subfeatures$layout_row[i] <- parent_rows[[grandparent_id]]
          }
        }
        # If still not found, check if parent itself has a layout row
        if (is.na(subfeatures$layout_row[i]) && pid %in% top_level$feature_id) {
          subfeatures$layout_row[i] <- top_level$layout_row[top_level$feature_id == pid][1]
        }
      }
    }
  }

  list(
    genes = top_level,
    subfeatures = subfeatures
  )
}
