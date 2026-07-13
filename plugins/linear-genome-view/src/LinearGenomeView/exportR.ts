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
  read_bam: `# Read alignments in a region as a data.frame(start, end, strand, mapq),
# with reference-based (CIGAR-aware) coordinates.
read_bam <- function(uri, chrom, start, end) {
  ga <- readGAlignments(uri, param = ScanBamParam(
    which = GRanges(chrom, IRanges(start + 1, end)), what = "mapq"))
  data.frame(start = start(ga) - 1L, end = end(ga),
             strand = as.character(strand(ga)), mapq = mcols(ga)$mapq)
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
  read_hic: `# Read a Hi-C contact matrix region into data.frame(x, y, counts) of genomic
# bin-start coordinates (strawr - the reader from the .hic authors). straw
# returns only the upper triangle; the matrix is symmetric, so mirror the
# off-diagonal cells across the diagonal to fill the square. 'binsize' must be a
# resolution the file offers (strawr::readHicBpResolutions(uri)) and 'norm' a
# normalization it offers (strawr::readHicNormTypes(uri)) - both are visible
# script variables below that you can edit (larger binsize = coarser/faster).
read_hic <- function(uri, chrom, start, end, binsize, norm) {
  loc <- sprintf("%s:%d:%d", chrom, start, end)
  m <- strawr::straw(norm, uri, loc, loc, unit = "BP", binsize = binsize)
  off <- m$x != m$y
  rbind(m, data.frame(x = m$y[off], y = m$x[off], counts = m$counts[off]))
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
