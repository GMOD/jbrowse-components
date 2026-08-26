# Convert an hclust tree into geom_segment rows (rectangular elbows) for a
# left-hand dendrogram panel. x = merge height (0 at leaves), y = leaf position
# in hc$order, so the leaves line up 1:1 with a sample-by-site matrix whose rows
# are ordered by the same hclust. Hand-rolled from hc$merge/height (base stats,
# no ggdendro dependency), same spirit as the inline gene_layout helper.
dendro_segments <- function(hc) {
  merge <- hc$merge; height <- hc$height
  n <- nrow(merge) + 1
  leaf_y <- integer(n); leaf_y[hc$order] <- seq_len(n)
  node_x <- numeric(nrow(merge)); node_y <- numeric(nrow(merge))
  loc <- function(e) if (e < 0) c(0, leaf_y[-e]) else c(node_x[e], node_y[e])
  segs <- vector("list", nrow(merge))
  for (k in seq_len(nrow(merge))) {
    l <- loc(merge[k, 1]); r <- loc(merge[k, 2]); h <- height[k]
    node_x[k] <- h; node_y[k] <- (l[2] + r[2]) / 2
    segs[[k]] <- data.frame(
      x = c(l[1], r[1], h), y = c(l[2], r[2], l[2]),
      xend = c(h, h, h), yend = c(l[2], r[2], r[2]))
  }
  do.call(rbind, segs)
}
