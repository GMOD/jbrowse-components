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

  // The supporting figure: what the SAME matrix looks like where nothing is
  // rearranged, with the two annotation sets HiCCUPS and Arrowhead derive from
  // it stacked above. Loops are point-to-point contacts (an arc per call) and
  // contact domains are the blocks they bound (an arc spanning each domain), so
  // the arc feet land on the matrix features they were called from.
  //
  // Coarser bins than the auto-pick, which is the whole reason this reads as
  // blocks. At this width the auto-pick is the largest binsize <= 2*bpPerPx,
  // where each bin is nearly empty and the matrix renders as speckle with no
  // domain edges at all. `resolutionBias: 2` steps two levels coarser.
  //
  // THE WINDOW IS ONE LOOP, CHOSEN FROM THE TWO FILES RATHER THAN FROM A GENE
  // LIST (reviewer: "the loops are just noisy and non-sense. the contact
  // domains are also. its just everywhere. where is the 'logic'? need
  // publication quality loops that have a story"). The old chr18 window was
  // 2.4 Mb of whatever the callers had there: every Arrowhead domain in frame
  // was wider than the frame, so the lane was four bars running edge to edge,
  // and 40-odd HiCCUPS calls fanned across the arc lane with no matrix feature
  // to land on.
  //
  // Scored instead, by scripts/hic_pick_loop.py: for every Arrowhead domain of
  // 250-900 kb, the strongest HiCCUPS loop whose two anchors sit within 25 kb
  // of the domain's two corners — i.e. the loop the domain is bounded BY. 1,142
  // domains carry one; chr8:127,735,000-128,335,000 ranks 16th by that loop's
  // contact count (observed 1062) and is the first in the ranking whose anchor
  // is a gene most readers know, MYC, with the 600 kb of lymphoid enhancers and
  // PVT1 it contacts held inside the domain.
  //
  // The window is that domain with ~115 kb of flank on the left and ~285 kb on
  // the right, which `--window` on the same script says is the framing that
  // keeps both drawn domains whole: the 555 kb neighbour ending at 127,725,000
  // falls out of frame rather than drawing as a bar across it, and what is left
  // is the 600 kb domain and the 240 kb one nested inside it. Loops under
  // `observed` 200 are drawn fully transparent — that display has no filter
  // slot, and 14 of the 15 calls with an anchor in this window are weak ones
  // whose other anchor is megabases away, i.e. the fan the review objected to.
  // Two discontiguous windows side by side on one cumulative-bp axis. The block
  // between the two panels carries their cross-region contacts — the same
  // geometry that puts a bright off-diagonal block at a translocation's partner
  // loci. Nothing has to be clicked for it; it falls out of a multi-region
  // `loc`.
  //
  // Kept as a still even though `videos/hic.ts` now films the same route: this
  // session is what the R gallery's `multiregion` figure derives its loc and
  // track list from (`rexportCommand.ts` reads it by name), so retiring the
  // still takes the exported command with it.
  {
    mode: 'url',
    name: 'hic/two_regions',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      // two windows close enough that the cross-block carries real signal —
      // 5Mb-apart windows fetch their pair just the same, but Hi-C contact
      // frequency has decayed to near background by then and the block reads
      // as empty, which shows the geometry without showing the data
      loc: 'chr8:52,000,000-54,000,000 chr8:54,200,000-56,200,000',
      trackLabels: 'offset',
      tracks: ['hic'],
    }),
    viewportHeight: 530,
    readySelector: '[data-testid="hic-display-done"]',
    readyTimeout: 60000,
    settleMs: 10000,
  },

  {
    mode: 'url',
    name: 'hic/loops_and_domains',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      // 2.5 Mb where this was 1 Mb (review: "zoom out more. show more genes").
      // The old window was cropped to a single domain plus its flanks, which
      // made every lane a picture of one object and left the gene lane with
      // four names on it. Wider, the domain that is the subject sits among its
      // neighbours, which is the only way a reader can tell a domain from a
      // window someone chose.
      loc: 'chr8:126,900,000-129,400,000',
      trackLabels: 'offset',
      // MYC ITSELF (review: "dont filter out just myc, but highlight myc").
      // The band used to be the 600 kb contact domain, which the domain lane
      // now draws as its own arc; banding it twice said the same thing twice
      // and left the gene the figure is named for unmarked. MYC's own span is
      // 7.5 kb, so at this width it is a hairline -- which is the honest scale
      // of it against a 600 kb domain, and the label carries the name.
      // BOTH ENDS OF THE DOMAIN, banded by the view (review: "i want the
      // message to be very 'obvious' from the figure and let the data speak for
      // itself"). A band is a column through every lane, so the two of them are
      // what make the section's claim checkable rather than asserted: the
      // Arrowhead arc's feet, the HiCCUPS arc's feet and the matrix block's two
      // corners all land on these same two lines.
      //
      // The left one is MYC's own span and needs no second band -- the domain
      // starts within half a kilobase of the gene, which is why this window was
      // the one the scoring script's ranking was taken to. The right one is the
      // domain's own end, widened to about a pixel's worth at this scale so it
      // draws at all.
      highlight: [
        {
          refName: 'chr8',
          start: 127_735_434,
          end: 127_742_951,
          label: 'MYC',
          color: 'rgba(214,137,16,0.45)',
        },
        {
          refName: 'chr8',
          start: 128_331_000,
          end: 128_339_000,
          label: 'domain edge',
          color: 'rgba(214,137,16,0.45)',
        },
      ],
      tracks: [
        // RefSeq, not MANE (review: "show more genes"). MANE is one transcript
        // per protein-coding gene, and this window is a gene desert by
        // construction -- that is WHY MYC's enhancers have 600 kb to live in --
        // so MANE drew exactly two names across 2.5 Mb. RefSeq adds the
        // non-coding neighbours the domain is actually full of, PVT1 above all,
        // which is the lncRNA the domain's right half is.
        {
          trackId: 'ncbi_refseq_109_hg38_latest',
          type: 'LinearBasicDisplay',
          showOnlyGenes: true,
          geneGlyphMode: 'longestCoding',
          showLabels: 'name',
          height: 90,
        },
        // WHAT THE DOMAIN CONTAINS (review: "are there other tracks like known
        // gene enhancers that would corroborate what is shown here?"). This is
        // the one lane in the frame that is not derived from the contact map:
        // the matrix, the Arrowhead domains and the HiCCUPS loops are all the
        // same file read three ways, so nothing here said the contacted
        // sequence was anything in particular. B-cell accessibility does, and
        // it is the right cell type -- GM12878 is an EBV-transformed
        // B-lymphoblastoid line, and this window's 600 kb gene desert is the
        // MYC enhancer cluster.
        //
        // ALL TWELVE PSEUDOBULKS (review: "this one single bigwig does not help
        // me to see pattern. seeing a bunch of accessibility bigwigs as a
        // multiwig might help"). This lane was cut to one row last round for a
        // different complaint -- "the naive and memory tracks look almost
        // exactly the same. i cant see difference" -- and both notes are right,
        // because they are about different claims.
        //
        // TWO rows is a comparison, and the comparison is not there: measured
        // over this window with bigWigToBedGraph, mean signal inside the 600 kb
        // domain against the rest of the 2.5 Mb frame, Naive B and Memory B come
        // out 0.0385 / 0.0342 against flanks of 0.0094 / 0.0084. Inviting a
        // reader to find a difference that small is worse than one row.
        //
        // TWELVE rows is not a comparison, it is a distribution, and that one
        // the measurement supports outright: EVERY lineage is enriched inside
        // the domain, 3.6x (NK) to 5.2x (CD4 Naive), with B mid-table at 4.1x.
        // So the honest reading of the lane -- the contacted sequence is
        // accessible regulatory DNA across blood lineages, not a B-specific
        // domain -- is the one twelve rows actually draw, while one row looked
        // like a cell-type-matched claim it was never entitled to make. The
        // `subtreeFilter` that pinned it to Naive B is gone with it.
        //
        // `multirowxy` is the track's own default rendering, one row per source.
        //
        // ENCODE's cCRE registry (`encodeCcreCombined`, also in this config)
        // was the first thing tried here and does NOT work at this width --
        // recorded so it is not re-tried. It is cell-type agnostic and covers
        // several percent of the genome, so over 2.5 Mb it draws as an
        // unbroken yellow strip edge to edge: it says every base of the frame
        // is near a candidate element, which corroborates nothing. A sparse,
        // quantitative, cell-type-matched lane is what the question wanted.
        {
          trackId: 'pbmc5k_scatac_pseudobulk_hg38',
          type: 'MultiLinearWiggleDisplay',
          height: 300,
        },
        // Contact domains as ARCS (review: "delete the 'contact domains', just
        // change that into an arc track. it is not sensible as is being orange
        // boxes IMO"). One arc per domain, springing from its two corners, which
        // is the shape the matrix triangle underneath already has.
        //
        // `LinearArcDisplay`, NOT `LinearPairedArcDisplay`, and the difference
        // is why this lane was boxes in the first place. Arrowhead writes each
        // domain with both bedpe mates set to the same interval (x1,x2 ==
        // y1,y2), so a PAIRED arc runs from the domain to itself and draws
        // nothing at all -- the first cut of this figure had an empty 78px lane,
        // and boxes were the retreat from that. The unpaired display asks a
        // different question: it draws one arc from each feature's own start to
        // its own end, which for a domain record is exactly corner to corner.
        // No new file, no rebuild of the bedpe.
        //
        // `thickness` and `label` both default to jexl over `score`, which
        // Arrowhead's domain records do not carry -- left alone the arcs come
        // out hairline-thin with `undefined` printed at every apex.
        {
          trackId: 'hic_gm12878_domains',
          type: 'LinearArcDisplay',
          displayMode: 'arcs',
          thickness: 2,
          label: '',
          color: '#d68910',
          // arcHeight defaults to `log10(span)*50`, which is 289px for a 600 kb
          // domain and so drew every arc with its apex cut off by the lane. The
          // *12 keeps the same log shape -- a wider domain still springs higher,
          // which is what makes the nesting readable -- and lands the widest one
          // in frame at ~70px inside a 150px lane.
          arcHeight: "jexl:log10(get(feature,'end')-get(feature,'start'))*12",
          height: 150,
        },
        // Colour is the filter here, because LinearPairedArcDisplay has no
        // filter slot: HiCCUPS' `observed` column is the raw count at the
        // loop's pixel, and everything under 200 is drawn fully transparent. In
        // this window that leaves the one call that bounds the domain and drops
        // the calls whose other anchor is off-frame, which are the arcs that
        // read as a fan going nowhere.
        //
        // `observed` arrives as a STRING (bedpe columns past 10 are unparsed),
        // which compares fine here only because JS relational operators coerce
        // it — `'263.0' > 200` is a numeric comparison. Don't switch this to a
        // jexl `==`, which would not.
        {
          trackId: 'hic_gm12878_loops',
          height: 110,
          color: "jexl:get(feature,'observed')>200?'#8b1a1a':'rgba(0,0,0,0)'",
        },
        // NORMALIZATION STAYS 'NONE', and SCALE was rendered rather than
        // reasoned about (review: "are there any further improvements you'd
        // suggest?"). It is the obvious remaining lever -- balancing is the
        // standard way to crispen domain edges, and the compartments spec below
        // uses it -- and on this view it is worse. Counting drawn pixels at the
        // top of the colour ramp by depth from the apex: NONE spends it 48% at
        // 10% depth and 14% at 15%, SCALE 71% and 4%. That is the ramp
        // concentrating harder on the near-diagonal and leaving the domain
        // interiors paler, which is the opposite of what this figure needs.
        //
        // The near-diagonal band is where the top of the ramp goes either way,
        // and no setting here fixes that: it is distance-decay rather than
        // structure, and the transform that removes it is observed/expected,
        // which JBrowse does not compute (see the compartments spec below, which
        // exists for the same reason).
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
    // +225 for the accessibility lane going from one row to all twelve; the
    // run's own clipped/blank-below report is what corrects this
    viewportHeight: 1468,
    readySelector: displayPainted('hic-display'),
    readyTimeout: 240000,
    settleMs: 20000,
    // THE TWO NAMED OBJECTS, ON THE PICTURE (review: "if this is a well known
    // result, might add red text annotation describing what it is ... i want
    // the message to be very 'obvious' from the figure"). The frame had no
    // callout at all: the section defines a contact domain and a loop in prose,
    // the figure drew one of each, and which one was left to the caption.
    //
    // That is not a naming-the-obvious case, because the frame holds SEVERAL of
    // each. Six Arrowhead arcs and four HiCCUPS arcs are in view and the matrix
    // carries more than one block -- the dense one left of MYC is a different
    // domain -- so pointing at the pair the section is about is the information.
    //
    // WHAT EACH PILL SAYS IS WHAT ITS LANE CANNOT. That MYC is at a corner
    // rather than in the middle is the reason this window was picked and is
    // invisible without knowing where the corner is; that the arc above the
    // matrix was CALLED FROM the matrix is not something a reader can get from
    // two track names, and it is the whole of "the same object seen two ways".
    annotations: [
      {
        type: 'text',
        // Names both bands, because the view draws neither label at this width
        // and an unnamed second band is furniture. What it says is the part a
        // reader cannot get by looking: that these two columns are one object's
        // ends, and that the gene is at one of them.
        text: "the two bands are one contact domain's corners, MYC at the left one",
        fontSize: 19,
        maxWidth: 330,
        anchor: {
          track: 'hic_gm12878_insitu',
          locus: 'chr8:128,035,000',
          fracY: 0.1,
        },
      },
      // Into the block rather than at its corner: a contact between screen
      // positions x1 and x2 is drawn at their MIDPOINT and at depth |x2-x1|/2,
      // so the domain's own apex is the midpoint locus about 180 css px down --
      // which is where the head goes, and the pill sits above it.
      {
        type: 'arrow',
        fromAnchor: {
          track: 'hic_gm12878_insitu',
          locus: 'chr8:128,035,000',
          fracY: 0.14,
        },
        anchor: {
          track: 'hic_gm12878_insitu',
          locus: 'chr8:128,035,000',
          fracY: 0.36,
        },
      },
      {
        type: 'text',
        text: 'this loop was called from the matrix below it',
        fontSize: 19,
        maxWidth: 330,
        anchor: {
          track: 'hic_gm12878_loops',
          locus: 'chr8:128,035,000',
          fracY: 0.7,
        },
      },
    ],
  },

  // Compartments: the OTHER pair of annotation files ENCODE derives from the same
  // matrix, and the one place a raw contact map genuinely cannot show you the
  // answer. A/B compartmentalisation is a modulation on top of a steep
  // distance-decay, so it only becomes a checkerboard once the matrix is turned
  // into observed/expected and then correlated — which JBrowse does not do. Both
  // ends of the ramp were tried on this exact view: linear+percentile leaves the
  // plaid near-white, and `useLogScale` on a file this deep returns solid red.
  // Balanced (SCALE) + linear was the best available and was kept in frame for a
  // while as the evidence for why the eigenvector track exists; that lane is now
  // gone, see the note on the tracks below.
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
  // The window is 4 Mb, down from 10 (reviewer: "there is too much going on in
  // this image ... the subcompartments are just sort of 'noisy'"). The flanks
  // are still the control that makes the discordant block mean something —
  // both edges of this frame have the two eigenvectors on the same side — and
  // at 100 kb a subcompartment strip that alternated every few pixels across
  // 10 Mb is now blocks a reader can match to the lane above it. The two
  // callouts name the compartment on each lane, since "positive" and
  // "negative" is a decoding step and A and B is the answer.
  {
    mode: 'url',
    name: 'hic/compartment_switch',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr18:54,000,000-58,000,000',
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
        // THE TWO SUBCOMPARTMENT STRIPS ARE GONE (reviewer: "i dont like the
        // silly colors of the subcompartment tracks ... this is just crazy
        // colors"). They were the only categorical encoding in the frame --
        // A1/A2/B1/B2/B3 as yellow, red, grey, green -- and the five classes
        // were a second, coarser copy of the sign the two eigenvector lanes
        // already draw as red against blue. Five colours whose key is off the
        // figure, next to two lanes that carry the same call continuously, is
        // what "the text annotations dont help me understand" is about: the
        // reader had to decide which of the two encodings to believe. Now the
        // figure has one, and the two lanes bracket the band symmetrically.
        {
          trackId: 'hic_k562_compartments',
          height: 84,
          minScore: -0.03,
          maxScore: 0.03,
        },
        // THE MATRIX LANE IS GONE (reviewer: "there is too much going on in
        // this image and the 'squash' looks weird"). It was 300 squashed px
        // arguing for the thing the guide's own paragraph says a raw matrix
        // cannot show: compartments are a modulation on top of distance decay
        // and only become a checkerboard in an observed/expected matrix, which
        // JBrowse does not compute. So the lane was a faint plaid a reader was
        // asked to take on trust, under four lanes that state the answer
        // outright. The matrix is still one figure up, where its subject is
        // something it does show.
        //
        // NO ACCESSIBILITY LANE EITHER, and this one was measured rather than
        // argued (review: "are there any other 'interesting' tracks that
        // complement or enhance result?"). DNase is the obvious corroboration --
        // an A compartment should be the accessible one -- and both lines have
        // it on the same CORS-enabled ENCODE S3 the eigenvectors come from, from
        // one pipeline run: GM12878 ENCFF594DFV (ENCSR581CCT), K562 ENCFF655HFU
        // (ENCSR227NUB). Mean signal inside the band against the rest of this
        // 4 Mb frame: GM12878 0.1046 vs 0.1261 (0.83x), K562 0.1496 vs 0.1442
        // (1.04x). The DIRECTION is right in both -- the closed line is
        // depleted, the open line slightly enriched -- but the switch between
        // them is 1.25x, and 1.25x drawn as two more wiggle lanes at 4 Mb is two
        // lanes that look the same. That is the exact complaint
        // hic/loops_and_domains collected for drawing a difference this size
        // ("the naive and memory tracks look almost exactly the same. i cant see
        // difference"). The eigenvector is a 100 kb aggregate and DNase is peaky
        // per site, so the contrast is real in the arithmetic and invisible in
        // the picture.
      ],
    }),
    // One callout per cell line, on the lane it describes, naming the
    // compartment rather than leaving "positive" and "negative" to be decoded
    // (the sign convention is checked in the spec comment above and stated in
    // the guide). Anchored to the highlighted band, so they move with it.
    //
    // WHAT THE TWO LINES ARE is now in the pills, in a parenthesis each
    // (review: "why are we even comparing gm12878 and k562, ostensibly normal
    // vs cancer? elaborate on this context in red annotation box very
    // briefly"). It goes here rather than in a third box because the answer is
    // per-lane -- naming the lane and saying what the cell is are the same
    // sentence -- and folding it in let both pills get SHORTER, not longer.
    annotations: [
      {
        type: 'text',
        text: 'GM12878 (normal lymphoblastoid): B, closed',
        maxWidth: 380,
        anchor: {
          track: 'hic_gm12878_compartments',
          locus: 'chr18:55,950,000',
          fracY: 0,
          dy: 26,
        },
        fontSize: 18,
      },
      {
        type: 'text',
        text: 'K562 (leukemia): A, open',
        maxWidth: 380,
        anchor: {
          track: 'hic_k562_compartments',
          locus: 'chr18:55,950,000',
          fracY: 0,
          dy: 26,
        },
        fontSize: 18,
      },
    ],
    // -60 for the two strips that went
    viewportHeight: 573,
    readySelector: displayPainted('wiggle-display'),
    readyTimeout: 240000,
    settleMs: 12000,
  },
]
