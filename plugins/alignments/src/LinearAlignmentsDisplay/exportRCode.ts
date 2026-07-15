import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import {
  firstUri,
  getTrackRMeta,
  rStr,
  safeVarName,
} from '@jbrowse/plugin-linear-genome-view'

import { DEFAULT_MODIFICATION_THRESHOLD } from '../shared/types.ts'

import type { LinearAlignmentsDisplayModel } from './model.ts'
import type { RTrackFragment } from '@jbrowse/plugin-linear-genome-view'

interface AdapterConf {
  type?: string
  bamLocation?: { uri?: string }
  cramLocation?: { uri?: string }
  uri?: string
}

interface SequenceAdapterConf {
  fastaLocation?: { uri?: string }
  uri?: string
}

/**
 * The reference FASTA uri from the display's assembly sequence adapter, so a
 * CRAM track can be decoded (cram_to_bam passes it to `samtools view -T`). The
 * CRAM adapter's own sequenceAdapter is injected at runtime and isn't in its
 * static config, so resolve it via the assembly instead. Empty string when it
 * can't be found (or the sequence isn't a plain/bgzipped FASTA) — cram_to_bam
 * then falls back to the CRAM's UR header / REF_PATH.
 */
function referenceFastaUri(self: LinearAlignmentsDisplayModel): string {
  const view = getContainingView(self) as { assemblyNames?: string[] }
  const assemblyName = view.assemblyNames?.[0]
  const assembly = assemblyName
    ? getSession(self).assemblyManager.get(assemblyName)
    : undefined
  const seq = assembly
    ? (getConf(assembly, ['sequence', 'adapter']) as SequenceAdapterConf)
    : undefined
  return seq?.fastaLocation?.uri ?? seq?.uri ?? ''
}

export interface AlignmentsRParams {
  trackId: string
  trackName: string
  uri: string
  showCoverage: boolean
  showPileup: boolean
  // resolved color-by scheme (self.colorBy.type): normal/strand/mappingQuality/
  // insertSize/pairOrientation/modifications are reproduced; other schemes fall
  // back to grey
  colorBy: string
  // when false (JBrowse default), the SNP coverage track hides low-frequency
  // mismatches via snp_freq_threshold(); when true, every mismatch is drawn
  showLowFreqMismatches: boolean
  // minimum MM/ML modification-call probability drawn in the modifications
  // scheme (0..1); JBrowse's default is 0.1 (a 10% threshold slider)
  modificationThreshold: number
  // JBrowse linkedReads === 'normal': group mates + supplementary segments by
  // read name onto one row with connector lines (link_reads) instead of the flat
  // per-read pileup (pileup_layout)
  linkReads: boolean
  // CRAM track: Rsamtools can't read CRAM, so each panel decodes its region to a
  // temporary BAM via cram_to_bam() before the bam_* helpers run
  isCram: boolean
  // reference FASTA uri for CRAM decoding (from the assembly's sequence adapter);
  // empty falls back to the CRAM's own UR header / REF_PATH inside cram_to_bam
  reference: string
}

// JBrowse exposes ~a dozen color-by schemes; map each to the closest scheme the
// R script reproduces. Most bake literal read-body colors (see read_fill_colors);
// modifications/methylation keep grey bodies and overlay MM/ML mod ticks (see
// bam_modifications); perBaseQuality keeps grey bodies and overlays a per-base
// Phred-colored rect (see bam_base_quality). Anything else resolves to normal
// grey rather than silently mislabeling.
function resolveColorScheme(colorBy: string) {
  const map: Record<string, string> = {
    strand: 'strand',
    firstOfPairStrand: 'strand',
    stranded: 'strand',
    mappingQuality: 'mappingQuality',
    insertSize: 'insertSize',
    insertSizeGradient: 'insertSize',
    insertSizeAndOrientation: 'insertSize',
    pairOrientation: 'pairOrientation',
    modifications: 'modifications',
    methylation: 'modifications',
    perBaseQuality: 'perBaseQuality',
  }
  return map[colorBy] ?? 'normal'
}

/**
 * Pure builder for the R panels of an alignments track. Emits up to two stacked
 * panels using plain ggplot2 + inline helpers (no bespoke package): SNP coverage
 * (grey `bam_coverage` total with per-base mismatch counts stacked on top, above
 * a depth-dependent frequency threshold like JBrowse) and a color-by pileup
 * (`read_fill_colors`: normal/strand/mappingQuality/insertSize/pairOrientation) with per-base
 * mismatch ticks — both derived from the MD tag by `bam_mismatches()`
 * (reference-free, the same signal JBrowse's canvas renderer shows). Row layout
 * is the visible, editable `pileup_layout()` helper. Panels read `chrom`,
 * `start`, `end` from the enclosing plot_region().
 */
export function alignmentsFragments(p: AlignmentsRParams): RTrackFragment[] {
  const scheme = resolveColorScheme(p.colorBy)
  const pathVar = safeVarName(p.trackId)
  const refVar = `${pathVar}_ref`
  // Rsamtools can't read CRAM, so a CRAM track reads through a per-region
  // temporary BAM (cram_to_bam) in a distinct variable; a BAM reads its path
  // directly. bamVar is what every bam_* helper call is handed.
  const bamVar = p.isCram ? `${pathVar}_bam` : pathVar
  const setup = p.isCram
    ? `${pathVar} <- ${rStr(p.uri)}\n${refVar} <- ${p.reference ? rStr(p.reference) : 'NULL'}`
    : `${pathVar} <- ${rStr(p.uri)}`
  const cramPrelude = p.isCram
    ? `  # Rsamtools can't read CRAM: decode this region to a temporary BAM first
  ${bamVar} <- cram_to_bam(${pathVar}, chrom, start, end, ${refVar})\n`
    : ''
  const cramHelpers = p.isCram ? ['cram_to_bam'] : []
  const packages = ['Rsamtools', 'GenomicAlignments', 'ggplot2']
  const fragments: RTrackFragment[] = []

  if (p.showCoverage) {
    fragments.push({
      trackId: p.trackId,
      trackName: p.trackName,
      packages,
      helpers: [
        ...cramHelpers,
        'bam_coverage',
        'bam_mismatches',
        'base_colors',
        'snp_freq_threshold',
        'bp_axis',
      ],
      setup,
      plotVariable: `p_${pathVar}_coverage`,
      heightWeight: 1,
      plotExpr: `{
${cramPrelude}  # keep every mismatch (TRUE) or hide low-frequency noise like JBrowse (FALSE)
  show_low_freq <- ${p.showLowFreqMismatches ? 'TRUE' : 'FALSE'}
  cov <- bam_coverage(${bamVar}, chrom, start, end)
  mm <- bam_mismatches(${bamVar}, chrom, start, end)
  p <- ggplot() +
    geom_area(data = cov, aes(pos, depth), fill = "#888888") +
    bp_axis() +
    coord_cartesian(xlim = c(start, end)) +
    labs(title = ${rStr(`${p.trackName} coverage`)}, x = NULL, y = "Depth") +
    theme_minimal()
  # stack the per-base mismatch counts (colored) over the grey total = SNP coverage
  if (!is.null(mm) && nrow(mm)) {
    snp <- aggregate(read_index ~ refpos + base, data = mm, FUN = length)
    names(snp)[names(snp) == "read_index"] <- "count"
    snp$depth <- cov$depth[match(snp$refpos, cov$pos)]
    if (!show_low_freq) {
      snp <- snp[snp$count / snp$depth >= snp_freq_threshold(snp$depth), ]
    }
    if (nrow(snp)) {
      snp$fill <- base_colors[toupper(snp$base)]
      p <- p + geom_col(data = snp, aes(refpos + 0.5, count, fill = fill), width = 1) +
        scale_fill_identity()
    }
  }
  p
}`,
    })
  }

  if (p.showPileup) {
    // modifications/methylation keeps grey read bodies and overlays MM/ML mod
    // ticks (bam_modifications); perBaseQuality keeps grey bodies and overlays a
    // per-base Phred-colored rect (bam_base_quality); every other scheme bakes
    // read-body colors and overlays MD-tag mismatch ticks (bam_mismatches).
    const isMods = scheme === 'modifications'
    const isQual = scheme === 'perBaseQuality'
    const bodyScheme = isMods || isQual ? 'normal' : scheme
    const modsOverlay = `  # per-base modification ticks (MM/ML), joined to their pileup row and colored
  # by modification type; raise to hide low-confidence calls like JBrowse
  min_prob <- ${p.modificationThreshold}
  mm <- bam_modifications(${bamVar}, chrom, start, end, min_prob)
  if (!is.null(mm) && nrow(mm)) {
    mm$row <- reads$row[mm$read_index]
    mm$fill <- mod_colors(mm$modtype)
    p <- p + geom_rect(data = mm,
      aes(xmin = refpos, xmax = refpos + 1, ymin = row, ymax = row + 0.8, fill = fill))
  }`
    const qualOverlay = `  # per-base quality: color every aligned base by its Phred score on JBrowse's
  # perBaseQuality ramp (red low -> green high), joined to its pileup row. This is
  # one rect per aligned base, so like JBrowse it only makes sense zoomed in; over
  # a wide region it would emit millions of rects and exhaust ggplot's memory, so
  # cap it (raise max_quality_rects if you really want a wider view).
  max_quality_rects <- 200000
  bq <- bam_base_quality(${bamVar}, chrom, start, end)
  if (!is.null(bq) && nrow(bq)) {
    if (nrow(bq) > max_quality_rects) {
      message(sprintf("perBaseQuality: %d aligned bases in view exceeds max_quality_rects (%d); skipping the per-base overlay. Narrow the region to draw it.", nrow(bq), max_quality_rects))
    } else {
      bq$row <- reads$row[bq$read_index]
      bq$fill <- quality_colors(bq$score)
      p <- p + geom_rect(data = bq,
        aes(xmin = refpos, xmax = refpos + 1, ymin = row, ymax = row + 0.8, fill = fill))
    }
  }`
    const mismatchOverlay = `  # per-base mismatch ticks, joined to their pileup row and colored by read base
  mm <- bam_mismatches(${bamVar}, chrom, start, end)
  if (!is.null(mm) && nrow(mm)) {
    mm$row <- reads$row[mm$read_index]
    mm$fill <- base_colors[toupper(mm$base)]
    p <- p + geom_rect(data = mm,
      aes(xmin = refpos, xmax = refpos + 1, ymin = row, ymax = row + 0.8, fill = fill))
  }`
    const overlay = isMods
      ? modsOverlay
      : isQual
        ? qualOverlay
        : mismatchOverlay
    // chain layout groups mates + supplementary segments onto one row and draws
    // a connector across each gap (under the read rects, which paint on top)
    const layout = p.linkReads
      ? `  linked <- link_reads(read_bam(${bamVar}, chrom, start, end))
  reads <- linked$reads`
      : `  reads <- pileup_layout(read_bam(${bamVar}, chrom, start, end))`
    const connector = p.linkReads
      ? `
    geom_segment(data = linked$links,
      aes(x = xstart, xend = xend, y = row + 0.4, yend = row + 0.4),
      color = "#999999", linewidth = 0.3) +`
      : ''
    // CIGAR indels that read_bam's start..end swallow. Deletions (short) paint a
    // grey full-height rect over the read body (JBrowse's deletion rect). Skips
    // (N, spliced introns, long) instead erase the body and leave a thin teal
    // connector line between the flanking exons (JBrowse's spliced-read look) --
    // a full-height fill there would read as a colored read segment, not a gap.
    // Insertions (thin purple ticks) mark inserted sequence absent from the
    // reference. Drawn after the read body but before the mismatch ticks (which
    // sit on aligned columns, never inside a gap), independent of the color scheme.
    const indelOverlay = `  # CIGAR indels: deletion (grey rect) / spliced intron (teal line) / insertion (purple tick)
  indels <- bam_indels(${bamVar}, chrom, start, end)
  if (!is.null(indels) && nrow(indels)) {
    indels$row <- reads$row[indels$read_index]
    dels <- indels[indels$type == "D", ]
    skips <- indels[indels$type == "N", ]
    ins <- indels[indels$type == "I", ]
    if (nrow(dels)) {
      p <- p + geom_rect(data = dels,
        aes(xmin = refpos, xmax = refpos + length, ymin = row, ymax = row + 0.8),
        fill = gap_colors[["D"]])
    }
    if (nrow(skips)) {
      # erase the read body across the intron, then draw the thin connector line
      p <- p +
        geom_rect(data = skips,
          aes(xmin = refpos, xmax = refpos + length, ymin = row, ymax = row + 0.8),
          fill = "white") +
        geom_segment(data = skips,
          aes(x = refpos, xend = refpos + length, y = row + 0.4, yend = row + 0.4),
          color = gap_colors[["N"]], linewidth = 0.3)
    }
    if (nrow(ins)) {
      p <- p + geom_segment(data = ins,
        aes(x = refpos, xend = refpos, y = row, yend = row + 0.8),
        color = gap_colors[["I"]], linewidth = 0.8)
    }
  }`
    // soft-clip (blue) / hard-clip (red) indicator bars at read ends: a
    // fixed-width vertical mark where a read carries unaligned sequence, the
    // same breakpoint signal JBrowse's clip indicators show. Independent of the
    // color scheme, so it draws under every scheme.
    const clipOverlay = `  # clip indicator bars (soft = blue, hard = red) at read ends
  clips <- bam_clips(${bamVar}, chrom, start, end)
  if (!is.null(clips) && nrow(clips)) {
    clips$row <- reads$row[clips$read_index]
    clips$color <- clip_colors[clips$type]
    p <- p + geom_segment(data = clips,
      aes(x = pos, xend = pos, y = row, yend = row + 0.8, color = color),
      linewidth = 1) +
      scale_color_identity()
  }`
    fragments.push({
      trackId: p.trackId,
      trackName: p.trackName,
      packages,
      helpers: [
        ...cramHelpers,
        'read_bam',
        'pair_orientation',
        p.linkReads ? 'link_reads' : 'pileup_layout',
        'read_fill_colors',
        ...(isMods
          ? ['bam_modifications', 'mod_colors']
          : isQual
            ? ['bam_base_quality', 'quality_colors']
            : ['bam_mismatches', 'base_colors']),
        'bam_indels',
        'gap_colors',
        'bam_clips',
        'clip_colors',
        'bp_axis',
      ],
      setup,
      plotVariable: `p_${pathVar}_pileup`,
      heightWeight: 3,
      plotExpr: `{
${cramPrelude}${layout}
  # color reads by the track's color-by scheme (edit to try another scheme)
  reads$fill <- read_fill_colors(reads, ${rStr(bodyScheme)})
  p <- ggplot(reads) +${connector}
    geom_rect(aes(xmin = start, xmax = end, ymin = row, ymax = row + 0.8, fill = fill)) +
    scale_fill_identity() +
    scale_y_reverse() +
    bp_axis() +
    coord_cartesian(xlim = c(start, end)) +
    labs(title = ${rStr(p.trackName)}, x = NULL, y = NULL) +
    theme_minimal() +
    theme(axis.text.y = element_blank(), axis.ticks.y = element_blank())
${indelOverlay}
${overlay}
${clipOverlay}
  p
}`,
    })
  }

  return fragments
}

/** Read the alignments display's source uri + subtrack visibility into R panels. */
export function exportRCode(
  self: LinearAlignmentsDisplayModel,
): RTrackFragment[] {
  const { trackId, trackName, adapter } = getTrackRMeta<AdapterConf>(self)
  const isCram = adapter.type === 'CramAdapter' || !!adapter.cramLocation?.uri
  return alignmentsFragments({
    trackId,
    trackName,
    uri: firstUri(
      adapter.bamLocation?.uri,
      adapter.cramLocation?.uri,
      adapter.uri,
    ),
    isCram,
    reference: isCram ? referenceFastaUri(self) : '',
    showCoverage: self.showCoverage,
    showPileup: self.showPileup,
    colorBy: self.colorBy.type,
    showLowFreqMismatches: self.showLowFreqMismatches,
    linkReads: self.linkedReads !== 'off',
    // JBrowse stores the threshold as a percent (default 10); the R helper wants
    // a 0..1 probability
    modificationThreshold:
      (self.colorBy.modifications?.threshold ??
        DEFAULT_MODIFICATION_THRESHOLD) / 100,
  })
}
