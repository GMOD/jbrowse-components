import { getConf } from '@jbrowse/core/configuration'
import { getContainingTrack } from '@jbrowse/core/util'

import type { LinearAlignmentsDisplayModel } from './model.ts'
import type { RTrackFragment } from '@jbrowse/plugin-linear-genome-view'

interface AdapterConf {
  bamLocation?: { uri?: string }
  cramLocation?: { uri?: string }
  uri?: string
}

function safeVarName(str: string) {
  return str.replaceAll(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, '_$1')
}

function rStr(s: string) {
  return `"${s.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

export interface AlignmentsRParams {
  trackId: string
  trackName: string
  uri: string
  showCoverage: boolean
  showPileup: boolean
}

/**
 * Pure builder for the R panels of an alignments track. Emits up to two stacked
 * panels using plain ggplot2 + inline helpers (no bespoke package): a coverage
 * histogram (`bam_coverage`) and a strand-colored pileup whose row layout is the
 * visible, editable `pileup_layout()` helper — the "advanced" JBrowse plotting
 * kept as hackable R rather than hidden behind a library. Panels read `chrom`,
 * `start`, `end` from the enclosing plot_region().
 */
export function alignmentsFragments(p: AlignmentsRParams): RTrackFragment[] {
  const pathVar = safeVarName(p.trackId)
  const setup = `${pathVar} <- ${rStr(p.uri)}`
  const packages = ['Rsamtools', 'GenomicAlignments', 'ggplot2']
  const fragments: RTrackFragment[] = []

  if (p.showCoverage) {
    fragments.push({
      trackId: p.trackId,
      trackName: p.trackName,
      packages,
      helpers: ['bam_coverage', 'bp_axis'],
      setup,
      plotVariable: `p_${pathVar}_coverage`,
      heightWeight: 1,
      plotExpr: `ggplot(bam_coverage(${pathVar}, chrom, start, end)) +
  geom_area(aes(pos, depth), fill = "#888888") +
  bp_axis() +
  coord_cartesian(xlim = c(start, end)) +
  labs(title = ${rStr(`${p.trackName} coverage`)}, x = NULL, y = "Depth") +
  theme_minimal()`,
    })
  }

  if (p.showPileup) {
    fragments.push({
      trackId: p.trackId,
      trackName: p.trackName,
      packages,
      helpers: ['read_bam', 'pileup_layout', 'bp_axis'],
      setup,
      plotVariable: `p_${pathVar}_pileup`,
      heightWeight: 3,
      plotExpr: `ggplot(pileup_layout(read_bam(${pathVar}, chrom, start, end))) +
  geom_rect(aes(xmin = start, xmax = end, ymin = row, ymax = row + 0.8, fill = strand)) +
  scale_fill_manual(values = c(\`+\` = "#ec8b8b", \`-\` = "#8b8bec"), guide = "none") +
  scale_y_reverse() +
  bp_axis() +
  coord_cartesian(xlim = c(start, end)) +
  labs(title = ${rStr(p.trackName)}, x = NULL, y = NULL) +
  theme_minimal() +
  theme(axis.text.y = element_blank(), axis.ticks.y = element_blank())`,
    })
  }

  return fragments
}

/** Read the alignments display's source uri + subtrack visibility into R panels. */
export function exportRCode(
  self: LinearAlignmentsDisplayModel,
): RTrackFragment[] {
  const track = getContainingTrack(self)
  const trackId: string = track.configuration.trackId
  const adapter: AdapterConf = getConf(track, 'adapter')
  return alignmentsFragments({
    trackId,
    trackName: getConf(track, 'name') || trackId,
    uri:
      adapter.bamLocation?.uri ?? adapter.cramLocation?.uri ?? adapter.uri ?? '',
    showCoverage: self.showCoverage,
    showPileup: self.showPileup,
  })
}
