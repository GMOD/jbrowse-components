# Read each region with read(chrom, start, end), a ggjbrowse result, and bind
# the results into one on the cumulative axis region_layout() defines, which
# the result's geoms draw end to end. A table's start, end and position move
# by their region's offset and each row gains '.region'; a span is cut to its
# region and a mark outside it dropped, so nothing draws over the gap into the
# next region. A read, feature, subfeature or variant number indexes the
# bound table, and a line's run stays its own. A key lists each entry once,
# the score domain spans every region's, and the region is the whole axis.
jbrowse_regions <- function(regions, read) {
  parts <- lapply(seq_len(nrow(regions)), function(i)
    read(regions$chrom[i], regions$start[i], regions$end[i]))
  if (length(parts) == 1) return(parts[[1]])
  indexes <- c(read = "reads", feature = "features",
    subfeature = "subfeatures", variant = "variants")
  listing <- c("legend", "arc_legend", "sections", "sources", "rows", "rules")
  counts <- setNames(numeric(length(indexes) + 1), c(indexes, "run"))
  for (i in seq_along(parts)) {
    lo <- regions$start[i]; hi <- regions$end[i]
    shift <- regions$offset[i] - lo
    x <- parts[[i]]
    for (name in setdiff(names(x), listing)) {
      d <- x[[name]]
      if (!is.data.frame(d)) next
      if (!is.null(d$start)) {
        d <- d[d$end > lo & d$start < hi, , drop = FALSE]
        d$start <- pmax(d$start, lo) + shift
        d$end <- pmin(d$end, hi) + shift
      }
      if (!is.null(d$position)) {
        d <- d[d$position >= lo & d$position < hi, , drop = FALSE]
        d$position <- d$position + shift
      }
      for (column in intersect(names(indexes), names(d))) {
        d[[column]] <- d[[column]] + counts[[indexes[[column]]]]
      }
      if (!is.null(d$run)) d$run <- d$run + counts[["run"]]
      d$.region <- rep(i, nrow(d))
      x[[name]] <- d
    }
    for (table in intersect(indexes, names(x))) {
      counts[[table]] <- counts[[table]] + nrow(parts[[i]][[table]])
    }
    counts[["run"]] <- counts[["run"]] + max(c(0, parts[[i]]$marks$run))
    parts[[i]] <- x
  }
  bound <- function(pick) {
    first <- pick(parts[[1]])
    d <- do.call(rbind, lapply(parts, pick))
    rownames(d) <- NULL
    for (a in setdiff(names(attributes(first)), c("names", "row.names", "class")))
      attr(d, a) <- attr(first, a)
    d
  }
  out <- parts[[1]]
  for (name in names(out)) {
    if (is.data.frame(out[[name]]) && !name %in% listing[-(1:2)]) {
      out[[name]] <- bound(function(x) x[[name]])
      if (name %in% listing) out[[name]] <- unique(out[[name]])
    }
  }
  for (key in names(out$keys)) {
    out$keys[[key]] <- unique(bound(function(x) x$keys[[key]]))
  }
  if (!is.null(out$domain)) out$domain <- range(lapply(parts, `[[`, "domain"))
  if (!is.null(out$height)) out$height <- max(sapply(parts, `[[`, "height"))
  out$region <- list(chrom = "", start = min(regions$cum_start),
    end = max(regions$cum_end))
  out
}
