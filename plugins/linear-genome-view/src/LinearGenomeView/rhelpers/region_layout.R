# Lay a set of displayed regions out on one continuous "cumulative bp" x-axis,
# the way JBrowse concatenates several regions in a single linear view: each
# region occupies a span proportional to its bp width, with a small gap between
# them. 'regions' is a data.frame(chrom, start, end) (0-based half-open); this
# adds offset (the region's left edge on the cumulative axis), width, gap, and
# cum_start/cum_end. The first region is anchored at its own genomic start, so a
# lone region keeps native genomic coordinates (a single-region figure is
# unchanged). cum_pos for a position p in region i is offset[i] + (p - start[i]).
region_layout <- function(regions, gap_frac = 0.012) {
  w <- regions$end - regions$start
  gap <- max(1, round(sum(w) * gap_frac))
  regions$offset <- regions$start[1] + head(cumsum(c(0, w + gap)), length(w))
  regions$width <- w; regions$gap <- gap
  regions$cum_start <- regions$offset; regions$cum_end <- regions$offset + w
  regions
}
