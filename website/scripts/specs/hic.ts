import { displayPainted } from '@jbrowse/browser-test-utils'

import { DEMO_CONFIG, lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// hg38 coordinates of the two fusion partners, from NCBI RefSeq. Used for the
// highlight bands, so the bands mark the genes rather than a hand-placed pixel.
const ABL1 = { refName: 'chr9', start: 130_713_881, end: 130_887_675 }
const BCR = { refName: 'chr22', start: 23_180_509, end: 23_318_037 }

// The BCR-ABL1 junction, read out of the matrices themselves rather than from
// the literature: straw queried both files for the chr9 x chr22 block and the
// hottest 10kb bin pair in K562 is chr9:130,730,000 x chr22:23,280,000 — ABL1
// intron 1 against the BCR major breakpoint cluster region, which is the
// canonical CML fusion.
//
// The numbers that make the figure honest come from
// `scripts/scan_hic_translocation.sh`, which dumps the whole chr9 x chr22 block
// out of both files with juicer_tools and ranks it. At 250kb, raw counts:
//
//   whole pair   K562     55,376 occupied bin pairs   1,539,676 contacts
//                GM12878  66,136 occupied bin pairs   2,072,975 contacts
//   ABL1xBCR bin K562    161,282        GM12878   149
//
// Note which way the totals run: GM12878 carries MORE chr9-chr22 contact overall
// (it is the deeper file), and still 149 where K562 has 161,282. That is the
// whole argument — the difference is focal, not a difference in coverage, and
// the control is a real control rather than an empty panel.
//
// The scan also finds a second partner, chr9:131.0Mb x chr22:16.75Mb at 22,278
// against 10 in GM12878: K562's karyotype is complex and BCR-ABL1 is not its
// only rearrangement.
//
// Two traps this figure is built around, both of which silently produce a
// picture that argues the wrong thing:
//
//  1. NORMALIZATION MUST BE `NONE`. Matrix balancing exists to divide out
//     per-bin coverage differences, and an amplified fusion is exactly such a
//     difference. `NORM=INTER_SCALE bash scripts/scan_hic_translocation.sh`
//     reproduces it: at 250kb the ABL1xBCR bin goes from first of the pair's
//     55,376 to fifteenth, and the top of the table fills with low-mappability
//     bins elsewhere on chr9 and chr22 that the control scores at zero. Both
//     tracks set `selectedNormalization: NONE` in config_demo.json; it is
//     repeated here so the figure does not depend on that default surviving.
//  2. THE SHALLOW GM12878 FILE IS NOT A CONTROL. ENCSR730CER, the "supernatant"
//     fraction `hic_gm12878_encode` is rebinned from, holds 17,905 contacts
//     across the entire chr9 x chr22 block — 24 occupied bin pairs inside this
//     window, none above 2. Next to K562 it looks like a spectacular difference,
//     but the difference would be sequencing depth, not karyotype.
//     `hic_gm12878_insitu` (ENCSR410MDC) is the depth-matched one and is what
//     this spec uses.
const JUNCTION_LOC = 'chr9:129,730,000-131,730,000 chr22:22,285,000-24,285,000'

// Raw counts, linear ramp, 95th-percentile saturation. Log scale is wrong for
// these files: they are dense enough that log pushes every bin to the top of the
// ramp and the matrix comes back solid red (the failure the Hi-C guide describes
// for a dense file).
function matrix(trackId: string, height: number) {
  return {
    trackId,
    // Named explicitly, though the track resolves to it anyway, because the
    // figure-recipe builder needs a display type to map `squashToHeight` to its
    // menu item: that slot is shared with the two LD heatmaps, so unlike
    // `useLogScale` the field name alone cannot settle which display it means,
    // and an unresolved entry lands in spec-recipe-unmapped.txt instead of
    // giving the reader a click path.
    type: 'LinearHicDisplay',
    height,
    useLogScale: false,
    useColorPercentile: true,
    selectedNormalization: 'NONE',
    // Square bins, NOT squashToHeight. A pair's contacts are drawn at depth
    // |x2-x1|/2, so with the two breakpoints ~560 css px apart on screen the
    // fusion block's apex is only ~280px down — and each region's own triangle
    // apexes at ~296px. Both therefore fit in a ~380px track at natural scale.
    // Squashing the full ~990px wedge into 360px instead spent half the frame on
    // the empty long-range corner below the data.
    squashToHeight: false,
  }
}

// The translocation figure's own view, hoisted so the tour in videos/hic.ts can
// open the same tracks, bands and window with one region taken out of the
// `loc`. Spread-then-override keeps `loc` in the position it is declared in
// here, so the figure's url is unchanged by the hoist.
const junctionView = {
  assembly: 'hg38',
  loc: JUNCTION_LOC,
  trackLabels: 'offset',
  // bands mark the two fusion partners and cross every track, so the
  // reader can see the K562 wedge terminating exactly where they intersect
  highlight: [
    { ...ABL1, label: 'ABL1', color: 'rgba(30,110,190,0.16)' },
    { ...BCR, label: 'BCR', color: 'rgba(30,110,190,0.16)' },
  ],
  tracks: [
    // MANE Select: one transcript per gene and no pseudogenes, so ABL1 and
    // BCR are legible. The RefSeq GFF at these two loci is a wall of
    // LOC*/RN7SL* entries that buries both of them.
    {
      trackId: 'mane_hg38',
      type: 'LinearBasicDisplay',
      showLabels: 'name',
      height: 68,
    },
    matrix('hic_gm12878_insitu', 380),
    matrix('hic_k562_insitu', 380),
  ],
}

// What the tour types, and what it opens on. The typed string is the figure's
// own `loc` rather than a second copy of it, and the opening window is that
// string's first region — derived rather than written out, so the two cannot
// disagree about where chr9 starts.
export const hicVideoFixtures = {
  junctionLoc: JUNCTION_LOC,
  chr9Only: lgvSession(DEMO_CONFIG, {
    ...junctionView,
    loc: JUNCTION_LOC.split(' ')[0]!,
  }),
}

export const hicSpecs: ScreenshotSpec[] = [
  // THE FIGURE: one linear view holding a chr9 window and a chr22 window, so
  // JBrowse fetches the chr9 x chr22 block for both cell lines at once. In
  // GM12878 the space between the two triangles is empty; in K562 it carries a
  // dense wedge whose apex sits on the ABL1/BCR intersection. Nothing is
  // clicked and no SV caller runs — a translocation is what a Hi-C map looks
  // like when two chromosomes are joined.
  //
  // chr9 is listed FIRST on purpose. The der(22) Philadelphia fusion joins the
  // 5' side of BCR to the 3' side of ABL1, so the enriched quadrant is (chr9
  // right of its breakpoint) x (chr22 left of its breakpoint). With chr9 first
  // those are the two ends facing the panel boundary, which puts the signal at
  // the TOP of the cross wedge just under the boundary. Reversing the order
  // buries it at the wedge's deepest corner.
  //
  // The window is the breakpoints +/-1Mb. Wider (+/-2Mb) merges the cross-block
  // into the diagonals and it stops reading as an anomaly; it also pulls in a
  // mappability hotspot at chr9:129.42Mb x chr22:23.5Mb that is present in BOTH
  // cell lines and would need explaining away in the caption.
  {
    mode: 'url',
    name: 'hic/bcr_abl1_translocation',
    url: lgvSession(DEMO_CONFIG, junctionView),
    viewportHeight: 1100,
    readySelector: displayPainted('hic-display'),
    // Two 2Mb windows means three region pairs per track (chr9xchr9, chr22xchr22,
    // chr9xchr22) at 5kb bins, over range requests into a 55GB and a 20GB file.
    // Measured ~50s for the pair here; 4 minutes is headroom, not an expectation.
    readyTimeout: 240000,
    settleMs: 20000,
    annotations: [
      {
        type: 'text',
        text: 'GM12878, normal karyotype: no chr9-chr22 contacts',
        anchor: {
          track: 'hic_gm12878_insitu',
          fracY: 0,
          alignX: 'left',
          dx: 12,
          dy: 34,
        },
      },
      {
        type: 'text',
        // Names the rearrangement, not just its consequence: "are one
        // chromosome here" stated the reading without saying what made it
        // true, so the reader had to already know K562 carries t(9;22) to
        // connect the block to a structural variant.
        text: 'K562 (CML): t(9;22) fuses chr9 to chr22, so they contact',
        anchor: {
          track: 'hic_k562_insitu',
          fracY: 0,
          alignX: 'left',
          dx: 12,
          dy: 34,
        },
      },
      // Arrow into the fusion block. Its apex is NOT under either breakpoint:
      // a contact between screen positions x1 and x2 is drawn at their MIDPOINT,
      // and the midpoint of ABL1 and BCR is the panel boundary — i.e. the start
      // of the chr22 region. That is what the head anchors to, so the callout
      // follows the geometry instead of a measured pixel.
      // No `text` here: the arrow branch of the overlay draws a line and a head
      // and never reads `text`, so a label passed on an arrow is silently
      // dropped. The K562 pill above already carries the sentence, and the arrow
      // runs from it into the block, so a third pill would only crowd the frame.
      {
        type: 'arrow',
        anchor: {
          track: 'hic_k562_insitu',
          locus: 'chr22:22,300,000',
          fracY: 0.7,
        },
        fromAnchor: {
          track: 'hic_k562_insitu',
          locus: 'chr9:130,200,000',
          fracY: 0.34,
        },
      },
    ],
  },

  // Compartments: the eigenvector ENCODE derives from each matrix, drawn for two
  // cell lines over one window. A raw contact map cannot show A/B compartments
  // here — they only become a checkerboard in an observed/expected matrix,
  // which JBrowse does not compute — so the published eigenvector is the lane.
  //
  // THE SIGN IS ANCHORED, NOT ASSUMED. An eigenvector identifies A only up to a
  // sign, per chromosome. On chr5 both files are positive over the gene-dense
  // 5q31 and 5q35 bands and negative over the 5p14 gene desert, so positive is
  // A in both.
  //
  // EBF1 (review of the TCF4 window this replaced: "why is this interesting,
  // how would anyone know this is an important result"). TCF4 was the largest
  // discordant run a scan found, with no biology a reader could check it
  // against. EBF1 is the B-cell identity transcription factor: GM12878 is a
  // B-lymphoblastoid line and K562 an erythroleukemia, so the locus being A in
  // one and B in the other is the expected answer rather than a scan's output.
  // Over this window GM12878 stays A throughout, K562 drops to B across EBF1's
  // 3' end and the stretch downstream of it, and both flanks are A in both
  // lines. Further left, from 157 Mb, K562 turns B again, which is why the frame
  // starts where it does.
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
          type: 'LinearBasicDisplay',
          showLabels: 'name',
          height: 62,
        },
        // one pinned scale for both, or each autoscales to its own extremes and
        // the lanes stop being comparable
        {
          trackId: 'hic_gm12878_compartments',
          height: 84,
          minScore: -0.012,
          maxScore: 0.012,
        },
        {
          trackId: 'hic_k562_compartments',
          height: 84,
          minScore: -0.012,
          maxScore: 0.012,
        },
      ],
    }),
    // One callout per cell line, inside the band on the half of its lane the
    // curve leaves empty: below the zero line where GM12878 is A, above it
    // where K562 is B.
    annotations: [
      {
        type: 'text',
        text: 'GM12878, B-cell line: A, open',
        fontSize: 16,
        anchor: {
          track: 'hic_gm12878_compartments',
          locus: 'chr5:158,160,000',
          fracY: 0.85,
        },
      },
      {
        type: 'text',
        text: 'K562, erythroleukemia: B, closed',
        fontSize: 16,
        anchor: {
          track: 'hic_k562_compartments',
          locus: 'chr5:158,160,000',
          fracY: 0.4,
        },
      },
    ],
    viewportHeight: 573,
    readySelector: displayPainted('wiggle-display'),
    readyTimeout: 240000,
    settleMs: 12000,
  },
]
