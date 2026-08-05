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
//     difference — under INTER_SCALE, K562's peak at 250kb drops from 161,282 at
//     ABL1xBCR to 1,116 at an unrelated bin, i.e. the balancing removes the
//     translocation. Both tracks set `selectedNormalization: NONE` in
//     config_demo.json; it is repeated here so the figure does not depend on
//     that default surviving.
//  2. THE SHALLOW GM12878 FILE IS NOT A CONTROL. `hic_gm12878_encode`
//     (ENCSR730CER, the "supernatant" fraction already in the config) has ~140
//     occupied bin pairs in this whole window with a maximum of 7 contacts. Next
//     to K562 it looks like a spectacular difference, but the difference would
//     be sequencing depth, not karyotype. `hic_gm12878_insitu` (ENCSR410MDC) is
//     the depth-matched one and is what this spec uses.
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
    url: lgvSession(DEMO_CONFIG, {
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
    }),
    viewportHeight: 1100,
    readySelector: '[data-testid="hic-display-done"]',
    // Two 2Mb windows means three region pairs per track (chr9xchr9, chr22xchr22,
    // chr9xchr22) at 5kb bins, over range requests into a 55GB and a 20GB file.
    // Measured ~50s for the pair here; 4 minutes is headroom, not an expectation.
    readyTimeout: 240000,
    settleMs: 20000,
    annotations: [
      {
        type: 'text',
        text: 'GM12878 — normal karyotype: nothing between the two chromosomes',
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
        text: 'K562 — CML: chr9 and chr22 are one chromosome here',
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

  // The supporting figure: what the SAME matrix looks like where nothing is
  // rearranged, with the two annotation sets HiCCUPS and Arrowhead derive from
  // it stacked above. Loops are point-to-point contacts (an arc per call) and
  // contact domains are the blocks they bound (an arc spanning each domain), so
  // the arc feet land on the matrix features they were called from.
  //
  // 10kb bins, which is the whole reason this reads as blocks. At 2.4Mb across
  // ~1980px the auto-pick is the largest binsize <= 2*bpPerPx, i.e. 2kb, and at
  // 2kb each bin is nearly empty and the matrix renders as speckle with no
  // domain edges at all. `resolutionBias: 2` steps two levels coarser.
  {
    mode: 'url',
    name: 'hic/loops_and_domains',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr18:47,900,000-50,300,000',
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'mane_hg38',
          type: 'LinearBasicDisplay',
          showLabels: 'name',
          height: 68,
        },
        // Contact domains are a FEATURE track, not a paired-arc one. Arrowhead
        // writes each domain with both bedpe mates set to the same interval
        // (x1,x2 == y1,y2), so a paired arc runs from the domain to itself and
        // draws nothing at all — the first cut of this figure had an empty
        // 78px lane. Read as plain features the same file gives one box per
        // domain, nested ones stacking into rows, which is also how a
        // publication draws TADs.
        {
          trackId: 'hic_gm12878_domains',
          type: 'LinearBasicDisplay',
          height: 62,
        },
        // Colour the arcs by contact strength instead of drawing 40 equal ones:
        // HiCCUPS' `observed` column is the raw count at the loop's pixel, and
        // the strong calls are the ones with a visible corner dot in the matrix
        // below. Without this the lane is an undifferentiated fan and the
        // arc-foot-to-corner-dot correspondence is unreadable.
        //
        // `observed` arrives as a STRING (bedpe columns past 10 are unparsed),
        // which compares fine here only because JS relational operators coerce
        // it — `'263.0' > 300` is a numeric comparison. Don't switch this to a
        // jexl `==`, which would not.
        {
          trackId: 'hic_gm12878_loops',
          height: 84,
          color:
            "jexl:get(feature,'observed')>300?'#8b1a1a':'rgba(90,90,90,0.28)'",
        },
        {
          trackId: 'hic_gm12878_insitu',
          height: 430,
          resolutionBias: 2,
          useLogScale: false,
          useColorPercentile: true,
          selectedNormalization: 'NONE',
        },
      ],
    }),
    viewportHeight: 962,
    readySelector: '[data-testid="hic-display-done"]',
    readyTimeout: 240000,
    settleMs: 20000,
  },

  // Compartments: the OTHER pair of annotation files ENCODE derives from the same
  // matrix, and the one place a raw contact map genuinely cannot show you the
  // answer. A/B compartmentalisation is a modulation on top of a steep
  // distance-decay, so it only becomes a checkerboard once the matrix is turned
  // into observed/expected and then correlated — which JBrowse does not do. Both
  // ends of the ramp were tried on this exact view: linear+percentile leaves the
  // plaid near-white, and `useLogScale` on a file this deep returns solid red.
  // Balanced (SCALE) + linear is the best available and shows blocky texture
  // aligned with the eigenvector, which is why the matrix is kept in frame here
  // rather than dropped: it is the evidence for why the eigenvector track exists.
  //
  // Normalization is SCALE, the deliberate opposite of the translocation figure's
  // NONE. Balancing is right for reading structure and wrong for reading
  // rearrangements; those two figures are the two halves of that statement.
  //
  // THE SIGN IS ANCHORED, NOT ASSUMED. An eigenvector identifies the A
  // compartment only up to a sign, and juicer emits whichever the
  // eigendecomposition produced, so "positive = A" is an assumption until
  // checked. Measured on these two files over chr8/14/18/19, mean eigenvector in
  // bins with >=3 gene TSSs vs bins with none: GM12878 +0.0039 vs -0.0021, K562
  // +0.0067 vs -0.0009. Positive is the gene-rich side in both, on every
  // chromosome tested, so positive is A.
  //
  // The two files are also mutually oriented, which a cross-cell-line comparison
  // needs and nothing guarantees: 87-93% of 100kb bins agree in sign, and each
  // file is ~50/50 positive/negative. Arbitrary relative orientation would sit at
  // 50% agreement, so the ~10% that disagree are real differences.
  //
  // The locus is the largest run where BOTH signals disagree between the lines --
  // slice cluster id AND eigenvector sign -- which is TCF4. Requiring both is
  // what makes it a compartment switch rather than a relabelling: a cluster
  // renumbering moves ids without moving the eigenvector, and a whole-chromosome
  // orientation difference would flip the sign everywhere while the ids agreed.
  // The 10Mb window is deliberate: the flanks, where the two lines agree, are the
  // control that makes the one discordant block mean something.
  {
    mode: 'url',
    name: 'hic/compartment_switch',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr18:51,000,000-61,000,000',
      trackLabels: 'offset',
      highlight: [
        {
          refName: 'chr18',
          start: 55_400_000,
          end: 56_500_000,
          label: 'TCF4',
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
        // Both eigenvector tracks are pinned to the SAME scale. Left to
        // autoscale they each fill their own lane and the two panels stop being
        // comparable, which is the whole point of stacking them.
        {
          trackId: 'hic_gm12878_compartments',
          height: 84,
          minScore: -0.03,
          maxScore: 0.03,
        },
        {
          trackId: 'hic_gm12878_subcompartments',
          type: 'LinearBasicDisplay',
          height: 30,
          displayMode: 'collapsed',
        },
        {
          trackId: 'hic_k562_subcompartments',
          type: 'LinearBasicDisplay',
          height: 30,
          displayMode: 'collapsed',
        },
        {
          trackId: 'hic_k562_compartments',
          height: 84,
          minScore: -0.03,
          maxScore: 0.03,
        },
        {
          trackId: 'hic_gm12878_insitu',
          type: 'LinearHicDisplay',
          height: 300,
          resolutionBias: 2,
          useLogScale: false,
          useColorPercentile: true,
          selectedNormalization: 'SCALE',
          squashToHeight: true,
        },
      ],
    }),
    viewportHeight: 968,
    readySelector: '[data-testid="hic-display-done"]',
    readyTimeout: 240000,
    settleMs: 20000,
  },
]
