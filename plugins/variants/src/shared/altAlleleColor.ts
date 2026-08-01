import { colord } from '@jbrowse/core/util/colord'

// `featureColor` sentinel selecting per-ALT-allele cell coloring, alongside
// CONSEQUENCE_IMPACT_JEXL, SV_TYPE_COLOR and PHASE_SET_COLOR. Like the phase-set
// one it is not a per-feature color — which ALT a cell carries is a
// per-(feature, sample) fact — so `makeFeatureColor` returns no resolver and the
// worker passes the mode down to the cell loops instead.
//
// The default scheme names one alt (the most frequent) and paints every other
// one flat OTHER_ALT_COLOR, which answers "does this sample carry something
// unusual here". At a genuinely multiallelic site that collapses the data: HPRC2
// chr1:1007746 lists 18 ALTs and all 18 are carried by real haplotypes, so it
// draws as one blue plus seventeen identical dark-red cells, and "which
// haplotypes carry the same allele" cannot be read at all.
//
// Deliberately GT-only. Nothing here reads AT, ORIGIN, LV or any other
// pangenome-specific INFO field, so it works the same on an HLA callset, a
// multiallelic CNV panel or a 1000G multiallelic site.
export const ALT_ALLELE_COLOR = 'altAllele'

// category10 minus its grey (#7f7f7f, too near the REFERENCE_COLOR fill) and its
// olive (#bcbd22, too near NO_CALL_COLOR) — a cell's color has to be readable
// against the two non-alt fills before it is readable against other alts.
const BASE_HUES = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#17becf',
]

// Distinct categorical colors rather than a hue hash of the allele index: a hash
// spreads unboundedly but adjacent indices come out indistinguishable, and it
// eventually lands on the no-call yellow anyway.
//
// The palette does have to run past 8, though. Sites carrying 16+ distinct
// alleles are real at pangenome scale (HPRC2 chr1:1049115 carries 16 of its 31
// ALTs), and two different alleles reading as one color is the very thing this
// mode exists to fix. So the hues are banded by lightness: allele 9 is a lighter
// blue than allele 1, allele 17 lighter still. Built once at module load — the
// per-cell path is an array index, never a color computation.
const LIGHTNESS_BANDS = [0, 0.18, 0.34]

export const ALT_ALLELE_PALETTE = LIGHTNESS_BANDS.flatMap(amount =>
  BASE_HUES.map(hue =>
    amount === 0 ? hue : colord(hue).lighten(amount).toHex(),
  ),
)

// Color for ALT allele index `i`, 1-based exactly as GT spells it. Index 0 is
// the reference and never reaches here. Beyond the palette the colors repeat,
// which the legend says outright.
export function getAltAlleleColor(alleleIndex: number) {
  return ALT_ALLELE_PALETTE[(alleleIndex - 1) % ALT_ALLELE_PALETTE.length]!
}
