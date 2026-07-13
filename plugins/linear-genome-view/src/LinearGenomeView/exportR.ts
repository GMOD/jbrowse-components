import { saveAs } from '@jbrowse/core/util'

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
  read_bam: `# Read alignments in a region as a data.frame(start, end, strand, mapq,
# isize), with reference-based (CIGAR-aware) coordinates. isize is |TLEN| (0 for
# unpaired) so a color-by-insert-size panel works without a reference.
read_bam <- function(uri, chrom, start, end) {
  ga <- readGAlignments(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)), what = c("mapq", "isize")))
  data.frame(start = start(ga) - 1L, end = end(ga),
             strand = as.character(strand(ga)), mapq = mcols(ga)$mapq,
             isize = abs(mcols(ga)$isize))
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
  base_colors: `# JBrowse's per-base mismatch colors (green A / blue C / orange G / red T /
# brown N), used with scale_fill_identity so no legend and no second fill scale.
base_colors <- c(A = "#4caf50", C = "#2196f3", G = "#ff9800", T = "#f44336", N = "#795548")`,
  read_fill_colors: `# Per-read body fill for a color-by scheme, returned as literal hex so read
# bodies share one scale_fill_identity() with the mismatch ticks. Mirrors
# JBrowse's read color schemes: normal (grey, the default), strand (pink fwd /
# blue rev), mappingQuality (a fixed-saturation hue ramp over MAPQ, treating
# MAPQ as a hue in degrees like the GPU renderer), insertSize (pink short / red
# long / grey normal, thresholds = mean +/- 3sd of the library's mapped |TLEN|).
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
    is <- reads$isize; obs <- is[is > 0]
    m <- if (length(obs)) mean(obs) else 0; s <- if (length(obs) > 1) sd(obs) else 0
    ifelse(is > m + 3 * s, "#ff0000",
      ifelse(is > 0 & is < m - 3 * s, "#ffc0cb", "#d3d3d3"))
  } else {
    rep("#d3d3d3", nrow(reads))
  }
}`,
  snp_freq_threshold: `# Minimum mismatch frequency drawn in the SNP-coverage track at a given depth -
# JBrowse hides low-frequency noise by default (80% below 10x depth, easing to
# 30% at >=30x). Return 0 (via show_low_freq) to keep every mismatch.
snp_freq_threshold <- function(depth) {
  ifelse(depth < 10, 0.8, ifelse(depth >= 30, 0.3, 0.8 + (depth - 10) / 20 * (0.3 - 0.8)))
}`,
  pileup_layout: `# Stack overlapping reads into rows. IRanges::disjointBins is the standard
# interval-stacking primitive - the same idea as the JBrowse pileup layout.
pileup_layout <- function(reads) {
  reads$row <- disjointBins(IRanges(reads$start + 1L, reads$end))
  reads
}`,
  bam_coverage: `# Per-base read depth over the region.
bam_coverage <- function(uri, chrom, start, end) {
  ga <- readGAlignments(uri, param = ScanBamParam(which = GRanges(chrom, IRanges(start + 1, end))))
  cov <- coverage(ga)[[chrom]]
  pos <- (start + 1):end
  data.frame(pos = pos - 1L, depth = as.numeric(cov[pos]))
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
# VariantAnnotation) into a sample-by-site genotype matrix. Sample names come
# from the '#CHROM' header line; the GT subfield is located in each record's
# FORMAT column. Each variant's "most frequent ALT" allele is found across all
# samples (matching JBrowse's allele-count coloring), then every cell is classed
# ref / het / hom (dosage of that ALT) / other (a secondary ALT) / nocall. Also
# returns per-site minor-allele-frequency and no-call missingness (no-calls
# excluded from the MAF denominator, as in JBrowse) so sites can be filtered, and
# each site's 0-based half-open genomic span (start/end; symbolic SVs use INFO
# END) for displays that draw at genomic position rather than by column index.
read_vcf_gt <- function(uri, chrom, start, end) {
  tf <- TabixFile(uri)
  hdr <- headerTabix(tf)$header
  header_cols <- strsplit(sub("^#", "", hdr[length(hdr)]), "\\t", fixed = TRUE)[[1]]
  samples <- header_cols[-(1:9)]
  ns <- length(samples)
  lines <- unlist(scanTabix(tf, param = GRanges(chrom, IRanges(start + 1, end))))
  if (!length(lines)) {
    return(list(cls = matrix(character(), 0, ns), dose = matrix(numeric(), 0, ns),
                maf = numeric(), missingness = numeric(), has_alt = logical(),
                start = integer(), end = integer(), samples = samples))
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
  cls <- matrix("nocall", nv, ns)
  dose <- matrix(NA_real_, nv, ns)
  maf <- numeric(nv); missingness <- numeric(nv); has_alt <- logical(nv)
  for (i in seq_len(nv)) {
    raw <- m[i, 10:(9 + ns)]
    gi <- gt_field[i]
    gts <- if (is.na(gi)) raw else
      vapply(strsplit(raw, ":", fixed = TRUE), function(x) x[gi], character(1))
    toks <- strsplit(gts, "[/|]")
    all_alleles <- unlist(toks)
    called <- all_alleles[all_alleles != "."]
    alt_tab <- table(called[called != "0"])
    mfa <- if (length(alt_tab)) names(alt_tab)[which.max(alt_tab)] else NA_character_
    has_alt[i] <- !is.na(mfa)
    counts <- sort(as.integer(table(called)), decreasing = TRUE)
    maf[i] <- if (length(counts) >= 2) counts[2] / length(called) else 0
    missingness[i] <- sum(all_alleles == ".") / length(all_alleles)
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
# tabix index (headerTabix()\$indexColumns) so it works whatever BED layout the
# file uses. pos is 0-based (BED chromStart). Rsamtools only - no GWAS package.
read_gwas <- function(uri, chrom, start, end, score_col) {
  tf <- TabixFile(uri)
  h <- headerTabix(tf)
  cols <- if (length(h\$header))
    strsplit(sub("^#", "", h\$header[length(h\$header)]), "\\t", fixed = TRUE)[[1]]
    else character(0)
  score_i <- match(score_col, cols)
  pos_col <- h\$indexColumns[["start"]]
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
      // coverage panel and a pileup panel)
      fragments.push(...(Array.isArray(result) ? result : result ? [result] : []))
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
  // emit helper defs in a stable order, deduped
  const helperNames = Object.keys(HELPERS).filter(name =>
    fragments.some(f => f.helpers.includes(name)),
  )
  const helpers = helperNames.map(name => HELPERS[name]).join('\n\n')
  const setups = [...new Set(fragments.map(f => f.setup))].join('\n')

  const panelBlocks = fragments
    .map(f => `  ${f.plotVariable} <- ${f.plotExpr.replaceAll('\n', '\n  ')}`)
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
${setups}

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
