# rbind the frames a split produced, or a frame with 'columns' and no rows where
# it produced none: do.call(rbind, list()) is NULL, and a NULL frame fails every
# step and layer after it, where an empty window is a state the browser draws
# as an empty panel.
bind_groups <- function(parts, columns) {
  out <- do.call(rbind, parts)
  if (is.null(out)) {
    out <- data.frame(setNames(rep(list(logical(0)), length(columns)), columns),
                      check.names = FALSE)
  }
  out
}
