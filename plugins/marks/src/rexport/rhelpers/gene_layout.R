# One row per lane the feature glyph draws, packed into rows. A top-level
# feature whose children carry parts of their own (gene -> mRNA -> CDS) stacks
# one lane per child; any other is one lane. Rows come from
# IRanges::disjointBins over each feature plus the text under it and a space,
# which the browser reserves too, so names never collide; a row is as tall as
# its tallest feature. Text is measured as R draws it at ggplot2 'text_size',
# and 'bp_per_inch' turns that into bp. 'y' is a lane's centre in feature
# heights counting down from 0, 'bottom' its row's lower edge, and 'label' and
# 'description' are set on a feature's last lane only.
gene_layout <- function(f, bp_per_inch = 0, text_size = 3, labels = f$name,
                        descriptions = rep(NA_character_, nrow(f)),
                        pitch = 1.2, line_h = 1.2, gap = 0.5) {
  fid <- ifelse(is.na(f$id), paste0("_f", seq_len(nrow(f))), f$id)
  up <- match(f$parent, fid)
  roots <- which(is.na(f$parent))
  stacking <- intersect(up[!is.na(up) & seq_len(nrow(f)) %in% up], roots)
  lanes <- c(setdiff(roots, stacking), which(up %in% stacking))
  gene <- ifelse(lanes %in% roots, lanes, up[lanes])
  lanes <- lanes[order(gene, lanes)]
  gene <- sort(gene)
  out <- f[lanes, , drop = FALSE]
  out$id <- fid[lanes]
  out$gene <- fid[gene]
  out$lane <- ave(seq_along(lanes), gene, FUN = seq_along) - 1L
  depth <- ave(out$lane, gene, FUN = max) + 1L
  label <- labels[gene]
  desc <- descriptions[gene]
  grDevices::pdf(NULL)
  width <- function(s) ifelse(is.na(s), 0, strwidth(paste0(s, " "), units = "inches",
    cex = text_size * ggplot2::.pt / par("ps")) * bp_per_inch)
  text_bp <- pmax(width(label), width(desc))
  invisible(grDevices::dev.off())
  lines <- (!is.na(label)) + (!is.na(desc))
  h <- depth * pitch + lines * line_h + gap
  first <- out$lane == 0
  bin <- integer(nrow(out))
  bin[first] <- disjointBins(IRanges(f$start[gene][first] + 1,
    pmax(f$end[gene][first], f$start[gene][first] + text_bp[first])))
  bin <- ave(bin, gene, FUN = max)
  band <- tapply(h, bin, max)
  at <- match(bin, as.integer(names(band)))
  top <- c(0, cumsum(band))[at]
  out$y <- top + out$lane * pitch + 0.5
  last <- out$lane == depth - 1L
  out$label <- ifelse(last, label, NA_character_)
  out$description <- ifelse(last, desc, NA_character_)
  out$description_y <- out$y + 0.6 + ifelse(is.na(out$label), 0, line_h)
  out$bottom <- top + band[at]
  rownames(out) <- NULL
  out
}
