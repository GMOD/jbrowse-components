import { displayPainted, encodeSessionSpec } from '@jbrowse/browser-test-utils'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The population_genomics tutorial's figure: the windowed Fst + nucleotide
// diversity (pi) scans from the DGRP2 Drosophila panel, loaded as the exact
// multi-wiggle track the tutorial documents. Data is the real pipeline output
// hosted at jbrowse.org/demos/popgen (Fst of In(2L)t-inverted vs
// standard-arrangement lines, and whole-panel pi, both 2 kb windows, matching
// the window size scripts/build_dgrp_popgen.sh uses).
//
// Loaded against the hosted UCSC dm6 hub config (jbrowse.org/ucsc/dm6) so the
// figure carries a real gene track for context and gene-name search — the setup
// the tutorial tells the reader to build. That assembly names arms chr2L etc.;
// the bigWigs name them 2L etc. (from the VCF header), and the hub assembly's
// RefNameAliasAdapter (chromAlias.txt) reconciles the two at display time, which
// is the aliasing the tutorial calls out.
const DM6_HUB = `?config=${encodeURIComponent('https://jbrowse.org/ucsc/dm6/config.json')}`

// Two independent quantitative tracks rather than one shared-scale
// MultiQuantitativeTrack: Fst tops out near 0.83 and pi near 0.016, a ~50x gap,
// so stacking them into one multi-wiggle (which shares a single y-domain across
// its rows) would crush pi to a flat line. Separate tracks each auto-scale to
// their own data, so both signals read.
const FST_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'fst_in2lt',
  name: 'Fst (In(2L)t vs standard)',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/demos/popgen/fst_In2Lt.bw',
  },
}
const PI_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'pi_all',
  name: 'π (whole panel)',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/demos/popgen/pi_all.bw',
  },
}

// The In(2L)t inversion extent as a single annotation feature (published
// breakpoints 2L:2,225,744–13,154,180), so the reader can see where the
// elevated-Fst plateau sits relative to the inverted region. An inline
// FromConfigAdapter rather than a hosted BED — one feature needs no file.
//
// THOSE NUMBERS ARE RELEASE 5 AND THAT IS FINE HERE; CHECKED, DON'T RE-CHECK.
// Corbett-Detig & Hartl aligned to "reference genome v5.31", so by the usual
// rule they would need converting before being drawn on dm6. They don't: the
// aertslab liftover carries its input coordinate in INFO/OriginalStart, and
// POS - OriginalStart is 0 at every 2L position sampled from 5 kb to 22 Mb, so
// r5 and r6 coincide on this arm. r6's added 2L sequence is past where any of
// this sits.
const IN2LT_INVERSION_TRACK = {
  type: 'FeatureTrack',
  trackId: 'in2lt_inversion',
  name: 'In(2L)t inversion',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'FromConfigAdapter',
    adapterId: 'in2lt',
    features: [
      {
        uniqueId: 'in2lt',
        refName: 'chr2L',
        start: 2225744,
        end: 13154180,
        name: 'In(2L)t',
        type: 'inversion',
      },
    ],
  },
}

// Genome-wide Tajima's D (2 kb windows, whole panel) from the same pipeline.
// Pairs with π: a hard sweep drives BOTH down — π (fewer segregating sites) and
// Tajima's D (an excess of rare alleles as new mutations accumulate on the swept
// background), so the Cyp6g1 window shows a joint dip.
//
// THE BASELINE IS NOT ZERO AND THE FIGURE MUST NOT BE READ AS IF IT WERE.
// Roughly three quarters of the windows flanking the sweep sit ABOVE zero, at a
// median near +0.5. Two things put it there, both of them methodological and
// both signed the same way: the DGRP2 callset holds variant sites only, so the
// rare alleles that filtering takes first are the ones D is most sensitive to;
// and the lines are inbred with homozygous diploid calls, so vcftools reads 2n
// chromosomes off n lines (the VCF's own AN is twice its NS) and scales
// Watterson's estimator by the harmonic number of the doubled count, which is
// ~10% small and moves D up by a few tenths on its own. What survives both is
// the excursion against local background, which is all the caption claims.
const TAJD_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'tajd_all',
  name: "Tajima's D (whole panel)",
  assemblyNames: ['dm6'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/demos/popgen/tajimad_all.bw',
  },
}

// Called variants per window, column 4 of the same vcftools table pi comes from,
// so it is the same windows over the same calls rather than a second pipeline.
//
// This is the lane that decides between the two readings of a diversity trough,
// and at Cyp6g1 it comes out the informative way. Measured off the pipeline
// table in 20 kb bins across chr2R:12.0-12.4 Mb, per 2 kb window: outside the
// swept span the panel carries 70-100 sites at pi 0.006-0.008, and over
// 12.14-12.18 it carries 18-20 sites at pi 0.0004-0.001. So the site count falls
// about fivefold while pi falls about fifteenfold: the window is still being
// called, and what collapsed is the FREQUENCY of what is called, which is the
// same fact Tajima's D reports as a negative excursion. A window that had simply
// lost calls would take both down together.
const SITES_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'sites_all',
  name: 'Called variants per window',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/demos/popgen/sites_all.bw',
  },
}

// No per-group-pi figure, deliberately. The tutorial documents the
// MultiQuantitativeTrack config for pi_INV.bw + pi_STD.bw, but there is no view
// of it worth publishing: across the inverted region pi_INV/pi_STD sits at
// 0.7-0.9 and only reaches 0.38 in one 200 kb bin near the distal breakpoint
// (measured off the pipeline bedGraphs). Every framing tried — whole arm,
// multirowxy, a 0-0.012 heatmap zoomed to the strongest trough — produced two
// rows a reader cannot tell apart. Fst is the signal that reads; leave the
// contrast to the prose rather than shipping a figure that shows nothing.

// The same inversion as per-sample SV calls: one <INV> record spanning the
// published breakpoints, genotyped across every karyotyped DGRP line. This is the
// per-sample counterpart to the Fst scan — the scan says the arrangement is
// differentiated, this says WHO carries it.
//
// LinearMultiSampleVariantDisplay, NOT the matrix display. Matrix mode evenly
// spaces one column per variant, which is what you want for many SNPs and wrong
// for a single call with real genomic extent: the column would carry no
// positional meaning. This display draws each genotype at the call's true span,
// so the carrier block starts and ends at the breakpoints and lines up under
// the Fst plateau and the inversion-extent bar.
//
// groupBy orders the rows so carriers and standard lines are contiguous (without
// it the rows keep VCF column order); colorBy paints the sidebar strip. Both live
// on the track's own displays array, not the view's tracks entry, or they'd be
// dropped and the display would fall back to schema defaults.
const IN2LT_SV_TRACK = {
  type: 'VariantTrack',
  trackId: 'dgrp_In2Lt_sv',
  name: 'In(2L)t genotyped across DGRP lines',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://jbrowse.org/demos/popgen/dgrp_In2Lt_sv.vcf.gz',
    samplesTsvLocation: {
      uri: 'https://jbrowse.org/demos/popgen/dgrp_In2Lt_samples.tsv',
    },
  },
  displays: [
    {
      type: 'LinearMultiSampleVariantDisplay',
      groupBy: 'karyotype',
      colorBy: 'karyotype',
      // The carrier block has to out-contrast the hom-ref field, and by default
      // it doesn't: hom-ref genotypes paint #CCCCCC, the same gray as an empty
      // canvas, so the figure read as a blank track. featureColor repaints only
      // the alt-carrying cells, leaving ref/no-call alone — exactly the "who
      // carries it" contrast this figure exists for.
      featureColor: '#d95f02',
      // Pinned rather than fit-to-height: 19 carriers out of 180 lines is ~10%
      // of the display whatever its height, and at the old 300px that was 30px
      // holding 19 rows — 0.33px each, which aliased into a smear instead of
      // rows. 2px/row keeps the carrier block thick enough to show individual
      // lines without spending 480px of figure on the featureless hom-ref
      // field. 360 = 180 * 2, so nothing scrolls out of the capture.
      rowHeight: 2,
      height: 360,
    },
  ],
}

export const popgenSpecs: ScreenshotSpec[] = [
  // Genome-wide (all six dm6 arms): the In(2L)t Fst track rises into a tall
  // elevated block over the inverted region of chromosome 2L, while every other
  // arm (2R, 3L, 3R, 4, X) sits at low background Fst. Plotting the whole genome
  // (not just 2L in isolation) is what makes the elevation read AS elevated: the
  // reader sees the 2L signal is genuinely anomalous, not a baseline the eye has
  // nothing to compare against (reviewer). The In(2L)t inversion-extent track
  // marks the 2L segment.
  //
  // THE BLOCK IS WIDER THAN THE BAR ABOVE IT, AND THAT IS THE DATA, NOT A
  // MISDRAWN TRACK. Measured off this capture (region scale calibrated on the
  // separators, ~50.4 kb/px): the plateau runs from the arm's telomeric end to
  // ~14 Mb and then falls to about a third of its height, while the drawn extent
  // is 2.23-13.15 Mb. Differentiation carrying up to 4 Mb outside inversion
  // breakpoints is what Corbett-Detig & Hartl 2012 report, so this replicates
  // the cited paper rather than contradicting the bar. Do NOT caption it as
  // covering the whole arm: the distal ~9 Mb sits at the other arms' level, and
  // it did say that for a while.
  //
  // No π row here, deliberately (reviewer: unclear how it matters). π carries a
  // strong broad arm-scale profile of its own that has nothing to do with the
  // inversion, and the surrounding prose never reads it, so it competed with the
  // one thing this figure exists to show. π has its own figure below, at Cyp6g1,
  // where its dip alongside Tajima's D IS the point.
  {
    mode: 'url',
    name: 'popgen/fst_in2lt_2L',
    url: `${DM6_HUB}&session=${encodeSessionSpec({
      sessionTracks: [IN2LT_INVERSION_TRACK, FST_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          // all six major arms in order, so 2L's elevated Fst reads against the
          // rest of the genome as background
          displayedRegionNames: [
            'chr2L',
            'chr2R',
            'chr3L',
            'chr3R',
            'chr4',
            'chrX',
          ],
          tracks: [
            // inversion extent on top so the Fst block below reads against it
            {
              trackId: 'in2lt_inversion',
              type: 'LinearBasicDisplay',
              height: 40,
            },
            // 240, from 340 (review, on the composed figure: "also make figure
            // more compressed to use y-screen real estate better"). What this
            // lane is read for is a RATIO -- one arm's plateau against five arms
            // of background -- and the ratio is about 3.5:1 here, so it survives
            // a third off the height. The 100 px is most of what pays for the
            // gutter the lineage trapezoid is drawn in.
            {
              trackId: 'fst_in2lt',
              type: 'LinearWiggleDisplay',
              height: 240,
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readySelector: displayPainted('wiggle-display'),
    readyText: 'Fst',
    readyTimeout: 90000,
    // inversion(40) + fst(240) + 2 track headers + ruler/overview + app bar
    viewportHeight: 560,
    settleMs: 14000,
  },

  // Tajima's D + π at Cyp6g1 (chr2R:12,185,667): the two-part hard-sweep signature
  // read against the gene. Both statistics dip together in the swept window — π
  // drops (diversity removed by the hitchhiking haplotype) and Tajima's D goes
  // sharply negative (an excess of rare alleles on the swept background),
  // against the flanking windows either side, NOT against zero; see the
  // baseline note on TAJD_TRACK above. Seeing both drop at the same window is
  // what distinguishes a sweep from a plain low-diversity region.
  {
    mode: 'url',
    name: 'popgen/tajimad_cyp6g1',
    url: `${DM6_HUB}&session=${encodeSessionSpec({
      sessionTracks: [TAJD_TRACK, PI_TRACK, SITES_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          // ~400 kb around the swept window: wide enough that the joint Tajima's
          // D + π trough reads against local background on both sides, tight
          // enough that the highlighted sweep is a large fraction of the view and
          // the gene track thins to where Cyp6g1 is identifiable (at 2 Mb the dip
          // was ~3% of the width and the gene lane a solid wall)
          loc: 'chr2R:12,000,000-12,400,000',
          // band the full swept window (~12.13-12.20 Mb) rather than just the
          // gene body, so it visibly covers the whole joint Tajima's D + π dip
          // (reviewer: highlight the entire dip)
          highlight: [
            {
              refName: 'chr2R',
              start: 12_130_000,
              end: 12_200_000,
              assemblyName: 'dm6',
              label: 'Cyp6g1',
            },
          ],
          // EVERY LANE SHORTER (review: "improve y-screen real estate
          // better"). None of the four had a blank band to cut, so the saving
          // is per-lane and taken where the lane's readout survives it:
          //
          // - Tajima's D 200 -> 150. It is the deepest lane, and its axis is
          //   what says it can afford this: the excursion runs +3 to -2 across
          //   a lane autoscaled to those extremes, so a quarter off the height
          //   is a quarter off both halves of a signal that is a shape rather
          //   than a value.
          // - pi 150 -> 120 and sites 120 -> 100: both are read as "does this
          //   fall where the one above it falls", which is a comparison of two
          //   silhouettes.
          // - genes 150 -> 100. This is the lane with real slack. Cyp6g1 and
          //   Cyp6g2 are PINNED to the top row by featureHighlights below, so
          //   the rows the height buys are the ~120 neighbouring CG-number
          //   genes, which are context and not read individually at 400 kb.
          //
          // 620 px of track becomes 485.
          tracks: [
            {
              trackId: 'tajd_all',
              type: 'LinearWiggleDisplay',
              height: 150,
            },
            {
              trackId: 'pi_all',
              type: 'LinearWiggleDisplay',
              height: 120,
            },
            // Under pi rather than over it, so the two are read as a pair and
            // the eye compares how far each falls.
            {
              trackId: 'sites_all',
              type: 'LinearWiggleDisplay',
              height: 100,
            },
            {
              trackId: 'dm6-ncbiRefSeqCurated',
              type: 'LinearBasicDisplay',
              // 115 rather than the 100 the paragraph above budgeted. A gene
              // lane's height only cuts cleanly at a multiple of its row pitch,
              // which is ~28.6 css px here, and 100 cut the fourth row through
              // the middle of its glyphs.
              height: 115,
              showOnlyGenes: true,
              // Name-only highlights: resolveFeatureHighlights boxes the match
              // AND pins it to the top row. Without that Cyp6g1 sits seven rows
              // down a ~120-gene wall of CG numbers, so the one gene the figure
              // is about is the hardest thing in it to find. Pinning also means
              // the track needs no `heightMode: 'grow'`, which grew past the
              // viewport and cut the bottom row of genes mid-glyph.
              featureHighlights: [
                { refName: 'chr2R', name: 'Cyp6g1' },
                { refName: 'chr2R', name: 'Cyp6g2' },
              ],
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readySelector: displayPainted('wiggle-display'),
    readyText: 'Tajima',
    readyTimeout: 90000,
    // tajd(150) + pi(120) + sites(100) + genes(115) + 4 headers + ruler/overview
    // + app bar. 945 - 135 of track.
    viewportHeight: 810,
    settleMs: 12000,
    // WHAT THE JOINT DIP MEANS, and what the third lane rules out (review: "try
    // to also add red text annotation explaining significance").
    //
    // Two pills, and each says something the picture cannot. The first names the
    // locus -- Cyp6g1 is the DDT/insecticide-resistance gene of Daborn et al.
    // 2002, which is why anyone scans here -- and states that a joint fall in
    // both statistics is what a hard sweep looks like. The second is the one
    // that keeps the reading honest: a diversity trough has two explanations,
    // and the sites lane is in the frame to decide between them.
    //
    // NO NUMBERS, per website/CLAUDE.md, and one number in particular stays out:
    // the excursion is against the LOCAL BACKGROUND rather than against zero
    // (see the baseline paragraph on TAJD_TRACK above), so the pill says
    // "against the flanking windows" and leaves the median to the prose, where
    // it can be attributed.
    // PLACEMENT, because this frame has no blank corner and one pill in the
    // wrong place would cover the dip it is about. Each lane's empty region is
    // in a different place and neither is where a pill would normally go:
    //
    // - Tajima's D is signed and autoscaled to +3/-2, so its zero line sits
    //   about three fifths down and the flanks BELOW that line are nearly white
    //   — only the swept window goes deeply negative. fracY 0.63 on the left
    //   flank is therefore the emptiest region in the figure, and it is also
    //   directly beside the red bars it describes.
    // - the sites lane fills from the bottom, so its slack is at the TOP. One
    //   line rather than two for that reason: two would reach the data.
    annotations: [
      {
        type: 'text',
        anchor: {
          track: 'tajd_all',
          locus: 'chr2R:12,008,000',
          fracY: 0.63,
          alignX: 'left',
        },
        text: "Cyp6g1, insecticide resistance. Tajima's D and π both\nfall against the flanking windows: a recent hard sweep.",
        fontSize: 15,
        maxWidth: 440,
      },
      {
        type: 'text',
        anchor: {
          track: 'sites_all',
          locus: 'chr2R:12,008,000',
          // 0.12, not 0.04: the anchor's fracY is taken over the track's whole
          // box, so at 0.04 the pill's top edge landed on the track header's own
          // name row.
          fracY: 0.12,
          alignX: 'left',
        },
        text: 'Called sites hold up, so what fell is allele frequencies',
        fontSize: 15,
        maxWidth: 440,
      },
    ],
  },

  // Whole 2L arm: the windowed Fst scan and the per-line genotypes of the same
  // inversion, stacked. Top is the arrangement's extent, then Fst (the summary:
  // one number per 2 kb window), then one row per DGRP line (who actually
  // carries it). The two blocks are the 161 standard lines over the 19 In(2L)t
  // carriers, and the Fst plateau above them spans exactly the region those 19
  // carry. Whole arm rather than just the inversion so the plateau has flanking
  // background to read against.
  {
    mode: 'url',
    name: 'popgen/in2lt_per_sample',
    url: `${DM6_HUB}&session=${encodeSessionSpec({
      sessionTracks: [IN2LT_INVERSION_TRACK, FST_TRACK, IN2LT_SV_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          loc: 'chr2L',
          tracks: [
            {
              trackId: 'in2lt_inversion',
              type: 'LinearBasicDisplay',
              height: 40,
            },
            // 130, from 160, same review note as the sibling part's lane. This
            // one is context rather than the claim -- the plateau's shape over
            // one arm, read against the genotype block under it -- and the
            // genotype lane below is the one height in this figure that cannot
            // move (see IN2LT_SV_TRACK: rowHeight is pinned at 2 and the lane is
            // 180 * 2, so a shorter lane scrolls carriers out of the capture).
            {
              trackId: 'fst_in2lt',
              type: 'LinearWiggleDisplay',
              height: 130,
            },
            {
              trackId: 'dgrp_In2Lt_sv',
              type: 'LinearMultiSampleVariantDisplay',
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    // One label, on the block that needs naming. It anchors to the genotype
    // track's own rendering container, where row r sits at fracY r/180, so the
    // arrow lands in the middle of rows 161-179 (170.5/180) — without it the
    // carrier block reads as a stray strip at the bottom edge, since 19 of 180
    // rows is a tenth of the track however tall it is. The standard lines above
    // carried a label of their own and it named empty lane: those rows are
    // homozygous reference, so there is nothing there for a callout to point at.
    annotations: [
      {
        type: 'text',
        text: '19 In(2L)t carriers',
        anchor: {
          track: 'dgrp_In2Lt_sv',
          locus: 'chr2L:7,000,000',
          fracY: 0.7,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          track: 'dgrp_In2Lt_sv',
          locus: 'chr2L:7,000,000',
          fracY: 0.78,
        },
        anchor: {
          track: 'dgrp_In2Lt_sv',
          locus: 'chr2L:7,000,000',
          fracY: 0.947,
        },
      },
    ],
    readySelector: displayPainted('variant-display'),
    readyText: 'In(2L)t genotyped',
    readyTimeout: 120000,
    // inversion(40) + fst(130) + genotypes(360) + 3 track headers + ruler and
    // overview + app bar. Undersize this and the rows below the fold are simply
    // cropped away, silently: the genotype canvas still reports first paint, so
    // the capture succeeds with the informative rows missing.
    viewportHeight: 830,
    settleMs: 12000,
  },

  // The two halves of the inversion, stacked, because neither reads without the
  // other. The arm-level half alone cannot say who carries the arrangement --
  // Fst is one number per window, and a window has no samples in it. The
  // per-line half alone cannot say the block is unusual, because a single arm
  // drawn on its own has no background: the whole point of the plateau is that
  // every OTHER arm sits at the bottom of the same axis.
  //
  // WHY THE MOSTLY-GREY GENOTYPE LANE IS THE RESULT rather than a layout
  // problem to trim, since it looks like one and was once filed as one. The
  // panel is 161 standard lines to 19 In(2L)t carriers, so ~89% of the rows
  // ARE homozygous reference, and `referenceDrawingMode: 'skip'` paints them as
  // the grey field the carriers' block sits on. Shrinking the lane changes the
  // pixel count and not the ratio; the ratio is what says how rare the
  // arrangement is. The block sits at the lane's bottom edge for the same kind
  // of reason: `groupBy: 'karyotype'` orders in dosage order, so the carriers
  // are the last rows there are.
  //
  // The parts stay separate specs rather than becoming one taller session,
  // because they are different VIEWS of the same tracks -- six arms side by
  // side against one arm end to end -- and no single LGV shows both. Each also
  // stays an openable live link through `<Figure links=...>`.
  {
    mode: 'compose',
    name: 'popgen/in2lt_inversion',
    parts: ['popgen/fst_in2lt_2L', 'popgen/in2lt_per_sample'],
    // THE LINEAGE, DRAWN (review: "ideally, show that figure two 'comes from'
    // figure 1 using a 'trapezoid' to show that lineage"). A gutter is what a
    // trapezoid needs to exist in: stacked flush, the two parts' facing edges
    // are the same line and the wedge has no height. 160 in the composition's
    // own px, which is 80 css px of either capture -- paid for out of the two
    // Fst lanes above, so the whole figure comes out shorter than it was.
    gutter: 160,
    // AND A MARGIN DOWN BOTH SIDES (review: "i cant see the left side of the
    // trapezoid"). It was drawn and it was clipped: chr2L is the row's FIRST
    // region, so the wedge's narrow end starts at x 12 and its wide end at x 0,
    // which is a near-vertical line running off the image edge — correct
    // geometry with nowhere to be. 60 px of white each side puts it inside the
    // frame. The slant stays slight, because that is what the data says: the
    // panel this opens is the left end of the row above.
    sideMargin: 60,
    // THE NARROW END IS chr2L'S PANEL IN THE TOP ROW, and it is SOLVED FOR
    // rather than assumed, which is the part worth keeping even though the answer
    // has since become almost the obvious one.
    //
    // The genomic fraction is not automatically the image fraction: chr2L is
    // 23,513,712 of the 133,880,608 bp the top row lays out (chr2L/2R/3L/3R/4/X,
    // off api.genome.ucsc.edu's chromosome list), which is 0.17563 of the DATA
    // AREA, and the data area is whatever the app's own margins leave. The row's
    // five region dividers are five equations for it, and the residuals are what
    // make the pair publishable rather than eyeballed:
    //
    //   x = L + f * W, least squares over
    //   f = .17563 .36451 .57447 .81409 .82415  (cumulative arm shares)
    //   x = 535    1097   1722   2435   2465    (divider columns, 3000 px wide)
    //   -> L = 12.3, W = 2976.0, every divider predicted to within 0.1 px
    //
    // Re-derive by dumping a row of the part PNG through the Fst band and taking
    // the columns dark across it:
    //
    //   convert static/img/popgen/fst_in2lt_2L.png -crop 3000x40+0+600 \
    //     +repage -colorspace gray txt:- | ...
    //
    // AND IT HAS ALREADY MOVED ONCE, which is why the recipe is here. Solved
    // against the previous app this came out L = 160.6, W = 2678.3 — a 160 px
    // left gutter and a matching one on the right — because `displayedRegionNames`
    // fitted through `showAllRegions`, whose 10% margin is framing for "show me
    // everything" and dead frame for a named subset. `fitBpPerPx` fixed that and
    // the data area now fills the frame, so a fraction that was 0.0535-0.2103 is
    // 0.0041-0.1783. Nothing warns about it: the wedge just stops landing on the
    // chr2L/chr2R divider, which is visible in the figure and in nothing else.
    //
    // The wide end is the whole of the bottom part, deliberately: the wedge says
    // "that slice of the row above opens into this panel", and the panel is the
    // thing, not its data area. Its own frame border is 4 px of 3000.
    //
    // No label on it. A trapezoid between a span and a panel is the idiom for
    // "this is that, opened up", and the review's other half was to say less.
    annotations: [
      {
        type: 'trapezoid',
        fromAnchor: {
          selector: '[data-part="0"]',
          fracX: [0.0041, 0.1783],
        },
        anchor: { selector: '[data-part="1"]' },
      },
    ],
  },
]
