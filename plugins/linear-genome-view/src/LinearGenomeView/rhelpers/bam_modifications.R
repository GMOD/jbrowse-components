# Per-base modifications from the MM/ML tags (modBAM) - the signal JBrowse's
# 'modifications' coloring shows, parsed reference-free from the tags (no
# reference FASTA). For each MM group (e.g. "C+m" 5mC, "A+a" 6mA) walks the
# comma-separated skip counts over the read's target bases to recover each
# modified base, reads its ML probability (0..255 -> 0..1), and CIGAR-maps the
# read position to the reference. Faithful to JBrowse's getModPositions:
# reverse-strand reads complement the target base and count from the read 5' end;
# combined codes like "C+mh" interleave ML per position. ML is a B:C array tag
# that breaks readGAlignments' DataFrame, so this reads via scanBam (whose read
# order matches read_bam's readGAlignments, so read_index joins to pileup rows).
# Returns data.frame(read_index, refpos [0-based], modtype, prob, strand, base,
# nomod) - 'base' is the MM group's target base as written in the tag (never
# complemented, like getModPositions), which is what mod_coverage's
# modifiable/detectable denominator keys off, and 'nomod' marks a call drawn in
# the unmodified color rather than the modification's own.
#
# Three modes, matching the three JBrowse draws from one MM tag:
#
# - default: every call at or above min_prob, in its modification's color.
# - two_color: EVERY call, the ones under even odds flipped into the unmodified
#   color at their unmodified confidence (1 - prob). min_prob is not applied,
#   which is JBrowse's rule too - a low-probability call is information about the
#   base being unmodified, not an absent call.
# - fill_unmarked: the methylation view. Only 'm'/'h' calls on a cytosine in
#   'context' count, every OTHER context cytosine the read covers is filled in as
#   an implicit unmodified call (getMethBins), and each cytosine then draws the
#   single most-likely of 5mC / 5hmC / unmodified. A read whose MM group carries
#   the '?' flag is not filled: per SAMtags '?' means the status of bases the tag
#   skips is unknown, where '.' (or no flag) means low-probability.
#
# The result also carries an "mm_strands" attribute: the "<sign><type>" pairs of
# every MM group seen, INCLUDING groups whose calls all fell below min_prob, so
# mod_simplex_types can tell simplex from duplex over the whole read set. It is
# an attribute rather than a column because it must survive the threshold filter;
# read it off the returned frame directly, since any row subset drops it.
# The path goes to scanBam as a bare string, not through BamFile(): BamFile()
# resolves the index by looking for a sibling file, which finds nothing over
# http and leaves index = NA, so every remote modBAM - the usual way a JBrowse
# track names one - died on "valid 'index' file required" while every other
# helper here read the same url fine.
bam_modifications <- function(uri, chrom, start, end, min_prob = 0.1,
                              fill_unmarked = FALSE, two_color = FALSE,
                              context = "CG") {
  b <- scanBam(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)),
    what = c("strand", "pos", "cigar", "seq"),
    tag = c("MM", "ML", "Mm", "Ml")))[[1]]
  mm_all <- if (!is.null(b$tag$MM)) b$tag$MM else b$tag$Mm
  ml_all <- if (!is.null(b$tag$ML)) b$tag$ML else b$tag$Ml
  if (is.null(mm_all)) return(NULL)
  compl <- c(A = "T", T = "A", C = "G", G = "C", U = "A", N = "N")
  seqs <- as.character(b$seq); strands <- as.character(b$strand)
  out <- list(); seen <- character(0)
  for (i in seq_along(mm_all)) {
    mm <- mm_all[i]; if (is.na(mm) || mm == "") next
    ml <- if (is.null(ml_all)) integer(0) else as.integer(ml_all[[i]])
    isrev <- strands[i] == "-"
    s <- strsplit(seqs[i], "", fixed = TRUE)[[1]]; n <- length(s)
    # CIGAR read(1-based)->ref(1-based) column map, reference-forward orientation
    ops <- regmatches(b$cigar[i], gregexpr("[0-9]+[MIDNSHP=X]", b$cigar[i]))[[1]]
    oplen <- as.integer(sub("[MIDNSHP=X]$", "", ops)); opchr <- sub("^[0-9]+", "", ops)
    ref2 <- rep(NA_integer_, n); rp <- b$pos[i]; qp <- 1L
    for (k in seq_along(ops)) {
      op <- opchr[k]; L <- oplen[k]
      if (op %in% c("M", "=", "X")) {
        ref2[qp:(qp + L - 1L)] <- rp:(rp + L - 1L); rp <- rp + L; qp <- qp + L
      } else if (op %in% c("I", "S")) { qp <- qp + L
      } else if (op %in% c("D", "N")) { rp <- rp + L }
    }
    # the read's reference span, which bounds the fill bins the same way
    # getMethBins is bounded by the feature's own length
    flen <- rp - b$pos[i]
    mbins <- if (fill_unmarked) rep(NA_real_, flen) else NULL
    hbins <- mbins
    has_meth <- FALSE; unknown_skip <- FALSE; fill_fwd <- FALSE; fill_rev <- FALSE
    # Outside the fill, JBrowse paints ONE call per reference column: the most
    # likely over every MM group on the read, an earlier group holding a tie
    # (forEachMaxProbMod). A tick per type instead double-draws a combined code
    # like "C+mh" at every cytosine it calls - 30174 marks against the browser's
    # 25154 on test_data/arabidopsis_methylation - and the coverage panel's
    # stacked bars carry the surplus with them.
    bprob <- if (fill_unmarked) NULL else rep(NA_real_, flen)
    btype <- if (fill_unmarked) NULL else rep(NA_character_, flen)
    bbase <- btype
    mlbase <- 0L
    for (g in strsplit(mm, ";", fixed = TRUE)[[1]]) {
      if (g == "") next
      f <- strsplit(g, ",", fixed = TRUE)[[1]]
      h <- regmatches(f[1], regexec("([ACGTUN])([-+])([a-z]+|[A-Z]|[0-9]+)([.?]?)", f[1]))[[1]]
      if (length(h) < 5L) next
      base <- h[2]; mmsign <- h[3]; typestr <- h[4]; skip <- h[5]
      deltas <- as.integer(f[-1]); ndelta <- length(deltas)
      if (!ndelta) next
      # combined lowercase codes (mh) are one type per char; a ChEBI number or a
      # single uppercase ambiguity code is one type (mirrors getModPositions)
      single <- utf8ToInt(substr(typestr, 1, 1))[1] < 97L || nchar(typestr) == 1L
      types <- if (single) typestr else strsplit(typestr, "", fixed = TRUE)[[1]]
      ntypes <- length(types)
      seen <- c(seen, paste0(mmsign, types))
      target <- if (isrev) compl[[base]] else base
      idx <- if (base == "N") seq_len(n) else which(s == target)
      if (isrev) idx <- rev(idx)                       # count from the read 5' end
      sel <- idx[cumsum(deltas) + seq_len(ndelta)]     # ref-forward SEQ index, MM order
      refp <- ref2[sel]
      # the strand the modified cytosine sits on, which is the read's own unless
      # the MM group reads the opposite one ("G-m")
      ctxrev <- isrev != (mmsign == "-")
      for (tj in seq_len(ntypes)) {
        probs <- (ml[mlbase + tj + (seq_len(ndelta) - 1L) * ntypes] + 0.5) / 256
        ty <- types[tj]
        if (fill_unmarked) {
          if (ty == "m") {
            has_meth <- TRUE
            if (skip == "?") unknown_skip <- TRUE
            if (ctxrev) fill_rev <- TRUE else fill_fwd <- TRUE
          }
          if (ty == "m" || ty == "h") {
            keep <- !is.na(refp) & !is.na(probs) &
              cytosine_context(s, sel, ctxrev, context)
            off <- refp[keep] - b$pos[i] + 1L
            if (ty == "m") mbins[off] <- probs[keep] else hbins[off] <- probs[keep]
          }
          next
        }
        # a short or absent ML reads as byte 0, not as a dropped call, which is
        # modProbAt's `?? 0` - the threshold below is what removes it
        probs[is.na(probs)] <- 0.5 / 256
        off <- refp - b$pos[i] + 1L
        at <- which(!is.na(off))
        if (length(at)) {
          o <- off[at]; pr <- probs[at]
          win <- is.na(bprob[o]) | pr > bprob[o]
          bprob[o[win]] <- pr[win]; btype[o[win]] <- ty; bbase[o[win]] <- base
        }
      }
      mlbase <- mlbase + ndelta * ntypes
    }
    if (!fill_unmarked) {
      hit <- which(!is.na(bprob))
      pr <- bprob[hit]
      nm <- if (two_color) pr <= 0.5 else rep(FALSE, length(pr))
      keep <- two_color | pr >= min_prob
      if (any(keep)) out[[length(out) + 1L]] <- data.frame(
        read_index = i, refpos = b$pos[i] + hit[keep] - 2L,
        modtype = btype[hit][keep], prob = ifelse(nm[keep], 1 - pr[keep], pr[keep]),
        strand = if (isrev) -1L else 1L, base = bbase[hit][keep],
        nomod = nm[keep], stringsAsFactors = FALSE)
      next
    }
    # every context cytosine the read covers that no MM call named is an implicit
    # unmodified call - but only where the tag's skip flag licenses that reading,
    # and only on the strands its 'm' groups actually assayed
    if (has_meth && !unknown_skip) {
      cols <- which(!is.na(ref2))
      okf <- if (fill_fwd) cytosine_context(s, cols, FALSE, context) else FALSE
      okr <- if (fill_rev) cytosine_context(s, cols, TRUE, context) else FALSE
      off <- ref2[cols[okf | okr]] - b$pos[i] + 1L
      off <- off[is.na(mbins[off])]
      mbins[off] <- 0
    }
    hit <- which(!is.na(mbins) | !is.na(hbins))
    if (length(hit)) {
      # 5mC and 5hmC are competing modifications of one cytosine, so with the
      # implicit unmodified call their likelihoods sum to 1 - draw the single
      # most-likely state rather than a mark per channel
      mp <- mbins[hit]; mp[is.na(mp)] <- 0
      hp <- hbins[hit]; hp[is.na(hp)] <- 0
      np <- pmax(0, 1 - mp - hp)
      ish <- hp > mp & hp > np
      ism <- !ish & mp > np
      out[[length(out) + 1L]] <- data.frame(
        read_index = i, refpos = b$pos[i] + hit - 2L,
        modtype = ifelse(ish, "h", "m"),
        prob = ifelse(ish, hp, ifelse(ism, mp, np)),
        strand = if (isrev) -1L else 1L, base = "C", nomod = !ish & !ism,
        stringsAsFactors = FALSE)
    }
  }
  if (!length(out)) return(NULL)
  res <- do.call(rbind, out)
  attr(res, "mm_strands") <- unique(seen)
  res
}
