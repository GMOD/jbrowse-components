# Read the BigBed records in a region into read_bed()'s data.frame(start, end,
# strand, name, score, thick_start, thick_end, block_starts, block_sizes,
# item_rgb), plus
# one column per name in 'fields', the file's autoSql columns the display
# reads, numeric where every value parses as a number. 'score_column' names
# the column the adapter reads score from. A contig the file lacks reads as no
# records, as the browser draws it.
#
# rtracklayer's BigBed reader fails on any list column, which every BED12
# bigBed has, so this walks the file itself: the chromosome B+ tree to the
# contig's id, the R-tree to the data blocks that overlap, then the
# zlib-compressed records. A URL is read in HTTP ranges.
read_bigbed <- function(uri, chrom, start, end, fields = character(0), score_column = NULL) {
  whole <- NULL
  fetch <- if (grepl("^[a-z]+://", uri)) function(off, n) {
    if (is.null(whole)) {
      h <- curl::new_handle(range = sprintf("%.0f-%.0f", off, off + n - 1))
      r <- curl::curl_fetch_memory(uri, handle = h)
      if (r$status_code == 206) return(r$content)
      # A server that ignores the range sends the whole file once.
      whole <<- r$content
    }
    whole[seq.int(off + 1, min(length(whole), off + n))]
  } else function(off, n) {
    con <- file(uri, "rb"); on.exit(close(con))
    seek(con, off); readBin(con, "raw", n)
  }
  en <- "little"
  u32 <- function(b, p) {
    v <- readBin(b[p:(p + 3)], "integer", 1, 4, endian = en)
    if (v < 0) v + 2^32 else v
  }
  u16 <- function(b, p) readBin(b[p:(p + 1)], "integer", 1, 2, signed = FALSE, endian = en)
  u64 <- function(b, p) if (en == "little") u32(b, p) + u32(b, p + 4) * 2^32 else
    u32(b, p) * 2^32 + u32(b, p + 4)

  h <- fetch(0, 64)
  if (u32(h, 1) != 0x8789F2EB) en <- "big"
  if (u32(h, 1) != 0x8789F2EB) stop(uri, " is not a BigBed file")
  chrom_tree <- u64(h, 9); index <- u64(h, 25)
  defined <- u16(h, 35); sql_at <- u64(h, 37); compressed <- u32(h, 53) > 0

  sql <- fetch(sql_at, 65536)
  sql <- rawToChar(sql[seq_len(match(as.raw(0), sql, length(sql) + 1) - 1)])
  names <- regmatches(sql, gregexpr("[A-Za-z_][A-Za-z0-9_]*(?=\\s*;)", sql, perl = TRUE))[[1]]

  # The B+ tree's keys are the names null-padded to keySize and sorted bytewise.
  t <- fetch(chrom_tree, 32)
  block <- u32(t, 5); key_size <- u32(t, 9)
  target <- charToRaw(chrom)
  cid <- if (length(target) > key_size) NA else {
    target <- c(target, raw(key_size - length(target)))
    le <- function(a) { d <- which(a != target)[1]; is.na(d) || a[d] < target[d] }
    node <- chrom_tree + 32; found <- NA
    repeat {
      b <- fetch(node, 4 + block * (key_size + 8))
      n <- u16(b, 3); at <- 4 + (seq_len(n) - 1) * (key_size + 8)
      keys <- lapply(at, function(p) b[p + seq_len(key_size)])
      if (b[1] == 1) {
        hit <- which(vapply(keys, function(k) all(k == target), TRUE))
        if (length(hit)) found <- u32(b, at[hit[1]] + key_size + 1)
        break
      }
      below <- which(vapply(keys, le, TRUE))
      if (!length(below)) break
      node <- u64(b, at[max(below)] + key_size + 1)
    }
    found
  }

  # Overlap compares (chromIx, base) pairs, since a leaf can span contigs.
  index_block <- u32(fetch(index, 48), 5)
  blocks <- list()
  walk <- function(node) {
    b <- fetch(node, 4 + index_block * 32)
    leaf <- b[1] == 1; n <- u16(b, 3); size <- if (leaf) 32 else 24
    for (i in seq_len(n)) {
      p <- 5 + (i - 1) * size
      sc <- u32(b, p); sb <- u32(b, p + 4); ec <- u32(b, p + 8); eb <- u32(b, p + 12)
      if ((sc < cid || (sc == cid && sb < end)) && (ec > cid || (ec == cid && eb > start))) {
        if (leaf) blocks[[length(blocks) + 1]] <<- c(u64(b, p + 16), u64(b, p + 24))
        else walk(u64(b, p + 16))
      }
    }
  }
  if (!is.na(cid)) walk(index + 48)

  rows <- list()
  for (bl in blocks) {
    b <- fetch(bl[1], bl[2])
    if (compressed) b <- memDecompress(b, "gzip")
    nul <- which(b == as.raw(0)); p <- 1
    while (p + 12 <= length(b)) {
      z <- nul[findInterval(p + 11, nul) + 1]
      if (is.na(z)) break
      if (u32(b, p) == cid) {
        s <- u32(b, p + 4); e <- u32(b, p + 8)
        if (s < end && e > start) rows[[length(rows) + 1]] <-
          list(s, e, if (z > p + 12) rawToChar(b[(p + 12):(z - 1)]) else "")
      }
      p <- z + 1
    }
  }

  rest <- lapply(rows, function(r) strsplit(r[[3]], "\t", fixed = TRUE)[[1]])
  col <- function(i) vapply(rest, function(r) if (length(r) >= i) r[[i]] else NA_character_, "")
  bed <- function(i, f) if (defined >= i + 3) f(col(i)) else f(rep(NA_character_, length(rows)))
  num <- function(v) suppressWarnings(as.numeric(v))
  list_col <- function(v) sub(",$", "", v)
  rgb_col <- function(v) {
    t <- regmatches(v, regexec("^\\s*(\\d+),(\\d+),(\\d+)\\s*$", v))
    vapply(t, function(m) if (length(m) == 4 && all(as.integer(m[2:4]) <= 255) &&
      any(as.integer(m[2:4]) > 0)) grDevices::rgb(as.integer(m[2]), as.integer(m[3]),
      as.integer(m[4]), maxColorValue = 255) else NA_character_, "")
  }
  df <- data.frame(
    start = vapply(rows, function(r) as.integer(r[[1]]), 0L),
    end = vapply(rows, function(r) as.integer(r[[2]]), 0L),
    strand = bed(3, function(v) ifelse(v %in% "+", 1L, ifelse(v %in% "-", -1L, 0L))),
    name = bed(1, identity), score = bed(2, num),
    thick_start = bed(4, num), thick_end = bed(5, num),
    block_starts = bed(9, list_col), block_sizes = bed(8, list_col),
    item_rgb = bed(6, rgb_col),
    stringsAsFactors = FALSE)
  named <- function(f) {
    i <- match(f, names) - 3
    if (is.na(i) || i < 1) rep(NA_character_, nrow(df)) else col(i)
  }
  if (!is.null(score_column)) df$score <- num(named(score_column))
  for (f in fields) df[[f]] <- utils::type.convert(named(f), as.is = TRUE)
  df
}
