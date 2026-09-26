# The vertices of a step line through df, for geom_path(aes(.x, .y, group =
# .group)): each row's value 'y' held from 'x' to 'x2', joined to the next row
# where that one starts at this one's end, and dropped to 'origin' across a
# gap, as the browser draws a line mark. The rows of one group, one value of
# every column 'by' names, draw as one path in 'x' order. Each vertex carries
# its row's columns, so a colour mapped to one stays per span.
step_path <- function(df, x, x2, y, origin = 0, by = ".region") {
  n <- nrow(df)
  df$.group <- if (n) interaction(lapply(df[by], addNA), drop = TRUE) else factor()
  df <- df[order(df$.group, df[[x]]), , drop = FALSE]
  abuts <- if (!n) logical(0) else
    c(FALSE, df$.group[-1] == df$.group[-n] & df[[x]][-1] == df[[x2]][-n])
  k <- rep(seq_len(n), each = 4)
  corner <- rep(1:4, n)
  out <- df[k, , drop = FALSE]
  out$.x <- ifelse(corner <= 2, df[[x]][k], df[[x2]][k])
  out$.y <- ifelse(corner == 2 | corner == 3, df[[y]][k], origin)
  keep <- corner == 2 | corner == 3 |
    (corner == 1 & !abuts[k]) | (corner == 4 & !c(abuts[-1], FALSE)[k])
  out[keep, , drop = FALSE]
}
