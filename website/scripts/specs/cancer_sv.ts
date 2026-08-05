import { SPLIT_VIEW_MENU_LABEL } from '../../../plugins/variants/src/LinearVariantDisplay/labels.ts'
import {
  lgvSession,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'
import { DER3_GENES_TRACK } from './cancer_sv_der3_genes.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the somatic structural variation tutorial (cancer_sv.md).
//
// Two datasets, both hosted under demos/cancer_sv:
//   COLO829 / COLO829BL  melanoma tumour + matched normal, ONT R10 genomic long
//                        reads streamed from the ONT open-data bucket, with the
//                        wf-somatic-variation SV calls and the derivative allele
//                        that scripts/sv_multihop.py reconstructs from them
//   K562                 ENCODE PacBio Iso-Seq plus DepMap's STAR-Fusion calls
//                        and copy-number segments, for the transcript-level view
//
// Point CANCER_SV_BASE at a local `npx serve` of the build output to render
// figures before the demo data is uploaded:
//
//   npx --yes serve -l 8099 --cors cancer_sv_build/demo
//   CANCER_SV_BASE=http://localhost:8099 node scripts/generate-screenshots.ts \
//     --filter cancer_sv
export const CANCER_SV_BASE =
  process.env.CANCER_SV_BASE ?? 'https://jbrowse.org/demos/cancer_sv'

const CONFIG = encodeURIComponent(`${CANCER_SV_BASE}/config.json`)

// The three loci the RARB/BICC1/TRHDE chain joins. Every panel that shows the
// event is built from this one list so a coordinate can't drift between figures.
const HOPS = {
  rarb: 'chr3:25,352,000-25,362,000',
  bicc1: 'chr10:58,715,000-58,720,000',
  trhde: 'chr12:72,271,000-72,276,000',
}

const GENES = 'ncbi_refseq_hg38'
const TUMOUR = 'COLO829_tumor_ont'
const NORMAL = 'COLO829BL_normal_ont'
const SV = 'COLO829_somatic_sv'

// Super-compact reads (COMPACTNESS_PRESETS' featureHeight 1 / featureSpacing 0).
// ONT depth here is 200x tumour / 80x normal, and at the default read height a
// panel shows a dozen rows out of that; the reads carrying the junction are
// below the fold. One row per pixel puts the whole pileup in frame, which is
// what makes the wall of clipping legible as a wall.
const SUPER_COMPACT = { featureHeight: 1, featureSpacing: 0 }

// The two halves of cancer_sv/multihop_reads: the evidence at one breakpoint and
// the chain across all three loci, side by side rather than a screen of figure
// each. `+append` needs them the same height, but not the same width, so the
// tumour/normal half takes the narrower one: a 3.4 kb window with two pileups in
// it says what it has to say in less page than the three-locus chain does.
const MULTIHOP_HEIGHT = 885
const MULTIHOP_WIDTH = 940
const MULTIHOP_NARROW_WIDTH = 660

// K562's Iso-Seq is ~600x over BCR and the split-read subset of it is still
// ~250 rows, so the row height is what decides whether the pileup ends inside
// the figure or behind a scrollbar. Two pixels fits all of it and still leaves
// each read a row the bezier connector can leave from; one merges the rows into
// a solid block and the connectors then fan out of a smear.
const SPLIT_READS = { featureHeight: 2, featureSpacing: 0 }

// The 29 reads realigned to the derivative, in the two figures that carry them.
// Every one of them spans the junctions, so the pileup is 29 rows however it is
// laid out, and at the default row height only two thirds of them are above the
// fold. Five pixels with a gap is the largest row that fits all 29 while leaving
// the mismatch ticks and the clipping (or its absence) visible.
const READS = { featureHeight: 5, featureSpacing: 1 }

// Every COLO829 window in this tutorial falls inside a large intron (RARB,
// BICC1, TRHDE), where the gene track draws one flat line per isoform and no
// exon. Collapsing to the longest coding transcript is what makes the gene NAME
// visible: a top-level feature's floating label is drawn under its glyph and
// reserves no height of its own, so with all isoforms stacked the label lands
// past the bottom of a fixed-height track and is clipped away (verified against
// the live model: the label was in floatingLabelsData at y=313 under a track
// 100px tall). One row puts it back inside the band.
const GENE_TRACK = {
  trackId: GENES,
  geneGlyphMode: 'longestCoding',
  height: 60,
}

// hg38's primary chromosomes, in order, for the whole-genome views. The
// assembly is the full GRCh38 with alts and random scaffolds, and laying those
// out too spends most of the circle on contigs no fusion call touches.
const HG38_MAIN_CHROMS = [
  ...Array.from({ length: 22 }, (_, i) => `chr${i + 1}`),
  'chrX',
  'chrY',
  // 16 kb against 3.1 Gb, so it is a hairline, but ten of the 44 calls end on
  // it, and those arcs are the artefact tail the figure is about
  'chrM',
]

// Triage is the point of the whole-callset figure, so the support level has to
// be visible: StarFusionAdapter puts JunctionReadCount on the feature's score,
// and three calls clear 100 against a tail in single digits.
const FUSION_ARC_COLOR =
  "jexl:get(feature,'score') > 100 ? '#c62828' : '#9e9e9e'"

// The halves of cancer_sv/realigned_reads: the same junction, the same reads,
// read against the reference and against the allele `derive` built from them.
//
// It is the one claim the tutorial makes in prose that no figure drew. The
// derivative figures show the realigned pileup on its own, where "these reads
// cross the junction" is a picture of reads not doing anything in particular;
// what makes it evidence is that the SAME molecules are torn in four against
// hg38. The review asked for it from the other end -- "why are the reads not
// shown using alignmentstrack? that is potentially important" -- and this is
// where the answer is: a real BAM on both sides, `derive`'s own
// `reads_vs_derivative` output on the right. The in-app reconstruction cannot
// be the place, which e7b4f2b29b settled by reverting the lane that tried: its
// allele has no bases, so a read's own sequence never touches it and no
// junction error can show.
//
// The chr3 junction at 25,359,568, which is the first one the allele takes, at
// 380 bp on both sides so a pane's width is the same number of bases. The
// derivative's own coordinate for it is 32,732 (der3_RARB.vs_reference.paf:
// segment 1 is 0-32,732 + -> chr3:25,326,821-25,359,568), and the two windows
// are centred on the pair.
//
// Soft clipping is ON in both panes, which is what makes the comparison
// honest: the right pane is not "clipping hidden", it is the same setting over
// reads that have none to draw.
// The chr3 -> chr10 junction as a 20 bp band in each assembly's own
// coordinates. `derive`'s PAF puts derivative 0-32,732 (+) against
// chr3:25,326,821-25,359,568, so the boundary is the same event at
// 25,359,568 and at 32,732; the band is wide enough to be a mark rather than a
// hairline at 380 bp across a 700 px pane.
const JUNCTION_HL_COLOR = 'rgba(60,65,72,0.12)'
const JUNCTION_HL_HG38 = {
  refName: 'chr3',
  start: 25359558,
  end: 25359578,
  color: JUNCTION_HL_COLOR,
}
const JUNCTION_HL_DER3 = {
  refName: 'der3_RARB_BICC1_TRHDE',
  start: 32722,
  end: 32742,
  color: JUNCTION_HL_COLOR,
}

function realignedReadsPartSpecs(): ScreenshotSpec[] {
  // One height for both, since `+append` pads the shorter pane, and each pane's
  // tracks are then sized to fill it rather than to a round number: both halves
  // of the first render were wrong in opposite directions (the reference pane
  // carried 150 px of blank inside a track taller than its own pileup, the
  // derivative pane cut 97 px off the bottom of the page), which is what the
  // generator's two size reports are for.
  const HEIGHT = 612
  const WIDTH = 700
  return [
    {
      mode: 'url',
      name: 'cancer_sv/realigned_reads_reference',
      viewportHeight: HEIGHT,
      viewportWidth: WIDTH,
      url: lgvSession(CONFIG, {
        assembly: 'hg38',
        loc: 'chr3:25,359,380-25,359,760',
        // The junction itself, in-app rather than as a drawn callout, and the
        // same band in the other pane's coordinates. Both windows put it at 49%
        // of their width, so side by side the two marks line up and a reader
        // compares the same column twice.
        highlight: [JUNCTION_HL_HG38],
        tracks: [
          {
            trackId: TUMOUR,
            showSoftClipping: true,
            // 200x tumour depth: two pixels a row fits the pileup and still
            // leaves the clipped tails' mismatch ticks distinguishable, which
            // one pixel merges into a single coloured block
            featureHeight: 2,
            featureSpacing: 0,
            // the pileup's own size at this row height, measured off the render:
            // taller is blank page under the reads rather than more of them
            height: 410,
          },
        ],
      }),
      readyText: '25,359',
      readyTimeout: 90000,
      settleMs: 15000,
    },
    {
      mode: 'url',
      name: 'cancer_sv/realigned_reads_derivative',
      viewportHeight: HEIGHT,
      viewportWidth: WIDTH,
      url: lgvSession(CONFIG, {
        assembly: 'der3_RARB_BICC1_TRHDE',
        loc: 'der3_RARB_BICC1_TRHDE:32,545-32,925',
        highlight: [JUNCTION_HL_DER3],
        tracks: [
          // the junction has to be marked on this side: with 29 reads running
          // straight through it, nothing in the pileup itself says where it is,
          // and "no read clips here" needs a here
          { trackId: 'der3_segments', height: 70 },
          {
            trackId: 'reads_vs_der3',
            showSoftClipping: true,
            // 29 reads rather than 200, so they get a row an order of magnitude
            // taller than the reference pane's and the pane fills with the
            // same 380 bp of pileup
            featureHeight: 9,
            featureSpacing: 1,
            // all 29 rows, and no more: a height that shows twenty of them puts
            // the rest behind a scrollbar, which reads as a pileup that stops
            height: 300,
          },
        ],
      }),
      readyText: '32,5',
      readyTimeout: 90000,
      settleMs: 15000,
    },
  ]
}

export const cancerSvSpecs: ScreenshotSpec[] = [
  // The event as the reference shows it: every spanning read is torn into four
  // pieces, so the pileup is a wall of clipping at two points 457 bp apart, and
  // the matched normal underneath is flat. That contrast is what makes the call
  // somatic rather than a mapping artefact.
  {
    mode: 'url',
    name: 'cancer_sv/multihop_tumour_vs_normal',
    // this and multihop_split_view are the two halves of
    // cancer_sv/multihop_reads, which +appends them, so the two share a HEIGHT;
    // this half is the narrower of the two
    viewportHeight: MULTIHOP_HEIGHT,
    viewportWidth: MULTIHOP_NARROW_WIDTH,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      // tight enough that both chr3 breakpoints (25,359,111 and 25,359,568) sit
      // near the middle rather than against the right edge
      loc: 'chr3:25,357,600-25,361,000',
      tracks: [
        // no gene track: this window is deep inside RARB's first intron, so the
        // glyph is a line with arrows on it, and the three-locus half of the
        // composed figure already names every gene
        // both breakends, not one and a half: nanomonsv calls the chr12 and the
        // chr10 hop separately here, and each draws three lines (marker, name,
        // the ALT that carries the partner locus). At 60px the second one was
        // sliced through its name with the rest behind the track's own
        // scrollbar, which reads as a rendering fault rather than as a second
        // record.
        { trackId: SV, height: 130 },
        // soft-clipped tails are the whole signal here: with clipping hidden the
        // tumour pileup looks as flat as the normal.
        //
        // Each track is the size of its own pileup at one row per pixel, and
        // MULTIHOP_HEIGHT is set from the total: a taller track here is blank
        // page under the reads rather than more of them. Measured off the
        // render, the pileups draw 259px and 129px, so these are the depths plus
        // a margin and the 70px the SV lane gained came out of the slack.
        {
          trackId: TUMOUR,
          showSoftClipping: true,
          height: 320,
          ...SUPER_COMPACT,
        },
        {
          trackId: NORMAL,
          showSoftClipping: true,
          height: 150,
          ...SUPER_COMPACT,
        },
      ],
    }),
  },

  // The same three loci side by side. Reads that leave one panel arrive in the
  // next, so the chain can be followed panel to panel instead of inferred from
  // breakend brackets.
  {
    mode: 'url',
    name: 'cancer_sv/multihop_split_view',
    viewportHeight: MULTIHOP_HEIGHT,
    viewportWidth: MULTIHOP_WIDTH,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'BreakpointSplitView',
          displayName: 'RARB (chr3) - BICC1 (chr10) - TRHDE (chr12)',
          // `views`, not `init`: the LaunchView handler a session spec goes
          // through takes the panel list flat, while `init` is the
          // config/defaultSession form
          //
          // Read-track heights follow each locus's depth (chr3 is the 200x
          // primary tumour window, the two hops are 60-70x), so a panel is the
          // size of its own pileup rather than 250px of white under a short one.
          views: [
            { loc: HOPS.rarb, readHeight: 140, geneHeight: 45 },
            { loc: HOPS.bicc1, readHeight: 75, geneHeight: 50 },
            // the chr12 window is the one that clears a gene's 5' end, so it
            // stacks TRHDE over TRHDE-AS1 and needs the second row
            { loc: HOPS.trhde, readHeight: 85, geneHeight: 75 },
          ].map(({ loc, readHeight, geneHeight }) => ({
            assembly: 'hg38',
            loc,
            tracks: [
              { ...GENE_TRACK, height: geneHeight },
              { trackId: TUMOUR, height: readHeight, ...SUPER_COMPACT },
            ],
          })),
        },
      ],
    }),
  },

  // The two above as one figure, since they are one event twice: the reads clip
  // at the chr3 breakpoint on the left, and the panels on the right are where
  // the clipped halves went. Side by side rather than stacked, because they are
  // alternative views of the same locus rather than steps of a procedure, and
  // because two screens of pileup down a tutorial page is a lot of page.
  {
    mode: 'compose',
    name: 'cancer_sv/multihop_reads',
    parts: [
      'cancer_sv/multihop_tumour_vs_normal',
      'cancer_sv/multihop_split_view',
    ],
    direction: 'horizontal',
  },

  // How the multi-hop split view is made, since the figure above is a session
  // spec and says nothing about the route ("it is unclear how this multi-hop
  // figure was generated ... capturing the menus and dialogs", review).
  //
  // NOT THE IMPORT FORM. Add -> Breakpoint split view opens a form with one row
  // per panel, and teaching that means teaching a person to type three loci in
  // the right order, which they can only get by reading them off a script's
  // output ("if you are suggesting the user manually constructs the multi-hop
  // one by one, we should try to avoid this", review). The reads already know
  // the loci AND their order, so the route worth showing is the one that reads
  // them: the same reconstruction dialog the next figure uses, with its new
  // `Open as split view` action.
  //
  // Two frames: the dialog over the pileup it scanned, and the split view it
  // built. Stage 1 gates on the picker's own testid rather than a delay, so the
  // capture waits for the SA-chain pass.
  {
    mode: 'url',
    name: 'cancer_sv/multihop_split_view_steps',
    viewportWidth: 1300,
    // 560, not less: the track menu and its Launch view submenu are as tall as
    // they are, and in a shorter viewport the item this spec clicks is below the
    // fold and puppeteer reports it as not clickable rather than as missing
    viewportHeight: 560,
    // the chr3 breakpoint window: every read carrying the chain clips here, so
    // this is where their SA tags are in view to be grouped
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr3:25,357,600-25,361,000',
      tracks: [
        { ...GENE_TRACK, height: 60 },
        // 150, not the 240 the sibling figures use: this height is carried
        // onto every panel of the view the dialog builds, so a tall track here
        // is four tall tracks there and the second frame becomes a scroll
        {
          trackId: TUMOUR,
          showSoftClipping: true,
          height: 150,
          ...SUPER_COMPACT,
        },
      ],
    }),
    stages: [
      {
        actions: [
          trackMenuIcon(TUMOUR),
          { type: 'click', text: 'Launch view' },
          { type: 'click', text: 'Reconstruct derivative allele...' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="derivative-path-candidates"]',
            timeout: 60000,
          },
        ],
      },
      {
        // `button::-p-text(...)`, not a bare text match. The dialog's prose used
        // to name this action too, so a text selector resolved to the paragraph
        // -- an element, which clicks successfully and does nothing. That prose
        // is gone now, but the selector stays: it says which element it means,
        // and the next sentence added to the dialog would put the trap back.
        actions: [
          { type: 'click', selector: 'button::-p-text(Open as split view)' },
        ],
        // the split view it created, under the pileup it was launched from:
        // one panel per segment of the path, four here (the chain returns to
        // chr3), measured off the run's own below-the-fold report
        viewportHeight: 1729,
      },
    ],
  },

  // The in-app reconstruction, in two frames: the candidate list the track menu
  // builds from the reads on screen, then the synteny view that picking one
  // draws. Two stages rather than two figures because the first is only
  // interesting as the thing that produced the second.
  //
  // BOTH frames drive the real UI, and stage 2 in particular must NOT be
  // declared as a session spec. The obvious shortcut is to point it at the
  // der3_* tracks the sections below use, which look like the same picture, but
  // those are sv_multihop.py's output: a polished consensus contig WITH
  // sequence and projected genes. The feature produces a path with neither, at
  // read-derived bounds, in a temporary assembly whose name embeds Date.now()
  // and therefore cannot be named in a spec at all. A frame showing the one
  // while the caption claims the other is the figure asserting a result it does
  // not contain.
  //
  // Stage 1 gates on `derivative-path-candidates`, the picker's own testid, so
  // the capture waits for the reconstruction pass rather than for a timeout.
  // Stage 2's own gate is generic: the staged capture runs waitForDisplayPhases
  // + assertViewsRendered after every stage, and the synteny view publishes
  // data-view-phase like any other. Waiting on its title instead would mean
  // hard-coding a read count no spec can predict.
  //
  // Read height is 240 rather than the ~420 the sibling figures use: after
  // `Draw it` the pileup stays above the view it created, so both have to fit
  // one frame, and here the pileup only has to read as a wall of clipping.
  {
    mode: 'url',
    name: 'cancer_sv/derivative_autogenerated',
    // Both stages are sized to their own content: the picker frame is the
    // dialog over as much pileup as fits behind it, and the result frame is the
    // synteny view the dialog creates plus the pileup it was launched from.
    // They differ by a factor of two, so a shared height leaves one of them
    // padded with page background.
    viewportHeight: 560,
    viewportWidth: 1300,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      // the chr3 breakpoint window: every read carrying the chain clips here,
      // so this is where their SA tags are in view to be grouped
      loc: 'chr3:25,357,600-25,361,000',
      tracks: [
        { ...GENE_TRACK, height: 60 },
        // clipping shown, because the split alignments it marks ARE the input
        // the candidate list is computed from
        {
          trackId: TUMOUR,
          showSoftClipping: true,
          height: 240,
          ...SUPER_COMPACT,
        },
      ],
    }),
    stages: [
      {
        actions: [
          // by trackId, not by the track's display name: the name is the
          // config's to change and this figure is not about it
          trackMenuIcon(TUMOUR),
          // the item sits under `Launch view`, beside `Linear read vs ref`,
          // because it goes in through pushLaunchViewMenuItem. Clicked rather
          // than hovered: CascadingSubmenu opens on either, and the pileup
          // re-lays-out as reads stream, which can move a hovered row out from
          // under the cursor.
          { type: 'click', text: 'Launch view' },
          { type: 'click', text: 'Reconstruct derivative allele...' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="derivative-path-candidates"]',
            // the pass walks every read's SA chain over a 200x ONT pileup
            timeout: 60000,
          },
        ],
      },
      {
        // `Replace current view`, not the dialog's own submit: the
        // reconstruction is anchored on the window the pileup is already
        // showing, so appending it leaves 240px of the same read stack above
        // the answer and pushes the derivative panel's segment labels against
        // the bottom of the frame. Replacing spends the whole frame on the
        // result.
        //
        // The gene track rides along onto the reference panel either way (the
        // dialog carries the launching view's non-alignments tracks, and reads
        // that list BEFORE the replace destroys the view it came from), so the
        // frame still says which genes the path runs through rather than
        // drawing ribbons between two bare axes.
        actions: [{ type: 'click', text: 'Replace current view' }],
        // the synteny view alone, measured off the render: two panels, the
        // ribbons between them and the provenance track under the derivative
        viewportHeight: 660,
      },
    ],
  },

  // The same menu on a different class of event, because the der(3) figure
  // above is one allele and says nothing about whether the reconstruction
  // generalizes. This locus is a fold-back: chr9 runs out at 28,031,837 and
  // resumes INVERTED from 28,059,142, so the allele visits one chromosome twice
  // in opposite orientations and the reference panel shows two windows of chr9
  // rather than three chromosomes.
  //
  // COLO829's calls put a second fold-back 28 bp away (28,031,865 <-> 28,034,469),
  // which is what a breakage-fusion-bridge cycle leaves behind: successive
  // breaks re-anchor at the same point. The picker therefore has two rows here,
  // and they are genuinely two alleles rather than one counted twice -- the
  // contrast the der(3) figure cannot make, since there one row is the whole
  // answer.
  {
    mode: 'url',
    name: 'cancer_sv/foldback_reconstruction',
    viewportHeight: 576,
    viewportWidth: 1300,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      // Only the anchors, not the far side each fold-back returns from. The
      // reconstruction reads SA tags, so the returning arm does not have to be
      // fetched to be reconstructed -- and it must not be: 200x ONT over the
      // whole 40 kb event exceeds the track's byte budget, the pileup renders
      // as `force load` with no reads behind it, and the picker then correctly
      // reports that nothing in the window is supported.
      loc: 'chr9:28,030,000-28,036,000',
      tracks: [
        { ...GENE_TRACK, height: 60 },
        {
          trackId: TUMOUR,
          showSoftClipping: true,
          height: 260,
          ...SUPER_COMPACT,
        },
      ],
    }),
    stages: [
      {
        actions: [
          trackMenuIcon(TUMOUR),
          { type: 'click', text: 'Launch view' },
          { type: 'click', text: 'Reconstruct derivative allele...' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="derivative-path-candidates"]',
            timeout: 60000,
          },
        ],
      },
      {
        // as in derivative_autogenerated above: the result gets the frame, not
        // the pileup it was launched from. Shorter than that figure's because a
        // fold-back's derivative carries two segments rather than four, so the
        // provenance track is one row
        actions: [{ type: 'click', text: 'Replace current view' }],
        viewportHeight: 610,
      },
    ],
  },

  // The reconstruction: the derivative contig on the bottom row against the
  // three reference loci on the top. The two templated inserts are 199 bp and
  // 183 bp, so they are thin ribbons between two thick chr3 arms -- the second
  // of which runs backwards, which is the foldback.
  {
    mode: 'url',
    name: 'cancer_sv/derivative_synteny',
    viewportHeight: 1230,
    viewportWidth: 1600,
    url: sessionSpec(CONFIG, {
      sessionTracks: [DER3_GENES_TRACK],
      views: [
        {
          type: 'LinearSyntenyView',
          displayName: 'Reconstructed derivative allele vs hg38',
          views: [
            {
              assembly: 'hg38',
              // space-separated locstrings put all three loci in one panel, so
              // every ribbon has a target. A single chr3 window would leave the
              // two templated inserts -- the whole point of the figure --
              // pointing at nothing.
              loc: 'chr3:25325000-25361000 chr10:58716500-58718500 chr12:72272000-72274500',
              // the annotation this figure's bottom row is the projection of,
              // in its original coordinates, so the two rows can be read
              // against each other one ribbon at a time. The somatic SV calls
              // are two sections up; here they would only overprint their own
              // breakend labels across the three narrow windows.
              //
              // Taller than the glyphs need: the isoform-collapse chip is
              // anchored bottom-right, and the chr12 window is the rightmost
              // thing in the panel, so the slack is what keeps the chip off
              // TRHDE's label
              tracks: [{ ...GENE_TRACK, height: 95 }],
            },
            {
              assembly: 'der3_RARB_BICC1_TRHDE',
              loc: 'der3_RARB_BICC1_TRHDE:1-39,549',
              // the provenance track says which reference interval each stretch
              // came from; the projected genes say what that stretch is -- the
              // allele carries RARB's first coding exon at 14 kb and comes back
              // to RARB inverted after the two inserts. Same glyph mode as the
              // reference row above, so the pair differs by coordinates alone
              tracks: [
                'der3_segments',
                // seven genes in one coordinate space, and the arm that spans
                // 32 kb of it puts every other one on a row of its own, so this
                // is the tall track in the figure rather than the thin one it is
                // on the reference side
                {
                  ...GENE_TRACK,
                  trackId: DER3_GENES_TRACK.trackId,
                  height: 220,
                },
                // sized to the pileup: 29 spanning reads is 29 rows, and a
                // height that shows twenty of them puts the rest behind a
                // scrollbar, which reads as a pileup that stops
                { trackId: 'reads_vs_der3', height: 290, ...READS },
              ],
            },
          ],
          tracks: [['der3_vs_hg38']],
          drawCurves: true,
          levelHeights: [200],
        },
      ],
    }),
  },

  // The same reconstruction at the scale of the stitching, and the check on it
  // in the same frame. Zoomed onto the ~900 bp where the three junctions sit,
  // the two templated inserts stop being hairlines and become ribbons the same
  // width as the chr3 arms flanking them; the realigned reads under those
  // segments run straight through every join at flat depth, which is only true
  // if the contig is right.
  //
  // The reads are what a separate figure used to carry on its own. Realigned
  // depth means nothing without the segment boundaries to read it against, and
  // those boundaries are this figure, so the two belong in one frame.
  {
    mode: 'url',
    name: 'cancer_sv/derivative_inserts',
    viewportHeight: 1412,
    viewportWidth: 1600,
    url: sessionSpec(CONFIG, {
      sessionTracks: [DER3_GENES_TRACK],
      views: [
        {
          type: 'LinearSyntenyView',
          displayName: 'Two templated inserts join the chr3 arms',
          views: [
            {
              assembly: 'hg38',
              loc: 'chr3:25358900-25359700 chr10:58717380-58717740 chr12:72273040-72273360',
              // the genes each junction lands in, named. All three windows are
              // deep inside an intron, so the glyphs are lines rather than exon
              // stacks, but they answer which gene each piece was taken from
              // without the reader going back to the text
              tracks: [
                { ...GENE_TRACK, height: 75 },
                'hg38-ReferenceSequenceTrack',
              ],
            },
            {
              assembly: 'der3_RARB_BICC1_TRHDE',
              loc: 'der3_RARB_BICC1_TRHDE:32,300-33,400',
              // the projected CDS carries no reading frame -- a junction can cut
              // a codon in half -- so the per-codon shading this window is
              // zoomed in far enough to trigger would be drawn in a frame
              // nothing here establishes
              showAminoAcids: false,
              tracks: [
                'der3_segments',
                // the same annotation as the top row, in the allele's
                // coordinates and under the same glyph mode: the whole chr12
                // insert is a TRHDE coding exon, and on this side it is on the
                // other strand
                {
                  ...GENE_TRACK,
                  trackId: DER3_GENES_TRACK.trackId,
                  height: 130,
                },
                'der3_RARB_BICC1_TRHDE-ReferenceSequenceTrack',
                { trackId: 'reads_vs_der3', height: 250, ...READS },
              ],
            },
          ],
          tracks: [['der3_vs_hg38']],
          drawCurves: true,
          levelHeights: [220],
        },
      ],
    }),
  },

  // How the split view above is opened, since "here is a session that has one"
  // is not an answer to "how was this generated" (review: "it is unclear how
  // this multi-hop figure was generated. if from a series of ui actions, we may
  // want to record this as a series of screenshots for multipart figure,
  // capturing the menus and dialogs. making it as easy as possible is also
  // valuable").
  //
  // The route is the breakend record, not the reads: `View mate -> Open
  // breakpoint split view` on a read is paired-end only (getMateFields), and
  // COLO829's ONT reads carry their partner in an SA tag instead, so on this
  // dataset that item is not in the read menu at all. The VCF route works for
  // any caller's BND.
  //
  // The right-click row it uses is new, and the second half of the note is why
  // (LinearVariantDisplay's breakendMenu.ts). The split view was reachable only
  // through the feature details panel, under whatever INFO the caller wrote --
  // a hundred rows of SnpEff ANN on this VCF, so the link sat below a table the
  // reader has to scroll past to learn it exists. The first version of this
  // figure captured that route and spent two of its four frames on the drawer.
  //
  // r_12_1 is the chr3 -> chr10 junction at 25,359,568, the same one
  // cancer_sv/realigned_reads reads against the allele, so the two figures are
  // about one junction rather than two.
  {
    mode: 'url',
    name: 'cancer_sv/split_view_from_breakend',
    viewportWidth: 1400,
    // The three menu/dialog frames. 612 is what the blank-below report asks
    // for and it is wrong here: the blank it measures is the page under a
    // CENTRED dialog, while the page itself is 667 tall, so 612 clipped the
    // pileup by 55. The result frame gets its own height below.
    viewportHeight: 670,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr3:25,359,318-25,359,818',
      tracks: [
        { trackId: SV, height: 130 },
        { trackId: TUMOUR, height: 300, ...SUPER_COMPACT },
      ],
    }),
    readyText: '25,359',
    readyTimeout: 90000,
    settleMs: 8000,
    stages: [
      {
        // The record right-clicked by its own floating label, not by a viewport
        // coordinate: `overlayElements` gives every clickable label a
        // `feature-<kind>-<text>` testid, so this names the BND record rather
        // than a pixel. The coordinate form was tried first, landed on the
        // overview ruler (which navigates), and the capture died on
        // "Navigating frame was detached" rather than on a wrong-looking frame.
        actions: [
          {
            type: 'rightclick',
            selector: '[data-testid="feature-name-r_12_1"]',
          },
          { type: 'waitForText', text: SPLIT_VIEW_MENU_LABEL },
          { type: 'delay', ms: 1000 },
        ],
        annotations: [{ type: 'box', anchor: { text: SPLIT_VIEW_MENU_LABEL } }],
      },
      {
        // the dialog it opens: which shape of view, before any of it is built
        actions: [
          { type: 'click', text: SPLIT_VIEW_MENU_LABEL },
          { type: 'waitForText', text: 'Split level (top/bottom)' },
          { type: 'delay', ms: 1000 },
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Split level (top/bottom)' } },
        ],
      },
      {
        // and its second step, which is where the window each panel opens at
        // comes from -- the one setting that decides whether the junction is
        // legible in the result
        actions: [
          { type: 'click', text: 'Split level (top/bottom)' },
          { type: 'waitForText', text: 'Window size (bp)' },
          { type: 'delay', ms: 1000 },
        ],
        annotations: [{ type: 'box', anchor: { text: 'Window size (bp)' } }],
      },
      {
        // The result, loaded as a session rather than clicked out of the dialog
        // -- the harness's own `stage.url` case for "this frame is a RESULT
        // rather than a step". Driving the last click was tried three ways and
        // each failed differently: `.MuiDialogActions-root button` takes the
        // FIRST button (Back), a `button::-p-text(Open)` compound matched Back
        // too, and a plain `Open` left a second copy of the dialog standing at
        // its first step -- the menu item queues one, and the click helper's
        // covered-element fallback can dispatch twice, so the queue holds two.
        //
        // The panels are what the dialog builds from this record at its default
        // 5 kb window: each breakend +/- 5 kb, both tracks copied onto both
        // panels (Copy tracks / Mirror, checked in the frame above).
        url: sessionSpec(CONFIG, {
          views: [
            {
              type: 'BreakpointSplitView',
              displayName: 'RARB (chr3) - BICC1 (chr10)',
              views: [
                {
                  assembly: 'hg38',
                  loc: 'chr3:25,354,568-25,364,568',
                  tracks: [
                    { trackId: SV, height: 90 },
                    { trackId: TUMOUR, height: 260, ...SUPER_COMPACT },
                  ],
                },
                {
                  assembly: 'hg38',
                  loc: 'chr10:58,712,464-58,722,464',
                  tracks: [
                    { trackId: SV, height: 90 },
                    { trackId: TUMOUR, height: 260, ...SUPER_COMPACT },
                  ],
                },
              ],
            },
          ],
        }),
        // the connections, not a delay: the overlay publishes
        // `<trackId>-loaded` only once a read has matches on both panels, which
        // is the whole content of this frame
        readySelector: `[data-testid="${TUMOUR}-loaded"]`,
        // sized off the run's own clipped-below-the-fold report, twice: 900 cut
        // 109 px off the bottom panel's pileup and 1010 still cut 55
        viewportHeight: 1070,
      },
    ],
  },

  ...realignedReadsPartSpecs(),
  {
    mode: 'compose',
    name: 'cancer_sv/realigned_reads',
    parts: [
      'cancer_sv/realigned_reads_reference',
      'cancer_sv/realigned_reads_derivative',
    ],
    // Side by side, because the two panes are the same reads in two coordinate
    // systems rather than two steps of a procedure. Stacked, the second would
    // read as what happened next.
    direction: 'horizontal',
  },

  // K562: the caller's whole output at once, as chords on a circle. Every call
  // is a chord from its left breakpoint to its right, so the two reciprocal
  // chr9<->chr22 calls (BCR--ABL1 and NUP214--XKR3, the Philadelphia
  // translocation from both sides) cross the middle in red while the artefact
  // tail runs into chrM.
  //
  // Circular rather than a whole-genome linear view: laid out linearly the same
  // 44 arcs all bow the same way and overlap into a single grey mat, and the
  // ones worth reading are the tall ones, which are also the ones most
  // overdrawn. On a circle a chord's length is its span and the crossings sit in
  // the middle, away from the chromosome names.
  //
  // TWO circles, side by side, not one (review: "i still think it would be
  // useful to make a multi-part figure. the circular view is generally not that
  // strong on its own"). Triage is a narrowing, and one circle can only show the
  // wide end of it. The second is the same track on a circle of chr9 and chr22
  // alone -- which is what a reader does next, and is a `displayedRegionNames`
  // change rather than a new file. On it the reciprocal pair is two chords
  // across an otherwise empty circle, the artefact tail is gone with chrM, and
  // the chord ends land on 9q34 and 22q11 where the next two figures work.
  //
  // Not a filtered circle, which would have been the other way to narrow:
  // ChordVariantDisplay has four config slots (onChordClick and three stroke
  // colors) and no `jexlFilters`, so support is expressible as a COLOR here and
  // not as a filter. That is also why the left circle carries the color
  // expression and the right one still does -- the two red chords are the same
  // two on both.
  ...(
    [
      [
        'cancer_sv/k562_fusion_circle_all',
        HG38_MAIN_CHROMS,
        'All 44 calls, every chromosome',
      ],
      [
        'cancer_sv/k562_fusion_circle_pair',
        ['chr9', 'chr22'],
        'The same track on chr9 and chr22 alone',
      ],
    ] as const
  ).map(([name, regions, label]) => ({
    mode: 'url' as const,
    name,
    // square-ish, so two of them side by side is one wide frame rather than two
    // tall ones with the drawing floating in the middle
    viewportHeight: 800,
    viewportWidth: 760,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'CircularView',
          assembly: 'hg38',
          displayedRegionNames: regions,
          // the circle auto-fits its container, so this is the drawing's size
          height: 720,
          tracks: [
            { trackId: 'K562_star_fusion', strokeColor: FUSION_ARC_COLOR },
          ],
        },
      ],
    }),
    annotations: [
      { type: 'text' as const, x: 24, y: 56, fontSize: 20, text: label },
    ],
  })),
  {
    mode: 'compose',
    name: 'cancer_sv/k562_starfusion_triage',
    parts: [
      'cancer_sv/k562_fusion_circle_all',
      'cancer_sv/k562_fusion_circle_pair',
    ],
    direction: 'horizontal',
  },

  // BCR beside ABL1 in one row, the way FusionInspector lays a fusion out: two
  // displayed regions in a single view rather than two stacked panels, each
  // window centred on its own STAR-Fusion breakpoint and banded there. Iso-Seq
  // coverage is the thing to read: it steps down at the BCR band and up at the
  // ABL1 band, so the transcript's exons come from BCR up to the junction and
  // from ABL1 after it.
  //
  // One level rather than a breakpoint split view: that view stacks the partners
  // one above the other and runs its splines down the page between them, which
  // is a second screen of figure for the same read set. Side by side, the same
  // splines run across the gap the fusion actually closes.
  {
    mode: 'url',
    name: 'cancer_sv/k562_bcr_abl_split',
    viewportHeight: 1030,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr22:23,286,000-23,293,000 chr9:130,851,000-130,858,000',
      // the two breakpoints the DepMap STAR-Fusion call reports for BCR--ABL1,
      // one band each, so the coverage step has a marked position to sit on
      highlight: [
        { refName: 'chr22', start: 23_290_313, end: 23_290_513 },
        { refName: 'chr9', start: 130_853_964, end: 130_854_164 },
      ],
      tracks: [
        { ...GENE_TRACK, height: 90 },
        // Only the split alignments: a read whose chr22 alignment has a chr9
        // supplementary is the fusion's own support, and dropping the reads that
        // stay on one chromosome leaves a pileup whose every row crosses the
        // junction. Bezier connectors then join each read's two alignments, so
        // the fan between the two regions is that read set, read by read.
        {
          trackId: 'K562_isoseq',
          height: 700,
          coverageHeight: 190,
          showBezierConnections: true,
          showOnlySplitAlignments: true,
          ...SPLIT_READS,
        },
      ],
    }),
  },

  // Where the amplified copies came from: chr22q11 beside chr9q34, one region
  // each, with the fusion calls drawn as arcs across the pair. Both regions step
  // up in copy number, and the arcs land on the two steps' inner edges, so the
  // amplified unit is the piece of chr22 plus the piece of chr9 the junctions
  // join, not either chromosome on its own.
  //
  // Two regions rather than the chr9 window alone: an arc is only drawn when
  // both of its endpoints resolve through `view.bpToPx`, so with chr9 by itself
  // the copy-number step has nothing pointing at it and the figure asserts the
  // link in its caption instead of showing it.
  //
  // The arcs carry mate-direction ticks, now that StarFusionAdapter states
  // which side of each breakpoint the fusion keeps: the tick runs from the
  // breakpoint out over the retained sequence, so the pair of them says which
  // piece of chr9 the junctions cut out. Without them an arc says two positions
  // are joined but not how, which is what review could not read here.
  //
  // NO RNA LANE, though review asked whether one would help, and this was
  // measured rather than assumed. K562_isoseq over these three windows is a
  // 6.22 Mb fetch against the default gate, so the lane renders as its
  // too-much-data banner instead of coverage; and even force-loaded, 1.25 Mb of
  // window across ~1500px puts an Iso-Seq exon under a pixel. The RNA reading of
  // this junction is cancer_sv/k562_bcr_abl_split, one section up, at the zoom
  // where a transcript is resolvable.
  {
    mode: 'url',
    name: 'cancer_sv/k562_cn_amplicon',
    viewportHeight: 780,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr22:16,700,000-16,950,000 chr9:130,600,000-131,350,000 chr22:23,150,000-23,400,000',
      tracks: [
        { ...GENE_TRACK, height: 70 },
        { trackId: 'K562_cn', height: 130 },
        {
          trackId: 'K562_star_fusion',
          type: 'LinearPairedArcDisplay',
          height: 290,
          color: FUSION_ARC_COLOR,
        },
      ],
    }),
  },
]
