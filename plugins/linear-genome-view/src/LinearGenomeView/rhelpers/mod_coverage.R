# JBrowse's coverage-band modification counts: at each column, what share of the
# depth bar each modification type takes. Mirrors computeModificationCoverage,
# which is IGV's BaseModificationCoverageRenderer:
#
#   height = (modifiable / depth) * (calls / detectable)
#
# 'modifiable' is the reads that even carry the base the mod sits on - a 5mC sits
# on a C, and the same cytosine read from the other strand is a G, so both count.
# 'detectable' narrows that to the reads actually examined: for a simplex mod
# (see mod_simplex_types) that is the base on forward reads plus its complement on
# reverse reads, and dividing by the full 'modifiable' there would halve every
# bar. Duplex mods have detectable == modifiable, collapsing the height to
# calls/depth. The height is a read COUNT - each qualifying read weighs 1
# regardless of how confident its call was; likelihood feeds only the alpha.
#
# 'mods' is bam_modifications' frame, already threshold-filtered, so a call below
# min_prob is simply absent - the same way JBrowse's extraction drops it before
# the coverage pass ever sees it. 'counts' is read_base_counts, 'cov' is
# bam_coverage. Types stack bottom-up in JBrowse's fixed rank order so a column's
# segments can't swap between draws, and each bin carries the mean call
# likelihood for the panel to bake into the segment's alpha.
#
# Returns data.frame(pos, modtype, ybase, ytop, prob, depth), where ybase/ytop are
# fractions of that column's own depth bar. Empty frame when nothing is drawable.
mod_coverage <- function(mods, counts, cov, simplex = character(0)) {
  empty <- data.frame(pos = integer(0), modtype = character(0), ybase = numeric(0),
                      ytop = numeric(0), prob = numeric(0), depth = numeric(0),
                      stringsAsFactors = FALSE)
  if (is.null(mods) || !nrow(mods) || is.null(counts) || !nrow(counts)) return(empty)
  # one bin per (column, type): how many reads called it, and how confidently
  n <- aggregate(prob ~ refpos + modtype + base, data = mods, FUN = length)
  names(n)[names(n) == "prob"] <- "calls"
  m <- aggregate(prob ~ refpos + modtype + base, data = mods, FUN = mean)
  bins <- merge(n, m, by = c("refpos", "modtype", "base"))
  bins$depth <- cov$depth[match(bins$refpos, cov$pos)]
  bins <- bins[!is.na(bins$depth) & bins$depth > 0, , drop = FALSE]
  if (!nrow(bins)) return(empty)
  key <- paste(counts$pos, counts$base)
  at <- function(pos, base, col) {
    v <- counts[[col]][match(paste(pos, base), key)]; v[is.na(v)] <- 0L; v
  }
  compl <- c(A = "T", T = "A", C = "G", G = "C", U = "A", N = "N")
  b <- toupper(bins$base); cb <- unname(compl[b]); cb[is.na(cb)] <- "N"
  bf <- at(bins$refpos, b, "fwd"); br <- at(bins$refpos, b, "rev")
  cf <- at(bins$refpos, cb, "fwd"); cr <- at(bins$refpos, cb, "rev")
  modifiable <- bf + br + cf + cr
  detectable <- ifelse(bins$modtype %in% simplex, bf + cr, modifiable)
  # base "N" means the mod can sit on any read, so both counts are the column's
  # whole read-base total
  isN <- b == "N"
  if (any(isN)) {
    tot <- tapply(counts$fwd + counts$rev, counts$pos, sum)
    tv <- as.numeric(tot[as.character(bins$refpos)]); tv[is.na(tv)] <- 0
    modifiable[isN] <- tv[isN]; detectable[isN] <- tv[isN]
  }
  h <- ifelse(detectable == 0, 0, (modifiable / bins$depth) * (bins$calls / detectable))
  # fixed stack order (JBrowse's MOD_TYPE_RANK, from IGV's modificationRankOrder),
  # with the type name breaking ties so numeric ChEBI codes - which all share the
  # fallback rank - are ordered too
  type_rank <- c(m = 0, h = 1, f = 2, c = 3, C = 4, g = 5, e = 6, b = 7, a = 8, o = 9)
  r <- unname(type_rank[bins$modtype]); r[is.na(r)] <- 99
  o <- order(bins$refpos, r, bins$modtype)
  bins <- bins[o, , drop = FALSE]; h <- h[o]
  drawn <- h > 0
  bins <- bins[drawn, , drop = FALSE]; h <- h[drawn]
  if (!nrow(bins)) return(empty)
  ytop <- ave(h, bins$refpos, FUN = cumsum)
  data.frame(pos = bins$refpos, modtype = bins$modtype, ybase = ytop - h,
             ytop = ytop, prob = bins$prob, depth = bins$depth,
             stringsAsFactors = FALSE)
}
