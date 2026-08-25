import type { SyntenyColorBy } from './colorUtils.ts'

// One table for both views. They had a copy each and the help text had already
// drifted — dotplot's Default said "black" and synteny's said "red", both
// correct for their own renderer — so the wording that differs is a field
// rather than a reason to keep two tables.
export const COLOR_MODES: {
  value: SyntenyColorBy
  label: string
  helpText: string
  pointBasedHelpText?: string
}[] = [
  {
    value: 'default',
    label: 'Default',
    helpText:
      'Default ribbon color (red) with CIGAR operation coloring — insertions, deletions, and skips drawn in distinct colors over the alignment.',
    pointBasedHelpText:
      'Draw all alignments in black, the conventional dotplot line color.',
  },
  {
    value: 'strand',
    label: 'Strand',
    helpText:
      'Color alignments by strand orientation. Forward and reverse strand alignments use different colors, making inversions and strand-specific patterns easy to spot.',
  },
  {
    value: 'track',
    label: 'Distinct color per track',
    helpText:
      'Auto-palettize: hand every overlaid track its own color from a palette, so several alignment files drawn in the same plot can be told apart at a glance. Pin any individual color under "Customize per track".',
  },
  {
    value: 'query',
    label: 'Query',
    helpText:
      "Color by the query sequence (this assembly's own refName). Each unique sequence gets a consistent color, making it easy to distinguish different contigs/chromosomes.",
  },
  {
    value: 'target',
    label: 'Target',
    helpText:
      "Color by the target/mate sequence (the other assembly's refName). The complement of Query coloring — useful when one query maps across several targets.",
  },
  {
    value: 'reference',
    label: 'Reference',
    helpText:
      "Color every level by the shared reference assembly's chromosome names, so a region keeps one consistent color as it's traced across all levels of a stacked multi-genome view.",
  },
  {
    value: 'identity',
    label: 'Identity',
    helpText:
      'Color by per-alignment sequence identity on a perceptually-uniform viridis scale: low identity is dark purple, high identity is bright yellow. Useful for distinguishing divergent vs conserved regions.',
  },
  {
    value: 'meanQueryIdentity',
    label: 'Mean query identity',
    helpText:
      'Color by the length-weighted mean sequence identity across all alignments of each query/target pair (a true 0–100% value). Smooths local noise — e.g. a contig split into many hits is colored by its overall identity to the target.',
  },
  {
    value: 'mappingQuality',
    label: 'Mapping quality',
    helpText:
      'Color by per-alignment PAF mapping quality (MAPQ, 0–60) on a perceptually-uniform cividis scale: low MAPQ dark blue, high MAPQ yellow. Highlights ambiguous or multi-mapping regions.',
  },
  {
    value: 'dnds',
    label: 'dN/dS',
    helpText:
      'Color by the ratio of non-synonymous to synonymous substitution rate, on a diverging blue–yellow–red scale pivoted at 1: blue below is purifying selection, the pale middle is neutral, red above is positive selection (clamped at 2). Needs an ortholog table carrying dN and dS per link.',
  },
]
