// A user guide's index card shows a crop of one figure the guide embeds:
// its first <Figure>, unless GUIDE_THUMB_OVERRIDES names a better one. Shared
// by scripts/gen-tutorial-thumbs.ts, which writes
// static/img/guide-thumbs/<slug>.webp, and remark-doc-cards.ts, which links it,
// so a card never points at a thumb the script did not write.

export interface ThumbSpec {
  // Source figure under static/img (the PNG the page embeds).
  src: string
  // Vertical slice of the source to frame, as [top, bottom] fractions of its
  // height (full width kept). Omit to cover-crop the whole figure.
  band?: [number, number]
  // Horizontal slice, as [left, right] fractions of width. Composes with `band`.
  xband?: [number, number]
  // Cover-crop anchor when the framed region isn't already 5:3.
  position?: 'top' | 'left' | 'center'
  quality?: number
}

// Skips the app bar and view header a full-window capture opens with.
const DEFAULT_BAND: [number, number] = [0.08, 1]

export const GUIDE_THUMB_OVERRIDES: Record<string, ThumbSpec> = {
  alignments_track: {
    src: 'alignments/strand_split_depth.png',
    band: [0.31, 0.9],
    xband: [0.2, 0.88],
    position: 'center',
  },
  basic_usage: { src: 'lgv_usage_guide.png', band: DEFAULT_BAND },
  // the result window: the hit list beside both hits, HBG2's clean and its
  // paralog HBG1's ticked with mismatches
  blat: {
    src: 'desktop-blat-steps.png',
    band: [0.03, 0.97],
    xband: [0.505, 0.99],
    position: 'left',
  },
  circular_view: {
    src: 'circular_view/tumor_normal_rings.png',
    band: DEFAULT_BAND,
  },
  dotplot_view: { src: 'gallery/yeast_dotplot.png', band: DEFAULT_BAND },
  gene_track: { src: 'dtu/dtu_colored_gene_glyph.png', band: [0.35, 1] },
  graph_genome_view: { src: 'pangenome/graph_context.png', band: DEFAULT_BAND },
  gwas_track: { src: 'gwas/locuszoom_ld.png', band: DEFAULT_BAND },
  hic_track: {
    src: 'hic/observed_control.png',
    band: [0.19, 1],
    xband: [0.36, 0.995],
    position: 'center',
  },
  linear_synteny_view: {
    src: 'synteny_human_chimp_cigar_modes.png',
    band: DEFAULT_BAND,
  },
  maf_track: { src: 'maf_470way_codon.png', band: [0.2, 1], position: 'left' },
  multivariant_track: { src: 'multisv.png', band: [0.14, 1], position: 'center' },
  multiway_synteny_display: {
    src: 'multiway_synteny/vertebrate_hox_lanes.png',
    band: [0.24, 1],
    position: 'left',
  },
  quantitative_track: {
    src: 'scatac/pbmc5k_marker_swap.png',
    band: [0.45, 0.95],
    xband: [0, 0.42],
    position: 'left',
  },
  sequence_track: {
    src: 'sequence_track.png',
    band: DEFAULT_BAND,
    xband: [0, 0.75],
  },
  sv_inspector_view: {
    src: 'sv_inspector_importform_loaded.png',
    band: [0.245, 0.94],
    xband: [0.42, 0.97],
    position: 'center',
  },
  sv_visualization: {
    src: 'inversion_long_read.png',
    band: [0.13, 1],
    position: 'center',
  },
  variant_track: {
    src: 'variant_with_pileup.png',
    band: [0.32, 0.915],
    position: 'center',
  },
}

const figureSrcRe = /<Figure\b[^>]*?\bsrc="\/img\/([^"]+\.png)"/

export function guideThumbSpec(
  slug: string,
  body: string,
): ThumbSpec | undefined {
  const override = GUIDE_THUMB_OVERRIDES[slug]
  if (override) {
    return override
  }
  const src = figureSrcRe.exec(body)?.[1]
  return src ? { src, band: DEFAULT_BAND } : undefined
}
