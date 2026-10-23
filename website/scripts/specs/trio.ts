import {
  DEMO_CONFIG,
  lgvSession,
  menuCascade,
} from '../screenshot-spec-helpers.ts'

import type {
  Annotation,
  AnnotationAnchor,
  ScreenshotSpec,
} from '../screenshot-spec-types.ts'

// Trio crossover callouts (analyze_trio.md). A trackId that does not match
// fails the spec, so the figures and the helper share these.
export const TRIO_PAINT_TRACK = 'HG02024_VN049_KHVTrio.chr1.hapibd'
export const TRIO_VCF_TRACK = 'HG02024_VN049_KHVTrio.chr1.vcf'

// The six VCF haplotype rows, top to bottom, labelled with the hap-ibd
// painting's own names.
export const TRIO_HAPLOTYPES = [
  { sample: 'HG02024', hp: 0, label: 'Child hap1' },
  { sample: 'HG02024', hp: 1, label: 'Child hap2' },
  { sample: 'HG02025', hp: 0, label: 'Mother hap1' },
  { sample: 'HG02025', hp: 1, label: 'Mother hap2' },
  { sample: 'HG02026', hp: 0, label: 'Father hap1' },
  { sample: 'HG02026', hp: 1, label: 'Father hap2' },
]
export const trioVcfRows = {
  domain: TRIO_HAPLOTYPES.map(h => `${h.sample} HP${h.hp}`),
  labels: Object.fromEntries(
    TRIO_HAPLOTYPES.map(h => [`${h.sample} HP${h.hp}`, h.label]),
  ),
}
// The display auto-fits its body across the 6 rows, so the pitch is 43.33; a
// round 44 drifts the bottom-row frames ~3px low.
export const TRIO_VCF_DISPLAY_H = 260
export const TRIO_VCF_ROW_PITCH = TRIO_VCF_DISPLAY_H / TRIO_HAPLOTYPES.length
export const trioRowFrac = (label: string) =>
  TRIO_HAPLOTYPES.findIndex(h => h.label === label) / TRIO_HAPLOTYPES.length

export const TRIO_HL_FILL = 0.16
export const TRIO_MATERNAL_COLORS = { left: '#15a01a', right: '#ff6f00' }
export const TRIO_PATERNAL_COLORS = { left: '#caa200', right: '#8e44ad' }

// The painting's auto-fit row height. Its track height is auto, so callouts
// take a depth from the top edge, not a fraction.
export const TRIO_PAINT_ROW_H = 20

function crossoverHalves(loc: string, crossover: string) {
  const win = /^(.+):([\d,]+)-([\d,]+)$/.exec(loc)
  const cut = /^(.+):([\d,]+)$/.exec(crossover)
  if (!win || !cut) {
    throw new Error(`trio crossover: "${loc}" / "${crossover}" don't parse`)
  }
  if (win[1] !== cut[1]) {
    throw new Error(`trio crossover: ${cut[1]} is not on ${win[1]}`)
  }
  return {
    left: `${win[1]}:${win[2]}-${cut[2]}`,
    right: `${win[1]}:${cut[2]}-${win[3]}`,
  }
}

// Frames each side of a crossover in the color of the parental copy matched
// there, on both the parent's row and the child's. A box needs an explicit
// height: a `fracY` anchor is a line, and a box with no height falls back to
// 2*pad.
export interface TrioCrossover {
  loc: string
  crossover: string
  child: string
  leftSource: string
  rightSource: string
  palette: { left: string; right: string }
  paintingTopRow: number
  leftText: string
  rightText: string
}

export function crossoverHighlights(opts: TrioCrossover): Annotation[] {
  const { child, crossover, leftSource, rightSource, palette } = opts
  const half = crossoverHalves(opts.loc, crossover)
  const stepTop = opts.paintingTopRow * TRIO_PAINT_ROW_H
  const stepHeight = TRIO_PAINT_ROW_H * 2
  const step = {
    type: 'box',
    color: '#333',
    anchor: {
      trackId: TRIO_PAINT_TRACK,
      loc: crossover,
      fracY: 0,
      dy: stepTop,
    },
    // An anchored box is inset by `pad`; these frames must meet the rows
    // exactly.
    pad: 0,
    dx: -28,
    width: 56,
    height: stepHeight,
  } satisfies Annotation
  const frame = (color: string, locus: string, row: string) =>
    ({
      type: 'box',
      color,
      fillOpacity: TRIO_HL_FILL,
      anchor: {
        trackId: TRIO_VCF_TRACK,
        loc: locus,
        fracY: trioRowFrac(row),
      },
      pad: 0,
      height: TRIO_VCF_ROW_PITCH,
    }) satisfies Annotation
  const caption = (color: string, anchor: AnnotationAnchor, text: string) =>
    ({
      type: 'text',
      color,
      anchor: { trackId: TRIO_VCF_TRACK, fracY: 1, dy: 27, ...anchor },
      text,
      maxWidth: 600,
    }) satisfies Annotation
  return [
    step,
    {
      type: 'arrow',
      strokeWidth: 2,
      fromAnchor: {
        trackId: TRIO_PAINT_TRACK,
        loc: crossover,
        fracY: 0,
        dy: stepTop + stepHeight,
      },
      anchor: {
        trackId: TRIO_VCF_TRACK,
        loc: crossover,
        fracY: trioRowFrac(child),
      },
    },
    frame(palette.left, half.left, leftSource),
    frame(palette.left, half.left, child),
    frame(palette.right, half.right, rightSource),
    frame(palette.right, half.right, child),
    caption(palette.left, { alignX: 'left', dx: 60 }, opts.leftText),
    caption(palette.right, { loc: crossover, dx: 50 }, opts.rightText),
  ]
}

// Genes above the matrix for scale: the matrix spaces one column per variant,
// so its x axis shows no distance. Shared with the tour in
// videos/variants.ts.
const TRIO_GENE_LANE = {
  trackId: 'ncbi_refseq_109_hg38_latest',
  displayMode: 'compact',
  filter: ['geneLike'],
  // Was `showDescriptions: false`, which migrates to 'auto'. Pinning 'name'
  // would change the figure; leave that to whoever regenerates it.
  showLabels: 'auto',
  height: 80,
}

const TRIO_MATRIX_LOC = 'chr1:62,174,000-65,097,304'

// The tour opens 1/128th as wide, so seven zoom-outs land on the matrix window.
// Over 2.9 Mb the default display gates at "Too many features".
const TRIO_DENSE_LOC = 'chr1:63,624,200-63,647,100'

export const trioVideoFixtures = {
  vcfTrackId: TRIO_VCF_TRACK,
  zoomOutsToMatrix: 7,
  defaultDisplay: lgvSession(DEMO_CONFIG, {
    assembly: 'hg38',
    loc: TRIO_DENSE_LOC,
    tracks: [TRIO_GENE_LANE, { trackId: TRIO_VCF_TRACK }],
  }),
}

export const trioSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'trio-basic',
    viewportHeight: 347,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr1:1,000,000-1,001,000',
      tracks: ['HG02024_VN049_KHVTrio.chr1.vcf'],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
  },

  {
    mode: 'url',
    name: 'trio-matrix',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: TRIO_MATRIX_LOC,
      tracks: [
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.vcf',
          type: 'LinearMultiSampleVariantDisplay',
          variantLayout: 'columns',
          height: 250,
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    clicksOpen: 'the track menu at its Layout submenu',
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      ...menuCascade(['Layout', 'Genotype matrix']),
    ],
    annotations: [
      {
        type: 'box',
        anchor: { text: 'Genotype matrix' },
      },
    ],
  },

  {
    mode: 'url',
    name: 'trio-matrix-phased',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: TRIO_MATRIX_LOC,
      tracks: [
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.vcf',
          type: 'LinearMultiSampleVariantDisplay',
          variantLayout: 'columns',
          height: 250,
          unit: 'haplotype',
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      ...menuCascade(['Rows', 'Per haplotype']),
    ],
    annotations: [{ type: 'box', anchor: { text: 'Per haplotype' } }],
  },

  {
    mode: 'url',
    name: 'trio-matrix-phased-clean',
    viewportHeight: 597,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: TRIO_MATRIX_LOC,
      tracks: [
        TRIO_GENE_LANE,
        {
          trackId: TRIO_VCF_TRACK,
          type: 'LinearMultiSampleVariantDisplay',
          variantLayout: 'columns',
          height: 250,
          unit: 'haplotype',
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
  },

  {
    mode: 'url',
    name: 'trio-hapibd-painting',
    // No legend (the row labels are the key), so the gate is the canvas.
    viewportHeight: 337,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr1:1-248,956,422',
      tracks: [
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.hapibd',
          height: 120,
        },
      ],
    }),
    readyText: 'chr1',
    readySelector: '[data-testid="multirow_canvas"]',
    readyTimeout: 60000,
  },

  // Two crossovers the raw genotype transmission corroborates; most hap-ibd
  // boundaries are smoothing artifacts the genotypes cross without switching.
  // The maternal one is the only corroborated maternal boundary on chr1. Each
  // sits at its window's centre.
  ...(
    [
      {
        name: 'trio-crossover-paternal',
        loc: 'chr1:29,497,418-29,897,418',
        crossover: 'chr1:29,697,418',
        // Painting rows 0-1 once filtered to the father's pair.
        paintingFilter: ['Father hap1', 'Father hap2'],
        highlights: {
          child: 'Child hap1',
          leftSource: 'Father hap2',
          rightSource: 'Father hap1',
          palette: TRIO_PATERNAL_COLORS,
          paintingTopRow: 0,
          // Name the frame color: the painting's blue clashes with the variant
          // track.
          leftText: 'Child hap1 = Father hap2',
          rightText: 'Child hap1 = Father hap1',
        },
      },
      {
        name: 'trio-crossover-maternal',
        loc: 'chr1:55,553,613-55,953,613',
        crossover: 'chr1:55,753,613',
        paintingFilter: ['Mother hap1', 'Mother hap2'],
        highlights: {
          child: 'Child hap2',
          leftSource: 'Mother hap2',
          rightSource: 'Mother hap1',
          palette: TRIO_MATERNAL_COLORS,
          paintingTopRow: 0,
          leftText: 'Child hap2 = Mother hap2',
          rightText: 'Child hap2 = Mother hap1',
        },
      },
    ] satisfies {
      name: string
      loc: string
      crossover: string
      paintingFilter: string[]
      highlights: Omit<TrioCrossover, 'loc' | 'crossover'>
    }[]
  ).map(({ name, loc, crossover, paintingFilter, highlights }) => ({
    mode: 'url' as const,
    name,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc,
      tracks: [
        {
          trackId: TRIO_PAINT_TRACK,
          rows: { field: 'parenthap', kept: paintingFilter },
        },
        {
          trackId: TRIO_VCF_TRACK,
          type: 'LinearMultiSampleVariantDisplay',
          unit: 'haplotype',
          height: TRIO_VCF_DISPLAY_H,
          rows: trioVcfRows,
        },
      ],
    }),
    annotations: crossoverHighlights({ loc, crossover, ...highlights }),
    readyText: 'chr1',
    readyTimeout: 60000,
    viewportHeight: 650,
  })),
]
