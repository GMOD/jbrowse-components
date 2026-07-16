import { getConf } from '@jbrowse/core/configuration'
import { getSession, saveAs } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import { rName, rStr, safeVarName } from './rexportShared.ts'

import type { LinearGenomeViewModel } from './model.ts'
import type { ExportRCodeOptions, RTrackFragment } from './types.ts'

interface ViewRegion {
  refName: string
  start: number
  end: number
}

interface RExportDisplay {
  exportRCode: (
    opts: ExportRCodeOptions,
  ) => Promise<RTrackFragment | RTrackFragment[] | undefined>
}

function hasRExport(display: unknown): display is RExportDisplay {
  return (
    typeof display === 'object' &&
    display !== null &&
    'exportRCode' in display &&
    typeof display.exportRCode === 'function'
  )
}

/**
 * Inline, hackable helper definitions emitted into the script — only the ones a
 * track actually references. They are plain rtracklayer/ggplot2 so the user (or
 * an assistant) can read and edit them without learning a bespoke package.
 */
const HELPERS: Record<string, string> = {
  resolve_chrom: `# Translate a canonical chromosome name to the one a particular track's file
# uses. JBrowse resolves refname aliases (chr1 vs 1 vs NC_000001.11) per file;
# 'aliases' is a named vector canonical -> file name for one track. A name not
# in it passes through unchanged, so the same plot_region() call reads correctly
# from files with different contig naming.
resolve_chrom <- function(chrom, aliases) {
  if (chrom %in% names(aliases)) aliases[[chrom]] else chrom
}`,
  read_bigwig: `# Read a BigWig region into a data.frame(seqnames, start, end, score)
read_bigwig <- function(uri, chrom, start, end) {
  as.data.frame(rtracklayer::import(uri, which = GRanges(chrom, IRanges(start + 1, end))))
}`,
  read_multibigwig: `# Read several BigWig files into one long data.frame with a 'source' column
# (a factor ordered to match 'names'), reusing read_bigwig per file.
read_multibigwig <- function(uris, names, chrom, start, end) {
  parts <- Map(function(uri, nm) {
    df <- read_bigwig(uri, chrom, start, end)
    if (nrow(df)) { df$source <- nm; df }
  }, uris, names)
  out <- do.call(rbind, parts)
  out$source <- factor(out$source, levels = unique(names))
  out
}`,
  bp_axis: `# Format an x axis of genomic coordinates as bp / kb / Mb
bp_axis <- function() {
  scale_x_continuous(
    labels = scales::label_number(scale_cut = scales::cut_si("b")),
    expand = expansion(mult = 0.01)
  )
}`,
  cram_to_bam: `# Rsamtools/GenomicAlignments is a BAM-only reader and cannot open CRAM, so
# decode the queried region to a temporary indexed BAM with samtools (the
# standard CRAM tool) and hand that back for the bam_* helpers to read. samtools
# restores the MD tag from the reference while decoding, so the reference-free
# bam_mismatches walk still works. 'ref' is the reference FASTA; when NULL/empty
# samtools resolves the reference from the CRAM's own UR header or a
# REF_PATH/REF_CACHE cache. A plain (non-.cram) path is returned unchanged, so
# the same script works for BAM and CRAM tracks. Requires samtools on PATH.
cram_to_bam <- function(uri, chrom, start, end, ref = NULL) {
  if (!grepl("\\\\.cram$", uri, ignore.case = TRUE)) return(uri)
  out <- tempfile(fileext = ".bam")
  region <- sprintf("%s:%d-%d", chrom, start + 1, end)
  args <- c("view", "-b", "-o", out,
            if (!is.null(ref) && nzchar(ref)) c("-T", ref), uri, region)
  if (system2("samtools", args) != 0) stop("samtools failed to decode CRAM: ", uri)
  Rsamtools::indexBam(out)
  out
}`,
  read_bam: `# Read alignments in a region as a data.frame(name, start, end, strand, mapq,
# isize, flag, orientation, mate_unmapped, interchrom), with reference-based
# (CIGAR-aware) coordinates. isize is |TLEN| (0 for unpaired) so a
# color-by-insert-size panel works without a reference; orientation / mate_unmapped
# / interchrom drive the pair-orientation coloring (see pair_orientation); name is
# QNAME, so mates + supplementary segments can be grouped into chains (link_reads).
read_bam <- function(uri, chrom, start, end) {
  ga <- readGAlignments(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)),
    what = c("qname", "flag", "mapq", "isize", "mrnm", "mpos")))
  flag <- mcols(ga)$flag
  mate_chrom <- as.character(mcols(ga)$mrnm)
  data.frame(name = mcols(ga)$qname, start = start(ga) - 1L, end = end(ga),
             strand = as.character(strand(ga)), mapq = mcols(ga)$mapq,
             isize = abs(mcols(ga)$isize), flag = flag,
             orientation = pair_orientation(flag, start(ga), mcols(ga)$mpos),
             mate_unmapped = bitwAnd(flag, 0x8L) != 0,
             # "=" is RNEXT shorthand for the read's own chromosome
             interchrom = !is.na(mate_chrom) & mate_chrom != chrom & mate_chrom != "=",
             stringsAsFactors = FALSE)
}`,
  pair_orientation: `# Classify a read pair's orientation into the IGV FR-library categories
# (LR normal / RL / RR / LL), reproducing JBrowse's getPairOrientation +
# pairDirection. Vectorized over a BAM's flag / position columns. The leftmost
# mate (self_left) is chosen consistently from either read - by position within a
# chromosome, read1-first when positions tie or the mate position is unknown - so
# the two mates of one pair always agree. Returns NA for unpaired reads or
# orientations outside the FR set. self_pos/mate_pos are 1-based leftmost coords.
pair_orientation <- function(flag, self_pos, mate_pos) {
  is_paired <- bitwAnd(flag, 0x1L) != 0
  is_read1  <- bitwAnd(flag, 0x40L) != 0
  self_str  <- ifelse(bitwAnd(flag, 0x10L) != 0, "R", "F")
  mate_str  <- ifelse(bitwAnd(flag, 0x20L) != 0, "R", "F")
  self_num  <- ifelse(is_read1, "1", "2")
  mate_num  <- ifelse(is_read1, "2", "1")
  known     <- !is.na(mate_pos) & mate_pos > 0
  self_left <- ifelse(!known | self_pos == mate_pos, is_read1, self_pos < mate_pos)
  o <- ifelse(self_left,
    paste0(self_str, self_num, mate_str, mate_num),
    paste0(mate_str, mate_num, self_str, self_num))
  fr <- c(F1R2 = "LR", F2R1 = "LR", R1F2 = "RL", R2F1 = "RL",
          R1R2 = "RR", R2R1 = "RR", F1F2 = "LL", F2F1 = "LL")
  ifelse(is_paired, unname(fr[o]), NA_character_)
}`,
  bam_mismatches: `# Per-read mismatches from the MD tag - reference-free, exactly how JBrowse
# derives SNP ticks when MD is present (no reference FASTA needed). Walks the
# CIGAR to pair each aligned (M/=/X) reference column with its read-sequence
# position, then walks the MD tag over those columns: a number skips matches, a
# letter marks a mismatch (whose read base is read from SEQ), ^SEQ marks a
# deleted stretch. 'read_index' indexes reads in the same order read_bam returns
# them (same region, same readGAlignments order), so a mismatch tick joins back
# to its pileup row via reads$row[mm$read_index]. refpos is 0-based.
bam_mismatches <- function(uri, chrom, start, end) {
  ga <- readGAlignments(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)), what = "seq", tag = "MD"))
  md <- as.character(mcols(ga)$MD)
  seqs <- as.character(mcols(ga)$seq)
  cig <- cigar(ga); refstart <- start(ga)
  out <- vector("list", length(ga))
  for (i in seq_along(ga)) {
    if (is.na(md[i]) || !grepl("[ACGTNacgtn]", md[i])) next
    ops <- regmatches(cig[i], gregexpr("[0-9]+[MIDNSHP=X]", cig[i]))[[1]]
    oplen <- as.integer(sub("[MIDNSHP=X]$", "", ops))
    opchr <- sub("^[0-9]+", "", ops)
    rp <- refstart[i]; qp <- 1L; ref_cols <- integer(0); read_cols <- integer(0)
    for (k in seq_along(ops)) {
      L <- oplen[k]; op <- opchr[k]
      if (op %in% c("M", "=", "X")) {
        ref_cols <- c(ref_cols, rp:(rp + L - 1L))
        read_cols <- c(read_cols, qp:(qp + L - 1L)); rp <- rp + L; qp <- qp + L
      } else if (op %in% c("I", "S")) { qp <- qp + L
      } else if (op %in% c("D", "N")) { rp <- rp + L }
    }
    toks <- regmatches(md[i], gregexpr("[0-9]+|\\\\^[A-Za-z]+|[A-Za-z]", md[i]))[[1]]
    mi <- 0L; pos <- integer(0); base <- character(0)
    for (t in toks) {
      if (grepl("^[0-9]+$", t)) { mi <- mi + as.integer(t)
      } else if (!startsWith(t, "^")) {
        mi <- mi + 1L; pos <- c(pos, ref_cols[mi])
        base <- c(base, substr(seqs[i], read_cols[mi], read_cols[mi]))
      }
    }
    if (length(pos)) out[[i]] <- data.frame(read_index = i, refpos = pos - 1L, base = base)
  }
  do.call(rbind, out)
}`,
  bam_clips: `# Soft/hard clips at each read's ends, from the first/last CIGAR op (S = soft,
# H = hard). Returns data.frame(read_index, pos, type, length): 'pos' is the
# 0-based reference position of the clip - a read's aligned start for a leading
# clip, its aligned end for a trailing clip - marking where the read carries
# unaligned sequence (a breakpoint signal, the same clip indicators JBrowse
# draws). 'read_index' matches read_bam order (same region, same readGAlignments
# order) so a clip bar joins its pileup row via reads$row[clips$read_index].
bam_clips <- function(uri, chrom, start, end) {
  ga <- readGAlignments(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end))))
  cig <- cigar(ga); rs <- start(ga) - 1L; re <- end(ga)
  out <- vector("list", length(ga))
  for (i in seq_along(ga)) {
    ops <- regmatches(cig[i], gregexpr("[0-9]+[MIDNSHP=X]", cig[i]))[[1]]
    if (!length(ops)) next
    op <- sub("^[0-9]+", "", ops); len <- as.integer(sub("[MIDNSHP=X]$", "", ops))
    n <- length(ops); ends <- list()
    if (op[1] %in% c("S", "H")) ends[[1]] <- data.frame(read_index = i, pos = rs[i], type = op[1], length = len[1])
    if (op[n] %in% c("S", "H")) ends[[2]] <- data.frame(read_index = i, pos = re[i], type = op[n], length = len[n])
    out[[i]] <- do.call(rbind, ends)
  }
  do.call(rbind, out)
}`,
  clip_colors: `# JBrowse's clip indicator colors: soft clip blue, hard clip red. Used with
# scale_color_identity (a separate aesthetic from the read/mismatch fill scale).
clip_colors <- c(S = "#0000ff", H = "#ff0000")`,
  bam_indels: `# CIGAR indels/gaps that break a read's aligned span - reference-consuming ops
# that read_bam's start..end coordinates silently swallow (a read spanning a
# deletion or intron looks like continuous sequence otherwise). Walks each read's
# CIGAR: D = deletion, N = skip (spliced intron), I = insertion (does not consume
# reference, so it sits at a single column). Returns data.frame(read_index,
# refpos [0-based reference start of the op], length, type in {D,N,I}); refpos for
# an insertion is the reference column it is anchored before. read_index matches
# read_bam order (same region, same readGAlignments order) so a marker joins its
# pileup row via reads$row[indels$read_index].
bam_indels <- function(uri, chrom, start, end) {
  ga <- readGAlignments(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end))))
  cig <- cigar(ga); refstart <- start(ga)
  out <- vector("list", length(ga))
  for (i in seq_along(ga)) {
    ops <- regmatches(cig[i], gregexpr("[0-9]+[MIDNSHP=X]", cig[i]))[[1]]
    if (!length(ops)) next
    oplen <- as.integer(sub("[MIDNSHP=X]$", "", ops)); opchr <- sub("^[0-9]+", "", ops)
    rp <- refstart[i]; pos <- integer(0); len <- integer(0); ty <- character(0)
    for (k in seq_along(ops)) {
      L <- oplen[k]; op <- opchr[k]
      # record the indel at the current reference column (I sits between bases)
      if (op %in% c("D", "N", "I")) {
        pos <- c(pos, rp - 1L); len <- c(len, L); ty <- c(ty, op)
      }
      # reference-consuming ops advance the column (I does not)
      if (op %in% c("M", "=", "X", "D", "N")) { rp <- rp + L }
    }
    if (length(pos)) out[[i]] <- data.frame(read_index = i, refpos = pos, length = len, type = ty)
  }
  do.call(rbind, out)
}`,
  gap_colors: `# JBrowse's CIGAR-gap colors: deletion grey, skip/intron teal, insertion purple.
# A deletion paints a grey full-height rect over the read body; a spliced intron
# erases the body and leaves a thin teal connector line; an insertion is a thin
# purple tick marking sequence absent from the reference.
gap_colors <- c(D = "#808080", N = "#009a8a", I = "#800080")`,
  bam_base_quality: `# Per-base Phred quality for every reference-aligned base - the signal JBrowse's
# perBaseQuality color-by paints. Reads QUAL (stored genomic-forward in BAM, so
# no reverse-strand handling) and walks the CIGAR to map each M/=/X read base to
# its reference column (I/S consume the read only, D/N/H the reference / nothing).
# Returns data.frame(read_index, refpos [0-based], score [Phred int]); read_index
# matches read_bam order so a base joins its pileup row via reads$row[bq$read_index].
bam_base_quality <- function(uri, chrom, start, end) {
  b <- scanBam(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)),
    what = c("pos", "cigar", "qual")))[[1]]
  quals <- as(b$qual, "IntegerList")
  out <- vector("list", length(b$cigar))
  for (i in seq_along(b$cigar)) {
    q <- quals[[i]]; if (!length(q)) next
    ops <- regmatches(b$cigar[i], gregexpr("[0-9]+[MIDNSHP=X]", b$cigar[i]))[[1]]
    if (!length(ops)) next
    oplen <- as.integer(sub("[MIDNSHP=X]$", "", ops)); opchr <- sub("^[0-9]+", "", ops)
    rp <- b$pos[i] - 1L; qp <- 1L; pos <- integer(0); sc <- integer(0)
    for (k in seq_along(ops)) {
      L <- oplen[k]; op <- opchr[k]
      if (op %in% c("M", "=", "X")) {
        pos <- c(pos, rp:(rp + L - 1L)); sc <- c(sc, q[qp:(qp + L - 1L)])
        rp <- rp + L; qp <- qp + L
      } else if (op %in% c("I", "S")) { qp <- qp + L
      } else if (op %in% c("D", "N")) { rp <- rp + L }
    }
    if (length(pos)) out[[i]] <- data.frame(read_index = i, refpos = pos, score = sc)
  }
  do.call(rbind, out)
}`,
  quality_colors: `# JBrowse's per-base-quality color ramp: each Phred score maps to HSL(hue, 55%,
# 50%) with hue = score * 1.5 (red at low quality -> yellow -> green at high), a
# maxed score pinned to green hue 150. Vectorized; HSL is converted to hex inline
# because base R has no HSL constructor (hsv() is a different color space).
quality_colors <- function(scores) {
  h <- ifelse(scores >= 255, 150, scores * 1.5)
  s <- 0.55; l <- 0.5
  cc <- (1 - abs(2 * l - 1)) * s
  x <- cc * (1 - abs((h / 60) %% 2 - 1))
  m <- l - cc / 2
  r <- g <- b <- numeric(length(h))
  i <- h < 60;             r[i] <- cc;   g[i] <- x[i]
  i <- h >= 60  & h < 120; r[i] <- x[i]; g[i] <- cc
  i <- h >= 120 & h < 180; g[i] <- cc;   b[i] <- x[i]
  i <- h >= 180 & h < 240; g[i] <- x[i]; b[i] <- cc
  i <- h >= 240 & h < 300; r[i] <- x[i]; b[i] <- cc
  i <- h >= 300;           r[i] <- cc;   b[i] <- x[i]
  rgb(r + m, g + m, b + m)
}`,
  base_colors: `# JBrowse's per-base mismatch colors (green A / blue C / orange G / red T /
# brown N), used with scale_fill_identity so no legend and no second fill scale.
base_colors <- c(A = "#4caf50", C = "#2196f3", G = "#ff9800", T = "#f44336", N = "#795548")`,
  read_fill_colors: `# Per-read body fill for a color-by scheme, returned as literal hex so read
# bodies share one scale_fill_identity() with the mismatch ticks. Mirrors
# JBrowse's read color schemes: normal (grey, the default), strand (pink fwd /
# blue rev), mappingQuality (a fixed-saturation hue ramp over MAPQ, treating
# MAPQ as a hue in degrees like the GPU renderer), insertSize (pink short / red
# long / grey normal, thresholds = a robust median +/- 3*1.4826*MAD over the
# primary proper-pair |TLEN| values, matching getInsertSizeStats),
# pairOrientation (grey LR / teal RL / blue RR / green LL, with an unmapped-mate
# and an inter-chromosomal bucket that override the orientation hue like JBrowse).
read_fill_colors <- function(reads, color_by = "normal") {
  hue_ramp <- function(h) {
    hp <- (h %% 360) / 60; cc <- 0.5; mm <- 0.25
    x <- cc * (1 - abs(hp %% 2 - 1))
    r <- ifelse(hp < 1, cc, ifelse(hp < 2, x, ifelse(hp < 4, 0, ifelse(hp < 5, x, cc))))
    g <- ifelse(hp < 1, x, ifelse(hp < 3, cc, ifelse(hp < 4, x, 0)))
    b <- ifelse(hp < 2, 0, ifelse(hp < 3, x, ifelse(hp < 5, cc, x)))
    grDevices::rgb(r + mm, g + mm, b + mm)
  }
  if (color_by == "strand") {
    ifelse(reads$strand == "-", "#8F8FD8", "#EC8B8B")
  } else if (color_by == "mappingQuality") {
    hue_ramp(reads$mapq)
  } else if (color_by == "insertSize") {
    # JBrowse derives the short/long thresholds from primary proper-pair reads
    # only (SAM flag 0x2 set, 0x100/0x800 clear) with |TLEN| > 0, using a robust
    # spread: median +/- 3*1.4826*MAD, falling back to mean +/- 3*sd when MAD is 0,
    # lower bound clamped at 0. The MAD ignores the right-skewed SV tail that would
    # otherwise inflate sd and drive the lower bound negative, hiding every short
    # insert. sd is population (divide by n) to match getInsertSizeStats. A read
    # with |TLEN| == 0 (unpaired) is always "normal", never "short".
    is <- reads$isize
    proper <- bitwAnd(reads$flag, 0x2L) != 0 &
              bitwAnd(reads$flag, 0x100L) == 0 & bitwAnd(reads$flag, 0x800L) == 0
    obs <- is[proper & is > 0]
    if (length(obs)) {
      avg <- mean(obs); med <- median(obs); md <- median(abs(obs - med))
      s <- if (length(obs) > 1) sqrt(sum((obs - avg)^2) / length(obs)) else 0
      center <- if (md > 0) med else avg
      spread <- if (md > 0) 3 * 1.4826 * md else 3 * s
      upper <- center + spread; lower <- max(0, center - spread)
    } else { upper <- Inf; lower <- 0 }
    ifelse(is > upper, "#ff0000", ifelse(is > 0 & is < lower, "#ffc0cb", "#d3d3d3"))
  } else if (color_by == "pairOrientation") {
    pal <- c(LR = "#d3d3d3", RL = "#0099bb", RR = "#5555bb", LL = "#4d9a4d")
    col <- unname(pal[reads$orientation])
    col[is.na(col)] <- "#c8c8c8"                # unpaired / non-FR orientation
    col[reads$interchrom] <- "#6e4b3a"          # mate on another chromosome
    col[reads$mate_unmapped] <- "#b05a20"       # unmapped mate wins (like JBrowse)
    col
  } else {
    rep("#d3d3d3", nrow(reads))
  }
}`,
  mod_colors: `# Base-modification type colors (IGV/JBrowse palette: red 5mC 'm', magenta 5hmC
# 'h', deep-blue 6mA 'a', ...). Codes outside the table hash to a stable muted
# hue, mirroring JBrowse's randomColor fallback. Returned as literal hex so mod
# ticks share one scale_fill_identity() with the read bodies.
mod_colors <- function(types) {
  pal <- c(m = "#ff0000", h = "#ff00ff", o = "#6f4e81", f = "#f6c85f",
           c = "#9dd866", g = "#ffa056", e = "#8dddd0", b = "#00642f",
           a = "#33006f", "17082" = "#3399ff", "17596" = "#669900",
           "21839" = "#990099")
  hsl <- function(h, s, l) {
    cc <- (1 - abs(2 * l - 1)) * s; x <- cc * (1 - abs((h / 60) %% 2 - 1)); m <- l - cc / 2
    rgbv <- switch(floor(h / 60) %% 6 + 1, c(cc, x, 0), c(x, cc, 0), c(0, cc, x),
                   c(0, x, cc), c(x, 0, cc), c(cc, 0, x))
    grDevices::rgb(rgbv[1] + m, rgbv[2] + m, rgbv[3] + m)
  }
  vapply(as.character(types), function(t)
    if (!is.na(pal[t])) unname(pal[t]) else hsl((sum(utf8ToInt(t)) * 10) %% 360, 0.2, 0.5),
    character(1), USE.NAMES = FALSE)
}`,
  bam_modifications: `# Per-base modifications from the MM/ML tags (modBAM) - the signal JBrowse's
# 'modifications'/methylation coloring shows, parsed reference-free from the tags
# (no reference FASTA). For each MM group (e.g. "C+m" 5mC, "A+a" 6mA) walks the
# comma-separated skip counts over the read's target bases to recover each
# modified base, reads its ML probability (0..255 -> 0..1), and CIGAR-maps the
# read position to the reference. Faithful to JBrowse's getModPositions:
# reverse-strand reads complement the target base and count from the read 5' end;
# combined codes like "C+mh" interleave ML per position. ML is a B:C array tag
# that breaks readGAlignments' DataFrame, so this reads via scanBam (whose read
# order matches read_bam's readGAlignments, so read_index joins to pileup rows).
# Returns data.frame(read_index, refpos [0-based], modtype, prob, strand).
bam_modifications <- function(uri, chrom, start, end, min_prob = 0.1) {
  b <- scanBam(BamFile(uri), param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)),
    what = c("strand", "pos", "cigar", "seq"),
    tag = c("MM", "ML", "Mm", "Ml")))[[1]]
  mm_all <- if (!is.null(b$tag$MM)) b$tag$MM else b$tag$Mm
  ml_all <- if (!is.null(b$tag$ML)) b$tag$ML else b$tag$Ml
  if (is.null(mm_all)) return(NULL)
  compl <- c(A = "T", T = "A", C = "G", G = "C", U = "A", N = "N")
  seqs <- as.character(b$seq); strands <- as.character(b$strand); out <- list()
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
    mlbase <- 0L
    for (g in strsplit(mm, ";", fixed = TRUE)[[1]]) {
      if (g == "") next
      f <- strsplit(g, ",", fixed = TRUE)[[1]]
      h <- regmatches(f[1], regexec("([ACGTUN])([-+])([a-z]+|[A-Z]|[0-9]+)", f[1]))[[1]]
      if (length(h) < 4L) next
      base <- h[2]; typestr <- h[4]; deltas <- as.integer(f[-1]); ndelta <- length(deltas)
      if (!ndelta) next
      # combined lowercase codes (mh) are one type per char; a ChEBI number or a
      # single uppercase ambiguity code is one type (mirrors getModPositions)
      single <- utf8ToInt(substr(typestr, 1, 1))[1] < 97L || nchar(typestr) == 1L
      types <- if (single) typestr else strsplit(typestr, "", fixed = TRUE)[[1]]
      ntypes <- length(types)
      target <- if (isrev) compl[[base]] else base
      idx <- if (base == "N") seq_len(n) else which(s == target)
      if (isrev) idx <- rev(idx)                       # count from the read 5' end
      sel <- idx[cumsum(deltas) + seq_len(ndelta)]     # ref-forward SEQ index, MM order
      refp <- ref2[sel]
      for (tj in seq_len(ntypes)) {
        probs <- (ml[mlbase + tj + (seq_len(ndelta) - 1L) * ntypes] + 0.5) / 256
        keep <- !is.na(refp) & !is.na(probs) & probs >= min_prob
        if (any(keep)) out[[length(out) + 1L]] <- data.frame(
          read_index = i, refpos = refp[keep] - 1L, modtype = types[tj],
          prob = probs[keep], strand = if (isrev) -1L else 1L, stringsAsFactors = FALSE)
      }
      mlbase <- mlbase + ndelta * ntypes
    }
  }
  if (length(out)) do.call(rbind, out) else NULL
}`,
  snp_freq_threshold: `# Minimum mismatch frequency drawn in the SNP-coverage track at a given depth -
# JBrowse hides low-frequency noise by default (80% below 10x depth, easing to
# 30% at >=30x). Return 0 (via show_low_freq) to keep every mismatch.
snp_freq_threshold <- function(depth) {
  ifelse(depth < 10, 0.8, ifelse(depth >= 30, 0.3, 0.8 + (depth - 10) / 20 * (0.3 - 0.8)))
}`,
  read_filter: `# Apply JBrowse's "Filter by" to the reads: SAM flag include/exclude, an optional
# read-name match, and tag filters (all AND-ed; a value of "*" means "has the
# tag"). Marks a logical 'keep' column rather than dropping rows, so read_index
# still lines up with the mismatch/mod/clip overlays - the layout then gives a
# filtered read an NA row and ggplot drops its body and ticks. Mirrors JBrowse's
# filterReadFlag / filterTagValue. flag_exclude default 1540 = unmapped + QC-fail +
# duplicate. Tag values are read only when a tag filter is set (an extra scan).
read_filter <- function(reads, uri, chrom, start, end, flag_include = 0,
                        flag_exclude = 1540, read_name = NULL, tag_filters = list()) {
  keep <- bitwAnd(reads$flag, flag_include) == flag_include &
          bitwAnd(reads$flag, flag_exclude) == 0
  if (!is.null(read_name)) keep <- keep & !is.na(reads$name) & reads$name == read_name
  if (length(tag_filters)) {
    tags <- unique(vapply(tag_filters, function(f) f$tag, character(1)))
    tv <- mcols(readGAlignments(uri, param = ScanBamParam(
      which = GRanges(chrom, IRanges(start + 1, end)), tag = tags)))
    for (f in tag_filters) {
      val <- tv[[f$tag]]; has <- !is.na(val)
      keep <- keep & (if (identical(f$value, "*")) has else has & as.character(val) == f$value)
    }
  }
  reads$keep <- keep
  reads
}`,
  pileup_layout: `# Stack overlapping reads into rows. IRanges::disjointBins is the standard
# interval-stacking primitive - the same idea as the JBrowse pileup layout. A
# 'keep' column (from read_filter) leaves filtered reads at an NA row (undrawn).
pileup_layout <- function(reads) {
  keep <- if (is.null(reads$keep)) rep(TRUE, nrow(reads)) else reads$keep
  row <- rep(NA_integer_, nrow(reads))
  row[keep] <- disjointBins(IRanges(reads$start[keep] + 1L, reads$end[keep]))
  reads$row <- row
  reads
}`,
  sorted_pileup_layout: `# Localized sort layout - JBrowse's "Sort by..." at the center line. Reads
# overlapping sort_pos are ordered by the criterion and placed first (each on its
# own row, since they all cover sort_pos), then the remaining reads fill the gaps
# around them in genomic order (first-fit-lowest-row, like disjointBins). Mirrors
# JBrowse's computeSortedLayout. sort_type: "position" (read start, ascending),
# "strand" (forward strand first), or "base" (read char at sort_pos: a deletion
# '*' first, then the MD-tag mismatch base by ASCII A,C,G,N,T [passed in mm], and
# reference-matching reads last - JBrowse's buildSortKeyMap ordering, deletions
# spanning sort_pos detected from the CIGAR indels passed in 'indels'). A sort_pos
# of -1 (no center line) leaves every read in genomic order. Note the baked
# sort_pos is the exported locus's column - move it to re-sort elsewhere.
sorted_pileup_layout <- function(reads, sort_pos, sort_type = "position", mm = NULL, indels = NULL) {
  keep <- if (is.null(reads$keep)) rep(TRUE, nrow(reads)) else reads$keep
  ov <- which(keep & reads$start <= sort_pos & reads$end > sort_pos)
  key <- switch(sort_type,
    strand = ifelse(reads$strand[ov] == "-", 1L, 0L),
    base = {
      # JBrowse ranks the read's char at sort_pos by ASCII: '*' deletion (42),
      # then the mismatch base A(65) C(67) G(71) N(78) T(84), reference-matching
      # reads (no key) last. Inf sentinel sorts those last via order() below.
      k <- rep(Inf, length(ov))
      hit <- if (is.null(mm)) NULL else mm[mm$refpos == sort_pos, , drop = FALSE]
      if (!is.null(hit) && nrow(hit)) {
        k[match(hit$read_index, ov)] <-
          vapply(toupper(hit$base), utf8ToInt, integer(1), USE.NAMES = FALSE)
      }
      # a deletion spanning sort_pos ranks as '*' (42), but only for reads without
      # a mismatch base there (JBrowse's !baseAtPos.has(readIdx) guard)
      del <- if (is.null(indels)) NULL else indels[indels$type == "D" &
        indels$refpos <= sort_pos & indels$refpos + indels$length > sort_pos, , drop = FALSE]
      if (!is.null(del) && nrow(del)) {
        di <- match(del$read_index, ov); di <- di[!is.na(di)]
        di <- di[is.infinite(k[di])]
        k[di] <- 42
      }
      k
    },
    reads$start[ov])
  order_idx <- c(ov[order(key)], setdiff(which(keep), ov))

  # greedy first-fit-lowest-row placement in that order: each row keeps the
  # intervals placed on it so far, and a read takes the lowest row it clears.
  # Filtered reads (not in order_idx) keep an NA row and go undrawn.
  starts <- ends <- list()
  row <- rep(NA_integer_, nrow(reads))
  for (i in order_idx) {
    s <- reads$start[i]; e <- reads$end[i]
    r <- 1L
    while (r <= length(starts) && any(s < ends[[r]] & e > starts[[r]])) r <- r + 1L
    if (r > length(starts)) { starts[[r]] <- numeric(0); ends[[r]] <- numeric(0) }
    starts[[r]] <- c(starts[[r]], s); ends[[r]] <- c(ends[[r]], e)
    row[i] <- r
  }
  reads$row <- row
  reads
}`,
  link_reads: `# Chain layout (JBrowse's linkedReads = "normal"): group a region's records by
# read name (QNAME) - the two mates of a pair plus any supplementary/secondary
# segments share one name - and place each whole chain on a single row, packing
# chains by their min-start..max-end span with disjointBins (the same primitive
# pileup_layout uses on individual reads). Reads keep their original read_bam
# order (only a 'row' column is added) so mismatch/mod ticks still join by
# read_index. Also returns a 'links' data.frame of connector segments spanning the
# gap between each chain's consecutive pieces (the mate-pair gap or split-read
# junction). A record whose mate/other segment falls outside the fetched window
# simply has no connector (only the segments actually in view are linked).
link_reads <- function(reads) {
  keep <- if (is.null(reads$keep)) rep(TRUE, nrow(reads)) else reads$keep
  k <- which(keep); sub <- reads[k, ]
  nm <- ifelse(is.na(sub$name), paste0("_r", k), sub$name)
  chain_start <- tapply(sub$start, nm, min)
  chain_end   <- tapply(sub$end, nm, max)
  crow <- disjointBins(IRanges(as.integer(chain_start) + 1L, as.integer(chain_end)))
  names(crow) <- names(chain_start)
  row <- rep(NA_integer_, nrow(reads))
  row[k] <- unname(crow[nm])
  reads$row <- row
  ord <- order(nm, sub$start); s <- sub[ord, ]; g <- nm[ord]
  same <- g[-1] == g[-length(g)]
  x0 <- s$end[-nrow(s)]; x1 <- s$start[-1]; keeplink <- same & x1 > x0
  links <- data.frame(xstart = x0[keeplink], xend = x1[keeplink], row = row[k][ord][-1][keeplink])
  list(reads = reads, links = links)
}`,
  bam_coverage: `# Per-base read depth over the region. drop.D.ranges = TRUE carves deletions (D)
# out of the depth the same way JBrowse's coverage sweep does (both deletions and
# skips reduce depth) - a plain coverage(ga) counts a deleted column as covered,
# so the grey total would not dip at a deletion like the browser's does.
bam_coverage <- function(uri, chrom, start, end) {
  ga <- readGAlignments(uri, param = ScanBamParam(which = GRanges(chrom, IRanges(start + 1, end))))
  cov <- coverage(grglist(ga, drop.D.ranges = TRUE))[[chrom]]
  pos <- (start + 1):end
  data.frame(pos = pos - 1L, depth = as.numeric(cov[pos]))
}`,
  interbase_indicators: `# JBrowse's coverage-band interbase indicators: a marker above the coverage where
# insertions / soft- or hard-clips pile up at one reference column - a structural-
# variant breakpoint signal (mirrors computeInterbaseCoverage). At each column it
# counts the interbase events (insertions from bam_indels type "I", soft/hard clips
# from bam_clips) and emits an indicator only where local depth >= min_depth and
# the events exceed 'threshold' of it, typed by the dominant event (insertion, else
# softclip, else hardclip - JBrowse's stepwise tie order). Returns data.frame(pos,
# type in {I,S,H}, count); empty when nothing at any column is significant.
interbase_indicators <- function(indels, clips, cov, min_depth = 8, threshold = 0.3) {
  ins  <- if (is.null(indels)) integer(0) else indels$refpos[indels$type == "I"]
  soft <- if (is.null(clips))  integer(0) else clips$pos[clips$type == "S"]
  hard <- if (is.null(clips))  integer(0) else clips$pos[clips$type == "H"]
  pos <- sort(unique(c(ins, soft, hard)))
  if (!length(pos)) return(data.frame(pos = integer(0), type = character(0), count = integer(0)))
  tally <- function(x) { v <- as.integer(table(x)[as.character(pos)]); v[is.na(v)] <- 0L; v }
  ci <- tally(ins); cs <- tally(soft); ch <- tally(hard)
  depth <- cov$depth[match(pos, cov$pos)]; depth[is.na(depth)] <- 0
  total <- ci + cs + ch
  # dominant type: insertion, upgraded to softclip then hardclip only on a strict
  # majority, mirroring computeInterbaseCoverage's stepwise comparison
  type <- rep("I", length(pos)); domc <- ci
  sw <- cs > domc; type[sw] <- "S"; domc[sw] <- cs[sw]
  hw <- ch > domc; type[hw] <- "H"
  keep <- depth >= min_depth & total > depth * threshold
  data.frame(pos = pos[keep], type = type[keep], count = total[keep], stringsAsFactors = FALSE)
}`,
  read_gff: `# Read GFF3 features in a region into a
# data.frame(start, end, strand, type, id, parent, name).
read_gff <- function(uri, chrom, start, end) {
  g <- import(uri, which = GRanges(chrom, IRanges(start + 1, end)), format = "gff")
  m <- mcols(g)
  col <- function(nm) if (is.null(m[[nm]])) NA_character_ else as.character(m[[nm]])
  parent <- if (is.null(m$Parent)) NA_character_ else
    vapply(m$Parent, function(v) if (length(v)) as.character(v[[1]]) else NA_character_, character(1))
  data.frame(start = start(g) - 1L, end = end(g), strand = as.character(strand(g)),
             type = col("type"), id = col("ID"), parent = parent, name = col("Name"),
             stringsAsFactors = FALSE)
}`,
  gene_layout: `# Group features under their top-level (parent-less) ancestor and row-pack the
# ancestors with IRanges::disjointBins (the interval-stacking primitive).
gene_layout <- function(f) {
  f$fid <- ifelse(is.na(f$id), paste0("_f", seq_len(nrow(f))), f$id)
  parent <- setNames(f$parent, f$fid)
  root_of <- function(id) {
    p <- parent[[id]]
    while (!is.na(p) && p %in% names(parent)) { id <- p; p <- parent[[id]] }
    id
  }
  f$root <- vapply(f$fid, root_of, character(1))
  roots <- f[is.na(f$parent), , drop = FALSE]
  roots$row <- disjointBins(IRanges(roots$start + 1L, roots$end))
  f$row <- setNames(roots$row, roots$fid)[f$root]
  f[!is.na(f$row), , drop = FALSE]
}`,
  read_bed: `# Read BED features in a region into the same schema read_gff returns
# (start, end, strand, type, id, parent, name), so gene_layout and the gene
# panel treat BED and GFF alike. A BED12 record is expanded into a transcript
# root plus 'exon' subfeatures (its blocks) and 'CDS' subfeatures (each exon
# clipped to the thickStart/thickEnd coding range) - the same thin-exon /
# thick-CDS gene model a GFF gives. A plain BED (no block columns) yields one
# flat 'feature' per record. start is 0-based half-open (BED-style). rtracklayer
# returns block ranges relative to the feature start and thick as absolute
# 1-based coords; a zero-width thick range means non-coding (no CDS drawn).
read_bed <- function(uri, chrom, start, end) {
  g <- import(uri, which = GRanges(chrom, IRanges(start + 1, end)), format = "bed")
  m <- mcols(g)
  nm <- if (is.null(m$name)) paste0("bed", seq_along(g)) else as.character(m$name)
  fs <- start(g); fe <- end(g); str <- as.character(strand(g))
  flat <- function(i) data.frame(start = fs[i] - 1L, end = fe[i], strand = str[i],
    type = "feature", id = nm[i], parent = NA_character_, name = nm[i],
    stringsAsFactors = FALSE)
  if (is.null(m$blocks)) return(do.call(rbind, lapply(seq_along(g), flat)))
  out <- vector("list", length(g))
  for (i in seq_along(g)) {
    bl <- m$blocks[[i]]
    if (!length(bl)) { out[[i]] <- flat(i); next }
    ex_s <- fs[i] + start(bl) - 1L; ex_e <- fs[i] + end(bl) - 1L
    parts <- list(
      data.frame(start = fs[i] - 1L, end = fe[i], strand = str[i], type = "mRNA",
        id = nm[i], parent = NA_character_, name = nm[i], stringsAsFactors = FALSE),
      data.frame(start = ex_s - 1L, end = ex_e, strand = str[i], type = "exon",
        id = paste0(nm[i], ".exon", seq_along(bl)), parent = nm[i],
        name = NA_character_, stringsAsFactors = FALSE))
    if (!is.null(m$thick) && end(m$thick)[i] > start(m$thick)[i]) {
      ts <- start(m$thick)[i]; te <- end(m$thick)[i]
      cs <- pmax(ex_s, ts); ce <- pmin(ex_e, te); keep <- cs <= ce
      if (any(keep)) parts[[3]] <- data.frame(start = cs[keep] - 1L, end = ce[keep],
        strand = str[i], type = "CDS", id = paste0(nm[i], ".cds", which(keep)),
        parent = nm[i], name = NA_character_, stringsAsFactors = FALSE)
    }
    out[[i]] <- do.call(rbind, parts)
  }
  do.call(rbind, out)
}`,
  read_vcf: `# Read VCF records in a region via the tabix index (Rsamtools - no
# VariantAnnotation needed) into data.frame(start, end, ref, alt, type). SV span
# (END) and SVTYPE come from the INFO column; sequence indels are classed by
# REF/ALT length. start is 0-based half-open (BED-style).
read_vcf <- function(uri, chrom, start, end) {
  info_field <- function(info, key) {
    pat <- paste0("(?:^|;)", key, "=([^;]*)")
    vapply(info, function(x) {
      r <- regmatches(x, regexpr(pat, x, perl = TRUE))
      if (length(r)) sub(pat, "\\\\1", r, perl = TRUE) else NA_character_
    }, character(1), USE.NAMES = FALSE)
  }
  lines <- unlist(scanTabix(TabixFile(uri),
    param = GRanges(chrom, IRanges(start + 1, end))))
  cols <- if (length(lines)) do.call(rbind, strsplit(lines, "\\t", fixed = TRUE))
          else matrix(character(), 0, 8)
  pos <- as.integer(cols[, 2]); ref <- cols[, 4]
  alt <- sub(",.*", "", cols[, 5]); info <- cols[, 8]
  symbolic <- grepl("^<", alt)
  end_info <- suppressWarnings(as.integer(info_field(info, "END")))
  svtype <- info_field(info, "SVTYPE")
  type <- ifelse(symbolic,
      ifelse(!is.na(svtype), svtype, gsub("[<>]", "", alt)),
    ifelse(nchar(ref) == 1 & nchar(alt) == 1, "SNV",
      ifelse(nchar(ref) < nchar(alt), "INS",
        ifelse(nchar(ref) > nchar(alt), "DEL", "MNV"))))
  data.frame(start = pos - 1L,
             end = ifelse(symbolic & !is.na(end_info), end_info, pos + nchar(ref) - 1L),
             ref = ref, alt = alt, type = type, stringsAsFactors = FALSE)
}`,
  vcf_layout: `# Row-pack variants so overlapping ones stack (IRanges::disjointBins).
vcf_layout <- function(v) {
  v$row <- if (nrow(v)) disjointBins(IRanges(v$start + 1L, pmax(v$end, v$start + 1L))) else integer()
  v
}`,
  hic_triangle: `# Read a Hi-C contact matrix region (strawr - the reader from the .hic authors)
# and rotate it 45 degrees into diamond polygons so the map shares the genomic
# x-axis with the other stacked tracks (this is JBrowse's triangular Hi-C view).
# straw returns the upper triangle as data.frame(x, y, counts) of bin-start
# coords; each bin-bin square [x, x+binsize] x [y, y+binsize] becomes a diamond
# whose genomic x is the contact midpoint (x + y) / 2 and whose height gy is the
# interaction distance (y - x) / 2 (0 on the diagonal). Returns a long
# data.frame of polygon vertices with a 'group' per contact for geom_polygon.
# 'binsize' must be a resolution the file offers (strawr::readHicBpResolutions(
# uri)) and 'norm' a normalization it offers (strawr::readHicNormTypes(uri)) -
# both are editable script variables below (larger binsize = coarser/faster).
hic_triangle <- function(uri, chrom, start, end, binsize, norm) {
  loc <- sprintf("%s:%d:%d", chrom, start, end)
  m <- strawr::straw(norm, uri, loc, loc, unit = "BP", binsize = binsize)
  b <- binsize
  # four corners of each bin-bin square, rotated: gx = midpoint, gy = half-distance
  cx <- c(m$x, m$x + b, m$x + b, m$x)
  cy <- c(m$y, m$y, m$y + b, m$y + b)
  data.frame(gx = (cx + cy) / 2, gy = (cy - cx) / 2,
             counts = rep(m$counts, 4), group = rep(seq_len(nrow(m)), 4))
}`,
  read_vcf_gt: `# Read per-sample genotypes of a VCF region via the tabix index (Rsamtools - no
# VariantAnnotation) into a genotype matrix. Sample names come from the '#CHROM'
# header line; the GT subfield is located in each record's FORMAT column. Each
# variant's "most frequent ALT" allele is found across all samples (matching
# JBrowse's allele-count coloring). Two modes, mirroring the display's
# renderingMode:
#   collapsed (phased = FALSE): one column per sample, each cell classed ref /
#     het / hom (dosage of that ALT) / other (a secondary ALT) / nocall.
#   phased   (phased = TRUE):  one column per haplotype ("<sample> HP<n>",
#     n = ploidy of that sample seen in the region), each single allele classed
#     ref / alt (the most frequent ALT) / other / nocall.
# Also returns per-site minor-allele-frequency and no-call missingness (no-calls
# excluded from the MAF denominator, as in JBrowse) so sites can be filtered, and
# each site's 0-based half-open genomic span (start/end; symbolic SVs use INFO
# END) for displays that draw at genomic position rather than by column index.
read_vcf_gt <- function(uri, chrom, start, end, phased = FALSE) {
  tf <- TabixFile(uri)
  hdr <- headerTabix(tf)$header
  header_cols <- strsplit(sub("^#", "", hdr[length(hdr)]), "\\t", fixed = TRUE)[[1]]
  samples <- header_cols[-(1:9)]
  ns <- length(samples)
  lines <- unlist(scanTabix(tf, param = GRanges(chrom, IRanges(start + 1, end))))
  if (!length(lines)) {
    cols <- if (phased) character() else samples
    return(list(cls = matrix(character(), 0, length(cols)),
                dose = matrix(numeric(), 0, length(cols)),
                maf = numeric(), missingness = numeric(), has_alt = logical(),
                start = integer(), end = integer(), samples = cols))
  }
  m <- do.call(rbind, strsplit(lines, "\\t", fixed = TRUE))
  pos <- as.integer(m[, 2]); ref <- m[, 4]; alt <- sub(",.*", "", m[, 5])
  symbolic <- grepl("^<", alt)
  end_info <- suppressWarnings(as.integer(vapply(m[, 8], function(x) {
    r <- regmatches(x, regexpr("(?:^|;)END=([^;]*)", x, perl = TRUE))
    if (length(r)) sub(".*END=", "", r) else NA_character_
  }, character(1), USE.NAMES = FALSE)))
  vstart <- pos - 1L
  vend <- ifelse(symbolic & !is.na(end_info), end_info, pos + nchar(ref) - 1L)
  gt_field <- vapply(strsplit(m[, 9], ":", fixed = TRUE),
                     function(f) match("GT", f), integer(1))
  nv <- nrow(m)
  maf <- numeric(nv); missingness <- numeric(nv); has_alt <- logical(nv)
  toks_all <- vector("list", nv); mfa_all <- character(nv)
  for (i in seq_len(nv)) {
    raw <- m[i, 10:(9 + ns)]
    gi <- gt_field[i]
    gts <- if (is.na(gi)) raw else
      vapply(strsplit(raw, ":", fixed = TRUE), function(x) x[gi], character(1))
    toks <- strsplit(gts, "[/|]")
    toks_all[[i]] <- toks
    all_alleles <- unlist(toks)
    called <- all_alleles[all_alleles != "."]
    alt_tab <- table(called[called != "0"])
    mfa_all[i] <- if (length(alt_tab)) names(alt_tab)[which.max(alt_tab)] else NA_character_
    has_alt[i] <- !is.na(mfa_all[i])
    counts <- sort(as.integer(table(called)), decreasing = TRUE)
    maf[i] <- if (length(counts) >= 2) counts[2] / length(called) else 0
    missingness[i] <- sum(all_alleles == ".") / length(all_alleles)
  }
  if (phased) {
    # per-sample ploidy = max allele count across sites (samples never called
    # anywhere default to diploid), then one HP column per haplotype
    ploidy <- rep(2L, ns)
    for (i in seq_len(nv)) ploidy <- pmax(ploidy, lengths(toks_all[[i]]))
    hap_sample <- rep(seq_len(ns), ploidy)
    hap_idx <- unlist(lapply(ploidy, seq_len))
    hap_names <- paste0(samples[hap_sample], " HP", hap_idx - 1L)
    # site-by-haplotype allele matrix, then class every cell in one vectorized
    # pass (single allele per cell: ref / alt = most-frequent ALT / other / nocall)
    allele <- do.call(rbind, lapply(toks_all, function(toks)
      mapply(function(s, k) toks[[s]][k], hap_sample, hap_idx)))
    mfa <- matrix(mfa_all, nv, length(hap_sample))
    is_ref <- !is.na(allele) & allele == "0"
    is_alt <- !is.na(allele) & allele != "0" & allele != "." & allele == mfa
    is_oth <- !is.na(allele) & allele != "0" & allele != "." & allele != mfa
    cls <- matrix("nocall", nv, length(hap_sample))
    cls[is_ref] <- "ref"; cls[is_alt] <- "alt"; cls[is_oth] <- "other"
    dose <- ifelse(is_ref, 0, ifelse(is_alt | is_oth, 1, NA_real_))
    rownames(cls) <- seq_len(nv); colnames(cls) <- hap_names
    return(list(cls = cls, dose = dose, maf = maf, missingness = missingness,
                has_alt = has_alt, start = vstart, end = vend, samples = hap_names))
  }
  cls <- matrix("nocall", nv, ns); dose <- matrix(NA_real_, nv, ns)
  for (i in seq_len(nv)) {
    toks <- toks_all[[i]]; mfa <- mfa_all[i]
    for (j in seq_len(ns)) {
      a <- toks[[j]]
      if (all(a == ".")) next
      d <- if (is.na(mfa)) 0L else sum(a == mfa)
      other <- if (is.na(mfa)) 0L else sum(a != "0" & a != "." & a != mfa)
      dose[i, j] <- d
      cls[i, j] <- if (other > 0) "other" else if (d == 0) "ref" else if (d == 1) "het" else "hom"
    }
  }
  rownames(cls) <- seq_len(nv); colnames(cls) <- samples
  list(cls = cls, dose = dose, maf = maf, missingness = missingness,
       has_alt = has_alt, start = vstart, end = vend, samples = samples)
}`,
  read_gwas: `# Read GWAS association points from a tabix'd BED into data.frame(pos, score).
# The score column is looked up by NAME in the header line (BedTabixAdapter's
# scoreColumn, e.g. neg_log_pvalue); the genomic position column comes from the
# tabix index (headerTabix()$indexColumns) so it works whatever BED layout the
# file uses. pos is 0-based (BED chromStart). Rsamtools only - no GWAS package.
read_gwas <- function(uri, chrom, start, end, score_col) {
  tf <- TabixFile(uri)
  h <- headerTabix(tf)
  cols <- if (length(h$header))
    strsplit(sub("^#", "", h$header[length(h$header)]), "\\t", fixed = TRUE)[[1]]
    else character(0)
  score_i <- match(score_col, cols)
  pos_col <- h$indexColumns[["start"]]
  lines <- unlist(scanTabix(tf, param = GRanges(chrom, IRanges(start + 1, end))))
  if (!length(lines) || is.na(score_i)) {
    return(data.frame(pos = integer(), score = numeric()))
  }
  m <- do.call(rbind, strsplit(lines, "\\t", fixed = TRUE))
  data.frame(pos = as.integer(m[, pos_col]),
             score = suppressWarnings(as.numeric(m[, score_i])))
}`,
  dendro_segments: `# Convert an hclust tree into geom_segment rows (rectangular elbows) for a
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
}`,
}

/** Collapse the view's coarse blocks down to a single span to seed the call. */
function getViewRegion(model: LinearGenomeViewModel): ViewRegion | undefined {
  const blocks = model.coarseDynamicBlocks
  const source = blocks.length > 0 ? blocks : model.displayedRegions
  const first = source[0]
  if (!first) {
    return undefined
  }
  let start = Math.floor(first.start)
  let end = Math.ceil(first.end)
  for (const block of source) {
    if (block.refName === first.refName) {
      start = Math.min(start, Math.floor(block.start))
      end = Math.max(end, Math.ceil(block.end))
    }
  }
  return { refName: first.refName, start, end }
}

/**
 * The track file's refname aliases as canonical -> file name, keeping only the
 * entries that differ (the ones needing translation). Mirrors what JBrowse uses
 * to fetch: `getRefNameMapForAdapter` runs the same CoreGetRefNames resolution
 * against the assembly's aliases, so a track whose file names contigs
 * differently from the assembly (chr1 vs 1) still reads. Returns undefined when
 * nothing differs, so the common case emits no aliasing code. Resolution
 * failures are swallowed (the export still works, just without translation).
 */
async function resolveRefNameMap(
  model: LinearGenomeViewModel,
  track: LinearGenomeViewModel['tracks'][number],
) {
  try {
    const { assemblyManager } = getSession(model)
    const map = await assemblyManager.getRefNameMapForAdapter(
      getConf(track, 'adapter'),
      model.assemblyNames[0],
      { sessionId: getRpcSessionId(model) },
    )
    const diff: Record<string, string> = {}
    for (const [canonical, name] of Object.entries(map)) {
      if (canonical !== name) {
        diff[canonical] = name
      }
    }
    return Object.keys(diff).length > 0 ? diff : undefined
  } catch (e) {
    console.error(e)
    return undefined
  }
}

/** Collect one R fragment per track whose display knows how to export. */
async function collectFragments(
  model: LinearGenomeViewModel,
  opts: ExportRCodeOptions,
) {
  const fragments: RTrackFragment[] = []
  for (const track of model.tracks) {
    const display = track.displays[0]
    if (hasRExport(display)) {
      const result = await display.exportRCode(opts)
      // a display may contribute several stacked panels (e.g. alignments emit a
      // coverage panel and a pileup panel); all panels of one track share the
      // track file's refName aliases
      const panels = Array.isArray(result) ? result : result ? [result] : []
      if (panels.length > 0) {
        const refNameMap = await resolveRefNameMap(model, track)
        for (const panel of panels) {
          fragments.push(refNameMap ? { ...panel, refNameMap } : panel)
        }
      }
    }
  }
  return fragments
}

export function assembleRScript(
  region: ViewRegion,
  fragments: RTrackFragment[],
) {
  const packages = [
    ...new Set([
      'rtracklayer',
      'ggplot2',
      'patchwork',
      ...fragments.flatMap(f => f.packages),
    ]),
  ]
  // one deduped `<track>_refnames <- c(canonical = "file name", ...)` per track
  // that needs alias translation; the panel wraps its read in resolve_chrom
  const hasRefNames = (f: RTrackFragment) =>
    !!f.refNameMap && Object.keys(f.refNameMap).length > 0
  const refNameVar = (f: RTrackFragment) => `${safeVarName(f.trackId)}_refnames`
  const refNameVecs = new Map<string, string>()
  for (const f of fragments) {
    const map = f.refNameMap
    if (map && Object.keys(map).length > 0) {
      const entries = Object.entries(map)
        .map(([canonical, name]) => `${rName(canonical)} = ${rStr(name)}`)
        .join(', ')
      refNameVecs.set(refNameVar(f), `c(${entries})`)
    }
  }

  // emit helper defs in a stable order, deduped; resolve_chrom rides on any
  // fragment carrying refNameMap rather than the usual per-fragment helper list
  const needsResolveChrom = fragments.some(hasRefNames)
  const helperNames = Object.keys(HELPERS).filter(name =>
    name === 'resolve_chrom'
      ? needsResolveChrom
      : fragments.some(f => f.helpers.includes(name)),
  )
  const helpers = helperNames.map(name => HELPERS[name]).join('\n\n')
  const setups = [...new Set(fragments.map(f => f.setup))].join('\n')
  const refNameSetup =
    refNameVecs.size > 0
      ? `\n\n# JBrowse refname aliases: translate the view's canonical chromosome
# name to the one each track's file uses (see resolve_chrom).
${[...refNameVecs].map(([name, vec]) => `${name} <- ${vec}`).join('\n')}`
      : ''

  const panelBlocks = fragments
    .map(f =>
      hasRefNames(f)
        ? `  ${f.plotVariable} <- local({
    chrom <- resolve_chrom(chrom, ${refNameVar(f)})
    ${f.plotExpr.replaceAll('\n', '\n    ')}
  })`
        : `  ${f.plotVariable} <- ${f.plotExpr.replaceAll('\n', '\n  ')}`,
    )
    .join('\n\n')

  const heights = fragments.map(f => f.heightWeight ?? 1).join(', ')
  const stacked = fragments.map(f => f.plotVariable).join(' /\n    ')
  const totalHeight = Math.max(
    3,
    fragments.reduce((a, f) => a + (f.heightWeight ?? 1), 0) * 2,
  )

  return `# ============================================================
# JBrowse 2 - reproducible R figure (pure ggplot2 + rtracklayer)
# Generated: ${new Date().toISOString()}
#
# plot_region() redraws every track for any locus, so you can call it in a loop
# over a BED file of regions (see the batch example at the bottom). Everything
# below is plain ggplot2 - edit the geoms, scales and theme however you like.
# ============================================================

${packages.map(p => `library(${p})`).join('\n')}

${helpers}

# Data sources (local paths or URLs).
${setups}${refNameSetup}

# Draw every track for one region and stack them into a single figure.
# start/end are 0-based half-open (as in a BED file).
plot_region <- function(chrom, start, end) {
${panelBlocks}

  ${stacked} +
    plot_layout(heights = c(${heights})) +
    plot_annotation(title = sprintf("%s:%s-%s", chrom, format(start + 1, big.mark = ","), format(end, big.mark = ",")))
}

# The region currently shown in JBrowse:
p <- plot_region(${JSON.stringify(region.refName)}, ${region.start}, ${region.end})
print(p)

ggsave("jbrowse_region.png", p, width = 12, height = ${totalHeight}, dpi = 150)
ggsave("jbrowse_region.pdf", p, width = 12, height = ${totalHeight})

# ---- Batch: plot many regions from a BED file ----
# loci <- read.table("regions.bed", col.names = c("chrom", "start", "end"))
# for (i in seq_len(nrow(loci))) {
#   p <- plot_region(loci$chrom[i], loci$start[i], loci$end[i])
#   ggsave(sprintf("region_%03d.png", i), p, width = 12, height = ${totalHeight}, dpi = 150)
# }
`
}

/** Build the R script for the current view and download it. */
export async function exportR(
  model: LinearGenomeViewModel,
  opts: ExportRCodeOptions = {},
) {
  const region = getViewRegion(model)
  const fragments = await collectFragments(model, opts)
  const script =
    region && fragments.length > 0
      ? assembleRScript(region, fragments)
      : '# No exportable tracks are shown. Add a supported track (e.g. a BigWig quantitative track) and try again.'

  saveAs(
    new Blob([script], { type: 'text/plain;charset=utf-8' }),
    opts.filename || 'jbrowse_view.R',
  )
}
