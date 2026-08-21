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

// ── Trio crossover callouts (analyze_trio.md) ──────────────────────────────
// The two tracks every callout below resolves against. Named once because a
// trackId that doesn't match is an anchor that resolves to nothing, which fails
// the spec rather than misplacing a box — but only if the two figures and the
// helper are spelling it the same way.
export const TRIO_PAINT_TRACK = 'HG02024_VN049_KHVTrio.chr1.hapibd'
export const TRIO_VCF_TRACK = 'HG02024_VN049_KHVTrio.chr1.vcf'

// The six VCF haplotype rows, top→bottom, sharing the hap-ibd painting's
// Father/Mother hapN names so the sidebar and the painting read consistently.
// `name`/`sampleName` keep the canonical "HG020xx HPn" identity; `label` is the
// friendly sidebar text. trioRowFrac(label) is that row's top as a fraction of
// the display's height.
export const TRIO_HAPLOTYPES = [
  { sample: 'HG02024', hp: 0, label: 'Child hap1' },
  { sample: 'HG02024', hp: 1, label: 'Child hap2' },
  { sample: 'HG02025', hp: 0, label: 'Mother hap1' },
  { sample: 'HG02025', hp: 1, label: 'Mother hap2' },
  { sample: 'HG02026', hp: 0, label: 'Father hap1' },
  { sample: 'HG02026', hp: 1, label: 'Father hap2' },
]
export const trioVcfLayout = TRIO_HAPLOTYPES.map(h => ({
  name: `${h.sample} HP${h.hp}`,
  sampleName: h.sample,
  HP: h.hp,
  label: h.label,
}))
// the VCF display auto-fits its `TRIO_VCF_DISPLAY_H` px body across the 6
// haplotype rows (LinearMultiSampleVariantDisplay has no line zone), so the true
// per-row pitch is height/rows ≈ 43.33 — NOT a round 44, which drifts the frames
// ~3px low by the bottom row (boxes don't exactly match the rows).
export const TRIO_VCF_DISPLAY_H = 260
export const TRIO_VCF_ROW_PITCH = TRIO_VCF_DISPLAY_H / TRIO_HAPLOTYPES.length
// That same pitch as a fraction of the display's own height, which is what an
// anchor takes. The arithmetic is unchanged; what goes is its ORIGIN — the
// callouts used to be measured down from the top of the page, so the painting
// track's height (and everything else above the variant display) was silently
// part of every one of them.
export const trioRowFrac = (label: string) =>
  TRIO_HAPLOTYPES.findIndex(h => h.label === label) / TRIO_HAPLOTYPES.length

export const TRIO_HL_FILL = 0.16 // translucent wash inside each highlight frame
// distinct palettes so the two figures aren't mistaken for each other
export const TRIO_MATERNAL_COLORS = { left: '#15a01a', right: '#ff6f00' } // green/orange
export const TRIO_PATERNAL_COLORS = { left: '#caa200', right: '#8e44ad' } // yellow/purple

// hap-ibd painting: the display is filtered to one parent's 2 haplotype rows,
// which render at the auto-fit 20px row height. A depth from the track's top
// edge rather than a fraction of it, because this display's height is auto — a
// fraction would need the height nobody wrote down.
export const TRIO_PAINT_ROW_H = 20

// The window either side of a crossover, as two loci. The frames' widths were
// `TRIO_XOVER_X - 3` and `1495 - TRIO_XOVER_X`, which is the crossover's pixel
// twice over; as loci they are just the two halves of the window the spec
// already declares, and no width is written down at all.
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

// Colour-code the two sides of a crossover: the left-colour frame wraps the
// parental copy matched left of the breakpoint plus the matching left half of
// the child row; the right-colour frame wraps the copy matched right of it plus
// the child's right half; each lightly tinted. A neutral box marks the painting
// step and an arrow drops from it to the crossover point on the child row.
//
// Every one of the sixteen callouts resolves against the two tracks at capture
// time: the x is the crossover (or a half-window either side of it) and the y is
// a haplotype row of the display it is drawn on. The one thing that has to be
// said in pixels is a box's HEIGHT, since a `fracY` anchor is a line through the
// track rather than a band, and a box given no height falls back to 2*pad.
export interface TrioCrossover {
  // the spec's own window, and the breakpoint at the middle of it
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
  // the two painting rows the block steps between, boxed around the step: a
  // fixed 56px window on the crossover, since what it frames is the step itself
  const step = {
    type: 'box',
    color: '#333',
    anchor: {
      track: TRIO_PAINT_TRACK,
      locus: crossover,
      fracY: 0,
      dy: stepTop,
    },
    // `pad: 0` throughout: an anchored box is inset by `pad` on every side, and
    // these frames have to meet the rows and each other exactly
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
        track: TRIO_VCF_TRACK,
        locus,
        fracY: trioRowFrac(row),
      },
      pad: 0,
      height: TRIO_VCF_ROW_PITCH,
    }) satisfies Annotation
  // both captions sit below the variant track, on the bottom of the display
  // rather than 70px under a row whose y was itself measured from the page top
  const caption = (color: string, anchor: AnnotationAnchor, text: string) =>
    ({
      type: 'text',
      color,
      anchor: { track: TRIO_VCF_TRACK, fracY: 1, dy: 27, ...anchor },
      text,
      maxWidth: 600,
    }) satisfies Annotation
  return [
    step,
    {
      type: 'arrow',
      // thinner line -> smaller arrowhead (head was too big)
      strokeWidth: 2,
      // straight down the crossover, from the bottom of the painting step to the
      // top of the child's row in the display below
      fromAnchor: {
        track: TRIO_PAINT_TRACK,
        locus: crossover,
        fracY: 0,
        dy: stepTop + stepHeight,
      },
      anchor: {
        track: TRIO_VCF_TRACK,
        locus: crossover,
        fracY: trioRowFrac(child),
      },
    },
    frame(palette.left, half.left, leftSource),
    frame(palette.left, half.left, child),
    frame(palette.right, half.right, rightSource),
    frame(palette.right, half.right, child),
    // left caption from the track's left edge, right caption from the crossover
    // — each starts where the half it describes does
    caption(palette.left, { alignX: 'left', dx: 60 }, opts.leftText),
    caption(palette.right, { locus: crossover, dx: 50 }, opts.rightText),
  ]
}

// Genes above the matrix for scale (reviewer). The matrix spaces one column per
// variant, so its own x axis carries no genomic distance. The connector zone
// under this track is what ties a column back to a position, and the gene lane
// is what that position then means. Genes only, no descriptions: over 2.9 Mb the
// second RefSeq text line is a wall of prose, and the point here is landmarks,
// not annotation detail.
//
// Shared with the tour in videos/variants.ts, which films the two menu picks
// that get from the default display to the phased matrix — a tour whose gene
// lane differed from the figures' would be a route through a different page.
const TRIO_GENE_LANE = {
  trackId: 'ncbi_refseq_109_hg38_latest',
  type: 'LinearBasicDisplay',
  displayMode: 'compact',
  showOnlyGenes: true,
  // was `showDescriptions: false`, meaning "names suffice here". That has no
  // home on the unified labels enum, so migrateBasicConfigSnapshot resolves it
  // to 'auto' — descriptions do come back at low density. Written as what it
  // actually resolved to; pinning 'name' would honor the original intent but
  // change the figure, so that is a call for whoever regenerates it.
  showLabels: 'auto',
  height: 80,
}

// The window the matrix figures are taken over: 2.9 Mb is enough variants for
// the six phased rows to read as blocks rather than as individual columns.
const TRIO_MATRIX_LOC = 'chr1:62,174,000-65,097,304'

// Where the tour opens instead, at the left edge of that window. The default
// display gates at one feature per pixel and this VCF carries every 1000
// Genomes site, so over 2.9 Mb it draws "Too many features" rather than the
// boxes trio-basic is of; 20 kb is a few hundred variants, which draws.
const TRIO_DENSE_LOC = 'chr1:62,174,000-62,194,000'

export const trioVideoFixtures = {
  vcfTrackId: TRIO_VCF_TRACK,
  matrixLoc: TRIO_MATRIX_LOC,
  // The tour's opening state: the gene lane the figures carry, with the VCF in
  // the display it loads with, since the route being filmed is what gets from
  // that to the phased matrix.
  defaultDisplay: lgvSession(DEMO_CONFIG, {
    assembly: 'hg38',
    loc: TRIO_DENSE_LOC,
    tracks: [TRIO_GENE_LANE, { trackId: TRIO_VCF_TRACK }],
  }),
}

export const trioSpecs: ScreenshotSpec[] = [
  // ────────────────────────────────────────────────────────────────────────
  // Phased trio analysis tutorial screenshots
  // ────────────────────────────────────────────────────────────────────────

  // Initial VCF load with default (LinearVariantDisplay) display.
  {
    mode: 'url',
    name: 'trio-basic',
    // sized to the content: the rest of the viewport was page background
    viewportHeight: 347,
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
      loc: TRIO_MATRIX_LOC,
      tracks: [
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.vcf',
          type: 'LinearMultiSampleVariantMatrixDisplay',
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
      loc: TRIO_MATRIX_LOC,
      tracks: [
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.vcf',
          type: 'LinearMultiSampleVariantMatrixDisplay',
          renderingMode: 'phased',
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
    // sized to the content: the rest of the viewport was page background
    viewportHeight: 597,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: TRIO_MATRIX_LOC,
      tracks: [
        TRIO_GENE_LANE,
        {
          trackId: TRIO_VCF_TRACK,
          type: 'LinearMultiSampleVariantMatrixDisplay',
          renderingMode: 'phased',
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
    // sized to the content: the rest of the viewport was page background. The
    // track carries no color legend (the four row labels already are the key,
    // so the display sets showLegend: false), which is why this is shorter than
    // the legend-bearing paintings and why the gate below is the canvas.
    viewportHeight: 305,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr1:1-248,956,422',
      tracks: [
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.hapibd',
          type: 'LinearMultiRowFeatureDisplay',
          height: 120,
        },
      ],
    }),
    readyText: 'chr1',
    // this painting has no legend to gate on, so wait for the canvas the
    // painting is drawn into
    readySelector: '[data-testid="multirow_canvas"]',
    readyTimeout: 60000,
    settleMs: 3000,
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
  // Both crossovers sit at the horizontal center of their 400 kb window, and
  // every callout below is placed from that coordinate rather than from the
  // pixel it lands on. The multi-sample VCF rows are relabeled via the
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
        crossover: 'chr1:29,697,418',
        // only paint the father's two haplotypes: the mother's rows
        // are solid across this window and just add noise. With the painting
        // filtered to the Father pair they sit at painting rows 0-1.
        paintingFilter: ['Father hap1', 'Father hap2'],
        // Child hap1 (paternal) matches Father hap2 left, Father hap1 right
        highlights: {
          child: 'Child hap1',
          leftSource: 'Father hap2',
          rightSource: 'Father hap1',
          palette: TRIO_PATERNAL_COLORS,
          paintingTopRow: 0,
          // name the frame colour, not the painting colour: the painting's
          // blue clashed with the blue variant track (reviewer)
          leftText:
            'Left of the crossover (yellow frame), Child hap1 matches Father hap2',
          rightText:
            'Right of it (purple frame), Child hap1 matches Father hap1',
        },
      },
      {
        name: 'trio-crossover-maternal',
        loc: 'chr1:55,553,613-55,953,613',
        crossover: 'chr1:55,753,613',
        // only paint the mother's two haplotypes; filtered to the
        // Mother pair they sit at painting rows 0-1.
        paintingFilter: ['Mother hap1', 'Mother hap2'],
        // Child hap2 (maternal) matches Mother hap2 left, Mother hap1 right
        highlights: {
          child: 'Child hap2',
          leftSource: 'Mother hap2',
          rightSource: 'Mother hap1',
          palette: TRIO_MATERNAL_COLORS,
          paintingTopRow: 0,
          // name the frame colour, not the painting colour: the painting's
          // red/pink clashed with the blue variant track (reviewer)
          leftText:
            'Left of the crossover (green frame), Child hap2 matches Mother hap2',
          rightText:
            'Right of it (orange frame), Child hap2 matches Mother hap1',
        },
      },
    ] satisfies {
      name: string
      loc: string
      crossover: string
      paintingFilter: string[]
      highlights: Omit<TrioCrossover, 'loc' | 'crossover'>
    }[]
  )
    // the window and the crossover reach the callouts from the same place the
    // view gets them, so a figure cannot be framed on one locus and annotated
    // against another
    .map(({ name, loc, crossover, paintingFilter, highlights }) => ({
      mode: 'url' as const,
      name,
      url: lgvSession(DEMO_CONFIG, {
        assembly: 'hg38',
        loc,
        tracks: [
          {
            trackId: TRIO_PAINT_TRACK,
            type: 'LinearMultiRowFeatureDisplay',
            // show only this parent's haplotype rows
            subtreeFilter: paintingFilter,
          },
          {
            trackId: TRIO_VCF_TRACK,
            type: 'LinearMultiSampleVariantDisplay',
            renderingMode: 'phased',
            height: TRIO_VCF_DISPLAY_H,
            // relabel sidebar rows Child/Mother/Father hapN (keeps the
            // canonical HG020xx HPn identity in `name`/`sampleName`)
            layout: trioVcfLayout,
          },
        ],
      }),
      annotations: crossoverHighlights({ loc, crossover, ...highlights }),
      readyText: 'chr1',
      readyTimeout: 60000,
      settleMs: 28000,
      // sized to the content: the painting carries no color legend, so the
      // default 800 left ~200 px of page background under the variant track
      viewportHeight: 598,
    })),
]
