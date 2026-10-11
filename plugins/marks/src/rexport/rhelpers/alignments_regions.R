# Read each region's alignments with reader(chrom, start, end), a
# ggjbrowse::jbrowse_alignments() result, and bind them onto the cumulative
# axis region_layout() defines, each frame with a '.region' column and the
# reads with 'read', their row number within the region, which the gaps and
# mismatches join on. The engine answers every read overlapping a region with
# its whole span, mismatches and gaps, and coverage past the region's edges:
# a mismatch or coverage outside the region is dropped, a gap outside it too,
# and where there is more than one region a read's or gap's span is clipped to
# its region as read_regions clips, so nothing draws over the gap into the
# next region. The legend is the first region's; the display keys every
# region alike.
alignments_regions <- function(regions, reader) {
  clip <- nrow(regions) > 1
  parts <- lapply(seq_len(nrow(regions)), function(i) {
    a <- reader(regions$chrom[i], regions$start[i], regions$end[i])
    lo <- regions$start[i]; hi <- regions$end[i]
    shift <- regions$offset[i] - lo
    placed <- function(d, drop = TRUE, cut = clip) {
      if (drop) d <- d[d$end > lo & d$start < hi, , drop = FALSE]
      if (cut) { d$start <- pmax(d$start, lo); d$end <- pmin(d$end, hi) }
      d$start <- d$start + shift; d$end <- d$end + shift
      d$.region <- rep(i, nrow(d))
      d
    }
    reads <- a$reads
    reads$read <- seq_len(nrow(reads))
    m <- a$mismatches[a$mismatches$position >= lo & a$mismatches$position < hi, , drop = FALSE]
    m$position <- m$position + shift
    m$.region <- rep(i, nrow(m))
    list(reads = placed(reads, drop = FALSE), gaps = placed(a$gaps),
      mismatches = m, coverage = placed(a$coverage, cut = TRUE),
      legend = a$legend)
  })
  bind <- function(name) {
    d <- do.call(rbind, lapply(parts, `[[`, name))
    rownames(d) <- NULL
    d
  }
  list(reads = bind("reads"), gaps = bind("gaps"), mismatches = bind("mismatches"),
    coverage = bind("coverage"), legend = parts[[1]]$legend)
}
