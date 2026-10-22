import { displayPainted } from '@jbrowse/browser-test-utils'

import { DEMO_CONFIG, lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// NCBI RefSeq hg38 spans of the two fusion partners
const ABL1 = { refName: 'chr9', start: 130_713_881, end: 130_887_675 }
const BCR = { refName: 'chr22', start: 23_180_509, end: 23_318_037 }

// scripts/scan_hic_translocation.sh ranks the chr9 x chr22 block in both files.
// Two traps:
//  1. Normalization stays `NONE`: balancing divides out per-bin coverage, and
//     the amplified fusion is exactly such a difference. The spec repeats the
//     config_demo.json default so the figure survives a change to it.
//  2. `hic_gm12878_encode` (ENCSR730CER) is too shallow to serve as a control;
//     `hic_gm12878_insitu` (ENCSR410MDC) is the depth-matched one.
const JUNCTION_LOC = 'chr9:129,730,000-131,730,000 chr22:22,285,000-24,285,000'

// A log scale pushes every bin of these dense files to the top of the ramp and
// paints the matrix solid red.
function matrix(trackId: string, height: number) {
  return {
    trackId,
    height,
    color: { scale: 'linear', domainQuantile: 0.95 },
    selectedNormalization: 'NONE',
    // 'fit' squashes the whole ~990px wedge and spends half the frame on the
    // empty corner below the data; the fusion apex sits ~280px down unsquashed.
    heightMode: 'fixed',
  }
}

// videos/hic.ts opens this view too; moving `loc` within it changes the
// figure's url.
const junctionView = {
  assembly: 'hg38',
  loc: JUNCTION_LOC,
  trackLabels: 'offset',
  highlight: [
    { ...ABL1, label: 'ABL1', color: 'rgba(30,110,190,0.16)' },
    { ...BCR, label: 'BCR', color: 'rgba(30,110,190,0.16)' },
  ],
  tracks: [
    // The RefSeq GFF buries ABL1 and BCR under LOC*/RN7SL* entries.
    {
      trackId: 'mane_hg38',
      showLabels: 'name',
      height: 68,
    },
    matrix('hic_gm12878_insitu', 380),
    matrix('hic_k562_insitu', 380),
  ],
}

export const hicVideoFixtures = {
  junctionLoc: JUNCTION_LOC,
  chr9Only: lgvSession(DEMO_CONFIG, {
    ...junctionView,
    loc: JUNCTION_LOC.split(' ')[0]!,
  }),
}

export const hicSpecs: ScreenshotSpec[] = [
  // chr9 comes first so the der(22) quadrant sits at the top of the cross
  // wedge; reversing the order buries it at the wedge's deepest corner.
  // Widening past breakpoints +/-1Mb merges the block into the diagonals and
  // pulls in a mappability hotspot present in both cell lines.
  {
    mode: 'url',
    name: 'hic/bcr_abl1_translocation',
    url: lgvSession(DEMO_CONFIG, junctionView),
    viewportHeight: 1120,
    readySelector: displayPainted('hic-display'),
    // three region pairs per track from a 55GB and a 20GB file: ~50s measured
    readyTimeout: 240000,
    annotations: [
      {
        type: 'text',
        text: 'GM12878, normal karyotype: no chr9-chr22 contacts',
        anchor: {
          trackId: 'hic_gm12878_insitu',
          fracY: 0,
          alignX: 'left',
          dx: 12,
          dy: 34,
        },
      },
      {
        type: 'text',
        text: 'K562 (CML): t(9;22) fuses chr9 to chr22, so they contact',
        anchor: {
          trackId: 'hic_k562_insitu',
          fracY: 0,
          alignX: 'left',
          dx: 12,
          dy: 34,
        },
      },
      // The display draws a contact at the midpoint of its two positions, so
      // the fusion block's apex sits at the chr22 region's start, not under
      // either breakpoint. The overlay drops `text` on an arrow.
      {
        type: 'arrow',
        anchor: {
          trackId: 'hic_k562_insitu',
          loc: 'chr22:22,300,000',
          fracY: 0.7,
        },
        fromAnchor: {
          trackId: 'hic_k562_insitu',
          loc: 'chr9:130,200,000',
          fracY: 0.34,
        },
      },
    ],
  },

  // The same junction as one ratio track: K562 over GM12878, so the fusion
  // block is a gain and the two cell lines' shared structure cancels to white.
  {
    mode: 'url',
    name: 'hic/observed_control',
    url: lgvSession(DEMO_CONFIG, {
      ...junctionView,
      tracks: [
        junctionView.tracks[0]!,
        {
          trackId: 'hic_k562_over_gm12878',
          height: 380,
          heightMode: 'fixed',
          showLegend: true,
        },
      ],
    }),
    viewportHeight: 700,
    readySelector: displayPainted('hic-display'),
    // both files' three region pairs, the same reads the two-track figure makes
    readyTimeout: 360000,
  },

  // An eigenvector fixes A only up to a sign per chromosome. On chr5 both files
  // are positive over gene-dense 5q31/5q35 and negative over the 5p14 desert,
  // so positive is A in both. From 157 Mb K562 turns B again, so the frame
  // starts after it.
  {
    mode: 'url',
    name: 'hic/compartment_switch',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr5:157,150,000-159,950,000',
      trackLabels: 'offset',
      highlight: [
        {
          refName: 'chr5',
          start: 158_100_000,
          end: 159_000_000,
          label: 'EBF1, a B-cell identity gene',
          color: 'rgba(30,110,190,0.14)',
        },
      ],
      tracks: [
        {
          trackId: 'mane_hg38',
          showLabels: 'name',
          height: 62,
        },
        // without one pinned scale each lane autoscales and they stop comparing
        {
          trackId: 'hic_gm12878_compartments',
          height: 84,
          scales: { y: { domainMin: -0.012, domainMax: 0.012 } },
        },
        {
          trackId: 'hic_k562_compartments',
          height: 84,
          scales: { y: { domainMin: -0.012, domainMax: 0.012 } },
        },
      ],
    }),
    // each callout sits on the half of its lane the curve leaves empty
    annotations: [
      {
        type: 'text',
        text: 'GM12878, B-cell line: A, open',
        fontSize: 16,
        anchor: {
          trackId: 'hic_gm12878_compartments',
          loc: 'chr5:158,160,000',
          fracY: 0.85,
        },
      },
      {
        type: 'text',
        text: 'K562, erythroleukemia: B, closed',
        fontSize: 16,
        anchor: {
          trackId: 'hic_k562_compartments',
          loc: 'chr5:158,160,000',
          fracY: 0.4,
        },
      },
    ],
    viewportHeight: 573,
    readySelector: displayPainted('wiggle-display'),
    readyTimeout: 240000,
  },
]
