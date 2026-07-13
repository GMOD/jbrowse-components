import { firstUri, getTrackRMeta, rStr, safeVarName } from '@jbrowse/plugin-linear-genome-view'

import type { LinearAlignmentsDisplayModel } from './model.ts'
import type { RTrackFragment } from '@jbrowse/plugin-linear-genome-view'

interface AdapterConf {
  bamLocation?: { uri?: string }
  cramLocation?: { uri?: string }
  uri?: string
}

export interface AlignmentsRParams {
  trackId: string
  trackName: string
  uri: string
  showCoverage: boolean
  showPileup: boolean
  // resolved color-by scheme (self.colorBy.type): normal/strand/mappingQuality/
  // insertSize are reproduced; other schemes fall back to normal grey
  colorBy: string
  // when false (JBrowse default), the SNP coverage track hides low-frequency
  // mismatches via snp_freq_threshold(); when true, every mismatch is drawn
  showLowFreqMismatches: boolean
}

// JBrowse exposes ~a dozen color-by schemes; map each to the closest scheme the
// R script bakes as literal read-body colors (see read_fill_colors). Paired-end
// orientation schemes need mate analysis the export doesn't do, so they resolve
// to normal grey rather than silently mislabeling.
function resolveColorScheme(colorBy: string) {
  const map: Record<string, string> = {
    strand: 'strand',
    firstOfPairStrand: 'strand',
    stranded: 'strand',
    mappingQuality: 'mappingQuality',
    insertSize: 'insertSize',
    insertSizeGradient: 'insertSize',
    insertSizeAndOrientation: 'insertSize',
  }
  return map[colorBy] ?? 'normal'
}

/**
 * Pure builder for the R panels of an alignments track. Emits up to two stacked
 * panels using plain ggplot2 + inline helpers (no bespoke package): SNP coverage
 * (grey `bam_coverage` total with per-base mismatch counts stacked on top, above
 * a depth-dependent frequency threshold like JBrowse) and a color-by pileup
 * (`read_fill_colors`: normal/strand/mappingQuality/insertSize) with per-base
 * mismatch ticks — both derived from the MD tag by `bam_mismatches()`
 * (reference-free, the same signal JBrowse's canvas renderer shows). Row layout
 * is the visible, editable `pileup_layout()` helper. Panels read `chrom`,
 * `start`, `end` from the enclosing plot_region().
 */
export function alignmentsFragments(p: AlignmentsRParams): RTrackFragment[] {
  const scheme = resolveColorScheme(p.colorBy)
  const pathVar = safeVarName(p.trackId)
  const setup = `${pathVar} <- ${rStr(p.uri)}`
  const packages = ['Rsamtools', 'GenomicAlignments', 'ggplot2']
  const fragments: RTrackFragment[] = []

  if (p.showCoverage) {
    fragments.push({
      trackId: p.trackId,
      trackName: p.trackName,
      packages,
      helpers: [
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
  # keep every mismatch (TRUE) or hide low-frequency noise like JBrowse (FALSE)
  show_low_freq <- ${p.showLowFreqMismatches ? 'TRUE' : 'FALSE'}
  cov <- bam_coverage(${pathVar}, chrom, start, end)
  mm <- bam_mismatches(${pathVar}, chrom, start, end)
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
    fragments.push({
      trackId: p.trackId,
      trackName: p.trackName,
      packages,
      helpers: [
        'read_bam',
        'pileup_layout',
        'read_fill_colors',
        'bam_mismatches',
        'base_colors',
        'bp_axis',
      ],
      setup,
      plotVariable: `p_${pathVar}_pileup`,
      heightWeight: 3,
      plotExpr: `{
  reads <- pileup_layout(read_bam(${pathVar}, chrom, start, end))
  # color reads by the track's color-by scheme (edit to try another scheme)
  reads$fill <- read_fill_colors(reads, ${rStr(scheme)})
  p <- ggplot(reads) +
    geom_rect(aes(xmin = start, xmax = end, ymin = row, ymax = row + 0.8, fill = fill)) +
    scale_fill_identity() +
    scale_y_reverse() +
    bp_axis() +
    coord_cartesian(xlim = c(start, end)) +
    labs(title = ${rStr(p.trackName)}, x = NULL, y = NULL) +
    theme_minimal() +
    theme(axis.text.y = element_blank(), axis.ticks.y = element_blank())
  # per-base mismatch ticks, joined to their pileup row and colored by read base
  mm <- bam_mismatches(${pathVar}, chrom, start, end)
  if (!is.null(mm) && nrow(mm)) {
    mm$row <- reads$row[mm$read_index]
    mm$fill <- base_colors[toupper(mm$base)]
    p <- p + geom_rect(data = mm,
      aes(xmin = refpos, xmax = refpos + 1, ymin = row, ymax = row + 0.8, fill = fill))
  }
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
  return alignmentsFragments({
    trackId,
    trackName,
    uri: firstUri(
      adapter.bamLocation?.uri,
      adapter.cramLocation?.uri,
      adapter.uri,
    ),
    showCoverage: self.showCoverage,
    showPileup: self.showPileup,
    colorBy: self.colorBy.type,
    showLowFreqMismatches: self.showLowFreqMismatches,
  })
}
