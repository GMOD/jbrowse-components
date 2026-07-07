import {
  DEMO_CONFIG,
  TRIO_MATERNAL_COLORS,
  TRIO_PATERNAL_COLORS,
  TRIO_VCF_DISPLAY_H,
  crossoverHighlights,
  lgvSession,
  menuCascade,
  trioVcfLayout,
} from '../screenshot-spec-helpers.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

export const trioSpecs: ScreenshotSpec[] = [
  // ────────────────────────────────────────────────────────────────────────
  // Phased trio analysis tutorial screenshots
  // ────────────────────────────────────────────────────────────────────────

  // Initial VCF load with default (LinearVariantDisplay) display.
  {
    mode: 'url',
    name: 'trio-basic',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr1:1,000,000-1,001,000',
      tracks: ['HG02024_VN049_KHVTrio.chr1.vcf'],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  // Multi-sample variant display (matrix view), with the track menu open on the
  // Display types submenu showing the "(matrix)" option highlighted.
  {
    mode: 'url',
    name: 'trio-matrix',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr1:62,174,000-65,097,304',
      tracks: [
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.vcf',
          displaySnapshot: {
            type: 'LinearMultiSampleVariantMatrixDisplay',
          },
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 12000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      ...menuCascade([
        'Display types',
        'Multi-sample variant display (matrix)',
      ]),
    ],
    annotations: [
      {
        type: 'box',
        anchor: { text: 'Multi-sample variant display (matrix)' },
      },
    ],
  },

  // Phased matrix with the "Rendering mode" menu visible.
  {
    mode: 'url',
    name: 'trio-matrix-phased',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr1:62,174,000-65,097,304',
      tracks: [
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.vcf',
          displaySnapshot: {
            type: 'LinearMultiSampleVariantMatrixDisplay',
            renderingMode: 'phased',
          },
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 12000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      ...menuCascade(['Rendering mode', 'Phased']),
    ],
    annotations: [{ type: 'box', anchor: { text: 'Phased' } }],
  },

  // Phased matrix clean (no menu overlay).
  {
    mode: 'url',
    name: 'trio-matrix-phased-clean',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr1:62,174,000-65,097,304',
      tracks: [
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.vcf',
          displaySnapshot: {
            type: 'LinearMultiSampleVariantMatrixDisplay',
            renderingMode: 'phased',
          },
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  // hap-ibd haplotype blocks painted with LinearMultiRowFeatureDisplay: a row
  // per parental haplotype (father copy 1/2, mother copy 1/2). The child's
  // inherited chromosome is tiled across the paired rows, so each crossover is
  // the crisp boundary where the painted block steps between the two rows.
  {
    mode: 'url',
    name: 'trio-hapibd-painting',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr1:1-248,956,422',
      tracks: [
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.hapibd',
          displaySnapshot: {
            type: 'LinearMultiRowFeatureDisplay',
            height: 120,
          },
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  // The hap-ibd painting stacked above the same trio VCF in the phased
  // multi-sample variant display, zoomed to a single ~400 kb window around one
  // genotype-corroborated crossover so the painting block-step is crisp and the
  // genotype columns below resolve into individual variants. We feature two real
  // crossovers — one paternal, one maternal — verified against the raw genotype
  // transmission (most painting boundaries are hap-ibd smoothing artifacts that
  // the genotypes don't actually switch across; these two do).
  //
  // Paternal crossover at chr1:29,697,418 — the child's paternal chromosome
  // steps from Father hap2 (light blue) to Father hap1 (dark blue); the mother's
  // row is solid red across the window (no maternal event here). Compare child
  // HG02024 HP0 against father HG02026's two rows.
  //
  // Maternal crossover at chr1:55,753,613 — the child's maternal chromosome
  // steps from Mother hap2 (pink) to Mother hap1 (red). Of every maternal hap-ibd
  // boundary on chr1 this is the only one the raw genotypes actually corroborate:
  // left of it the child's maternally-transmitted allele tracks mom copy 2 at
  // ~95% of mom-heterozygous sites and right of it mom copy 1 at ~98%, a sharp
  // switch in the direction the painting block steps. The other maternal
  // boundaries are hap-ibd smoothing artifacts the genotypes contradict (the
  // child stays on one copy straight across them), so this stays the featured
  // maternal example. Compare child HG02024 HP1 against mother HG02025's two rows.
  //
  // Both crossovers sit at the horizontal center of their 400 kb window
  // (crossover x ≈ 750 CSS px). The multi-sample VCF rows are relabeled via the
  // display `layout` (trioVcfLayout — a friendly `label` per haplotype row,
  // leaving the stable `name`/`sampleName` identity intact) so the sidebar reads
  // Child/Mother/Father hapN, matching the hap-ibd painting's own row names.
  //
  // The callouts make the crossover concrete by colour-coding the two segments
  // with a translucent frame each (maternal greens/oranges, paternal
  // yellows/purples). Left of the breakpoint the child's inherited haplotype
  // matches one parental copy: the left-colour frame wraps both that parental
  // row's left half and the matching left half of the child row. Right of the
  // breakpoint it matches the other parental copy, wrapped in the right-colour
  // frame. The child row therefore carries the two tinted blocks abutting exactly
  // at the crossover, each colour linking the child segment to the specific
  // parental haplotype it was copied from.
  ...(
    [
      {
        name: 'trio-crossover-paternal',
        loc: 'chr1:29,497,418-29,897,418',
        // only paint the father's two haplotypes: the mother's rows
        // are solid across this window and just add noise. With the painting
        // filtered to the Father pair they sit at painting rows 0-1.
        paintingFilter: ['Father hap1', 'Father hap2'],
        // Child hap1 (paternal) matches Father hap2 left, Father hap1 right
        annotations: crossoverHighlights({
          child: 'Child hap1',
          leftSource: 'Father hap2',
          rightSource: 'Father hap1',
          palette: TRIO_PATERNAL_COLORS,
          paintingTopRow: 0,
          leftText:
            'Left of the crossover, Child hap1 matches Father hap2 (light blue)',
          rightText: 'Right of it, Child hap1 matches Father hap1 (dark blue)',
        }),
      },
      {
        name: 'trio-crossover-maternal',
        loc: 'chr1:55,553,613-55,953,613',
        // only paint the mother's two haplotypes; filtered to the
        // Mother pair they sit at painting rows 0-1.
        paintingFilter: ['Mother hap1', 'Mother hap2'],
        // Child hap2 (maternal) matches Mother hap2 left, Mother hap1 right
        annotations: crossoverHighlights({
          child: 'Child hap2',
          leftSource: 'Mother hap2',
          rightSource: 'Mother hap1',
          palette: TRIO_MATERNAL_COLORS,
          paintingTopRow: 0,
          leftText:
            'Left of the crossover, Child hap2 matches Mother hap2 (pink)',
          rightText: 'Right of it, Child hap2 matches Mother hap1 (red)',
        }),
      },
    ] satisfies {
      name: string
      loc: string
      paintingFilter: string[]
      annotations: Annotation[]
    }[]
  ).map(({ name, loc, paintingFilter, annotations }) => ({
    mode: 'url' as const,
    name,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc,
      tracks: [
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.hapibd',
          displaySnapshot: {
            type: 'LinearMultiRowFeatureDisplay',
            // show only this parent's haplotype rows
            subtreeFilter: paintingFilter,
          },
        },
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.vcf',
          displaySnapshot: {
            type: 'LinearMultiSampleVariantDisplay',
            renderingMode: 'phased',
            height: TRIO_VCF_DISPLAY_H,
            // relabel sidebar rows Child/Mother/Father hapN (keeps the
            // canonical HG020xx HPn identity in `name`/`sampleName`)
            layout: trioVcfLayout,
          },
        },
      ],
    }),
    annotations,
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 28000,
  })),
]
