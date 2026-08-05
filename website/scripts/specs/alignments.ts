import { heightModeLabel } from '../../../plugins/linear-genome-view/src/BaseLinearDisplay/models/heightMode.ts'
import {
  DEMO_CONFIG,
  HG002_NANOPORE_HP_TRACK,
  VOLVOX,
  VOLVOX_SV_CRAM_ADAPTER,
  lgvSession,
  menuCascade,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The menu label for `fit`, straight from the shared option table, so the click
// path and the boxed annotation below can't drift from the menu.
const FIT_LABEL = heightModeLabel('fit', 'read')

// The surfeit locus, the most tightly-packed gene cluster in the vertebrate
// genome, with genes on alternating strands (RPL7A +, SURF1 -, SURF2 +, SURF4 -)
// sharing bidirectional promoters. The two halves are the same reads under the
// two colorings, which is the comparison the section is about: without the
// per-read strand there is nothing in the pileup that says which of two abutting
// genes a read came from.
//
// This was one frame with the Color by... -> Paired end -> First of pair strand
// cascade open over it, teaching the click path and its result at once. The
// cascade is three menus wide and covered most of the pileup underneath, so the
// result had nowhere to show. The click path is not lost: it is in the recipe
// dialog beside the figure's live links, derived from `colorBy` on the session.
//
// Both colorings are written into their own session (never driven by a menu),
// so each half's live link opens the state it shows.
function strandSpecificParts(): ScreenshotSpec[] {
  const part = (
    name: string,
    colorBy: { type: string },
    label: string,
  ): ScreenshotSpec => ({
    mode: 'url',
    name,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr9:136,214,000-136,229,000',
      trackLabels: 'offset',
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          type: 'LinearAlignmentsDisplay',
          colorBy,
          coverageHeight: 90,
          height: 330,
          maxHeight: 2000,
          minSashimiScore: 3,
        },
      ],
    }),
    readyText: 'RPL7A',
    readyTimeout: 60000,
    settleMs: 15000,
    // the gene track, the sashimi/coverage band and the pileup, with no room to
    // spare: two of these stack into one figure
    viewportHeight: 668,
    hideTooltip: true,
    annotations: [
      { type: 'text', x: 24, y: 56, fontSize: 22, maxWidth: 700, text: label },
    ],
  })
  return [
    part(
      'rnaseq/strand_specific_default',
      { type: 'normal' },
      'Default coloring: strand is not in the picture',
    ),
    part(
      'rnaseq/strand_specific_pair',
      { type: 'firstOfPairStrand' },
      'Color by first of pair strand',
    ),
  ]
}

export const alignmentsSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'volvox_alignments',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram_alignments'],
    }),
    viewportWidth: 1000,
    viewportHeight: 550,
    readyText: 'ctgA',
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'sequence_track',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:20000-20050',
      tracks: ['volvox_refseq'],
    }),
    viewportWidth: 1100,
    viewportHeight: 400,
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'waitForText', text: 'Open track selector' },
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
    ],
  },

  {
    mode: 'url',
    name: 'alignments_soft_clipped',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:2615-2725',
      tracks: [
        {
          trackId: 'volvox-long-reads-sv-bam',
          type: 'LinearAlignmentsDisplay',
          showSoftClipping: true,
        },
      ],
    }),
    readyText: 'ctgA',
    // wider window per reviewer, shorter height to trim empty space below pileup
    viewportWidth: 900,
    viewportHeight: 450,
    settleMs: 4000,
    // soft-clip overhang renders dense per-base sequence letters, far more
    // glyphs per pixel than a typical track-label spec, so sub-pixel
    // glyph-positioning jitter (see DEFAULT_DIFF_THRESHOLD comment) adds up to
    // ~1.5% here instead of ~0.2%
    diffThreshold: 0.02,
  },

  // Read cloud display on the volvox synthetic-SV CRAM: mates are
  // laid out on the Y axis by the log distance between them, so insertion pairs
  // (drawn pink) separate from background. Each pair renders as two colored
  // squares at the read positions joined by a black connector line (the
  // arcMarker pass; see arc.slang / drawCanvas.ts) — the classic read-cloud look.
  // Drawn below the coverage band (readConnectionsDown) so the cloud doesn't
  // overlap the coverage histogram. Read arcs in an SV context are shown by the
  // multi-sv-trio spec.
  //
  // The two contigs carry different synthetic SV signatures (verified via
  // `samtools view -T volvox.fa volvox-sv.cram <ctg>`):
  //   ctgA — a normal FR band (~450 bp insert) plus a cluster of long-insert
  //     (~32 kb TLEN) deletion pairs and short-insert pairs, so its cloud spreads
  //     from the y=0 baseline up to the deletion signal — the rich read-cloud story.
  //   ctgB — ALL pairs are RL/outward-facing (mates point outward, the teal
  //     "RL" class) at a narrow 300-550 bp insert, an inversion-style signature.
  //     There are zero normal small-insert pairs, so the ctgB cloud is one flat
  //     RL band with nothing at the y=0 baseline — that empty baseline is the
  //     data, not a layout gap (the pileup below still fills from row 0).
  {
    mode: 'url',
    name: 'alignments/read_cloud',
    url: sessionSpec(VOLVOX, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'volvox_sv_cram_linked',
          name: 'volvox-sv read cloud',
          assemblyNames: ['volvox'],
          adapter: VOLVOX_SV_CRAM_ADAPTER,
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          // whole-genome zoom-out (both ctgA + ctgB): no `loc`, so afterAttach's
          // showAllRegionsInAssembly lays out the entire assembly — a wider zoom
          // than the single ctgA contig, so the read cloud reads as a compact
          // cluster with room around it (reviewer wanted to see it zoomed out past
          // the data's own extent). Local volvox assembly loads instantly, so the
          // showAllRegions call doesn't race a remote fetch.
          tracks: [
            {
              trackId: 'volvox_sv_cram_linked',
              type: 'LinearAlignmentsDisplay',
              readConnections: 'cloud',
              readConnectionsDown: true,
              // color the cloud by both insert size and orientation:
              // short-insert pairs always paint pink (overriding orientation,
              // so the insertion-supporting cluster stands out from the grey
              // normal background even though it's RR-oriented), while
              // long-/normal-insert pairs paint by their pair type. The arc
              // palette uses a saturated short-insert pink so the thin cloud
              // lines stay visible.
              arcColorByType: 'insertSizeAndOrientation',
              colorBy: { type: 'insertSizeAndOrientation' },
              // legend on (reviewer): the cloud leaves enough empty space that
              // the floating legend keys the insert-size/orientation colors
              // without obscuring the reads
              showLegend: true,
              coverageHeight: 100,
              readConnectionsHeight: 100,
              height: 600,
              forceLoad: true,
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    viewportHeight: 520,
    settleMs: 25000,
  },

  // Soft clipping, two-stage figure: top frame opens the track menu's "Show..."
  // submenu with "Show soft clipping" boxed — soft clipping is NOT yet enabled,
  // so the reads render normally (clipped bases hidden). Bottom frame clicks the
  // item, enabling soft clipping and closing the menu, so it teaches cause→effect
  // (stage 1 must be the not-yet-enabled state, stage 2 the result with
  // no menu open). Combines the old separate menu + result screenshots.
  {
    mode: 'url',
    name: 'alignments_soft_clipped_menu',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      // zoomed in toward the soft-clip breakpoint
      loc: 'ctgA:2670-2730',
      tracks: ['volvox-long-reads-sv-bam'],
    }),
    readyText: 'ctgA',
    // wider + taller per reviewer request so the menu cascade and result-frame
    // pileup both have room
    viewportWidth: 1100,
    viewportHeight: 620,
    settleMs: 4000,
    // result frame renders dense per-base sequence letters in the soft-clip
    // overhang (see alignments_soft_clipped's diffThreshold comment)
    diffThreshold: 0.02,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Show...', 'Show soft clipping']),
        ],
        // box both the parent "Show..." submenu and the "Show soft clipping"
        // item it opens (reviewer asked to also circle "Show...")
        annotations: [
          { type: 'box', anchor: { text: 'Show...' } },
          { type: 'box', anchor: { text: 'Show soft clipping' } },
        ],
      },
      {
        // click the boxed item to actually enable soft clipping. It's a
        // promotable toggle with keepMenuOpen, so the menu stays up after the
        // click — Escape dismisses it for the result frame.
        actions: [
          { type: 'click', text: 'Show soft clipping' },
          // two levels to dismiss: the "Show..." submenu, then the track menu
          { type: 'press', key: 'Escape' },
          { type: 'press', key: 'Escape' },
          { type: 'waitForText', text: 'Show soft clipping', hidden: true },
          { type: 'waitForText', text: 'Show...', hidden: true },
          // the track menu icon keeps focus after the menu closes, so its
          // "Track settings" tooltip stays up; a click on empty page below the
          // view blurs it and parks the cursor away from any read
          { type: 'click', selector: 'body' },
          { type: 'hover', from: { x: 550, y: 605 } },
          { type: 'delay', ms: 2500 },
        ],
      },
    ],
  },

  // Right-click context menu on a read in a LinearAlignmentsDisplay (Open
  // feature details / Copy info / Dotplot of read vs ref / Linear read vs ref).
  // Read glyphs are canvas-drawn, so the rightclick uses a viewport coordinate;
  // a follow-up mouse move off the read clears its hover tooltip.
  // Strand-split coverage: what grouping does to the coverage band itself. The
  // depth split is the obvious half; the half worth a figure is that each band
  // carries its OWN mismatch coloring, because every section's band is computed
  // from only that section's reads (buildGroupResult runs the whole coverage
  // pipeline per group). So the two bands disagree about which positions are
  // colored, and a mismatch on one strand only is the pattern that separates a
  // systematic basecalling error from a real variant.
  //
  // HG002 nanopore, where that pattern is the point: ONT's context/homopolymer
  // errors are systematically strand-specific, so the asymmetry is real signal
  // rather than a prop. Base-level zoom is load-bearing. The same track over
  // 1.2 kb was tried and both bands come back a wall of ticks with nothing
  // legible; at ~55 bp each position is a block wide enough to read.
  //
  // The window was computed, not eyeballed. Eyeballing candidate windows is what
  // produced the earlier, weaker pick: ONT mismatches are frequent enough that
  // every screenshot looks busy, so a genuinely one-sided column does not stand
  // out by inspection. Instead, pileup the demo slices with no reference
  //
  //   samtools mpileup -r <slice> -Q 0 -d 2000 --no-output-ins --no-output-del \
  //     --no-output-ends <bam>
  //
  // (no -f, so mpileup emits literal base letters: UPPERCASE = forward strand,
  // lowercase = reverse), take the overall majority base at each position as the
  // reference, and rank positions by |fwdMismatchFrac - revMismatchFrac| with at
  // least 8 reads on each strand. Of 114k positions with both-strand coverage,
  // 64 exceed 0.75 asymmetry; this window holds two of them pointing in opposite
  // directions, which is what shows the asymmetry is not a property of one band.
  // Rejected: 1:161,184,753 + 1:161,184,793 (a balanced het 40 bp from a 0/82
  // position, the ideal contrast on paper, but the surrounding ONT speckle
  // swamps it at the width needed to hold both).
  {
    mode: 'url',
    name: 'alignments/strand_split_coverage',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG002_NANOPORE_HP_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:55,705,686-55,705,740',
          tracks: [
            {
              trackId: 'hg002_nanopore_hp',
              type: 'LinearAlignmentsDisplay',
              forceLoad: true,
              groupBy: { type: 'strand' },
              showPileup: false,
              coverageHeight: 150,
              height: 340,
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 90000,
    settleMs: 12000,
    viewportHeight: 545,
    hideTooltip: true,
  },

  {
    mode: 'url',
    name: 'linear_align_ctx_menu',
    // sized to the content: the rest of the viewport was page background
    viewportHeight: 499,
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1500-2000',
      // short paired reads from volvox-sv (more interesting than
      // the big long reads the old capture used)
      tracks: ['volvox_sv_cram'],
    }),
    readyText: 'ctgA',
    settleMs: 6000,
    hideTooltip: true,
    actions: [
      { type: 'rightclick', from: { x: 400, y: 250 } },
      { type: 'waitForText', text: 'Open feature details' },
      { type: 'delay', ms: 800 },
    ],
    // clarify the action (it's unclear this menu comes from
    // right-clicking a read). Caption sits over the pileup just left of the menu
    // with a short arrow at the right-clicked read row (y=250 = the click point);
    // JBrowse intentionally clears the hover shading when the context menu opens,
    // so the arrow stands in for the missing highlight.
    annotations: [
      {
        type: 'text',
        x: 165,
        y: 285,
        maxWidth: 180,
        text: 'Right-click any read to open this menu',
      },
      // start the arrow to the right of the text pill (which spans ~x165-345)
      // so the line never crosses the callout box, then point up at the
      // right-clicked read
      { type: 'arrow', from: { x: 365, y: 300 }, to: { x: 392, y: 250 } },
    ],
  },

  // The Filter by dialog (SAM flag bitmask editor), opened by driving the track
  // menu. Illustrates the "Filtering reads" section.
  {
    mode: 'url',
    name: 'alignments/filter_dialog',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_sv_cram'],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'delay', ms: 500 },
      // "Filter by..." is a single item, not a submenu — it opens the
      // flag/tag/read-name dialog directly (menus/filters.ts).
      { type: 'waitForText', text: 'Filter by...' },
      { type: 'click', text: 'Filter by...' },
      { type: 'waitForText', text: 'Filter options' },
      { type: 'delay', ms: 1000 },
    ],
  },

  // Sort by base at a SNP, showing the right-click workflow (reviewer wanted the
  // menu over the SNP captured, not just the declarative result). The view is
  // centered on the ctgA:14481 SNP (a green-A mismatch column) with the reads
  // already sorted by that base, so the variant reads cluster at the top — a
  // right-click there reliably lands on a mismatch and opens the read context
  // menu's "SNP/Mismatch → Sort by base at position" submenu, boxed here.
  {
    mode: 'url',
    name: 'alignments_sort_by_base',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:14470-14500',
      showCenterLine: true,
      tracks: [
        {
          trackId: 'volvox_bam',
          type: 'LinearAlignmentsDisplay',
          sortedBy: {
            // 0-based internal coordinate: the SNP displayed as ctgA:14,481
            // (1-based) is position 14480 internally. Match the base the
            // right-click sort lands on so both figure frames sort identically.
            type: 'basePair',
            pos: 14480,
            refName: 'ctgA',
            assemblyName: 'volvox',
          },
        },
      ],
    }),
    readyText: 'ctgA',
    // narrower window; the rightclick x below is recomputed
    // for this width — the SNP at ctgA:14481 sits at ~0.51 of the 107bp region
    viewportWidth: 1100,
    // crop each stage to the populated header+pileup so the stacked two-frame
    // figure isn't padded by the empty viewport below (shorter window).
    // height 500 gives the right-click context menu breathing room below its last
    // item instead of clipping it at the frame edge (menu cut off)
    crop: { x: 0, y: 0, width: 1100, height: 500 },
    settleMs: 5000,
    hideTooltip: true,
    // two-stage: top frame is the right-click "SNP/Mismatch → Sort by base at
    // position" menu; bottom frame closes the menu to show the resulting sorted
    // pileup (reads carrying the same base at ctgA:14481 grouped together)
    stages: [
      {
        actions: [
          { type: 'rightclick', from: { x: 550, y: 272 } },
          ...menuCascade(['SNP/Mismatch', 'Sort by base at position']),
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Sort by base at position' } },
          // call out that the right-click happens on the variant column itself.
          // Anchored just left of the menu's top item so the label sits next to
          // the context menu instead of off in the corner
          {
            type: 'text',
            anchor: { text: 'SNP/Mismatch' },
            // text-anchor is "start", so x is the box's left edge and the label
            // grows rightward — push it well left so its right edge clears the
            // context menu's left edge instead of overlapping it
            dx: -440,
            dy: -30,
            maxWidth: 270,
            text: 'Right-click a mismatch to sort reads by that base',
          },
        ],
      },
      {
        actions: [
          // actually perform the sort by clicking the boxed menu item so the
          // bottom frame teaches cause→effect (and isn't a stale preset that
          // restored unsorted); the click closes the menu
          { type: 'click', text: 'Sort by base at position' },
          {
            type: 'waitForText',
            text: 'Sort by base at position',
            hidden: true,
          },
          // move the pointer off the pileup so no hover tooltip lingers, then
          // let the re-sort settle and repaint
          { type: 'hover', from: { x: 200, y: 100 } },
          { type: 'delay', ms: 2500 },
        ],
        // make the (subtly-grouped) sort legible: point at the center column
        // where the reads carrying each base at 14481 now stack into one block
        annotations: [
          {
            type: 'text',
            x: 610,
            y: 250,
            maxWidth: 330,
            text: 'Reads sorted by base at this column',
          },
          { type: 'arrow', from: { x: 605, y: 258 }, to: { x: 565, y: 235 } },
        ],
      },
    ],
  },

  {
    mode: 'url',
    name: 'alignments_track_arcs',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      // B2M (plus strand, chr15) — a ubiquitously-expressed housekeeping gene
      // with a single isoform and just 3 introns, so the RNA-seq sashimi arcs
      // are few and clean (GAPDH's many short exons gave "tons of small arcs").
      loc: 'chr15:45,003,000-45,012,000',
      // offset track labels so they overlay the tracks
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          // give the gene track room so the B2M model is clearly visible
          // above the sashimi arcs (gene track too short to see)
          type: 'LinearBasicDisplay',
          height: 120,
        },
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          // flagship sashimi shot: label each junction arc with its supporting-
          // read count, and use 'auto' placement so arcs split above/below by
          // strand instead of all stacking upward. super-compact
          // (featureHeight 1) packs the pileup so it fits in view instead of
          // hitting "Max layout height reached". log coverage scale so a
          // single tall pileup peak doesn't flatten the rest of the coverage
          // histogram behind the arcs.
          //
          // Don't add a featureSpacing here: the inter-read gap is derived
          // from featureHeight by featureSpacingForHeight (0 at or below 3px,
          // 1 above) and is not a config slot, so the display would drop it.
          type: 'LinearAlignmentsDisplay',
          showSashimiLabels: true,
          sashimiArcsMode: 'auto',
          scaleType: 'log',
          featureHeight: 1,
        },
      ],
    }),
    readyText: 'B2M',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  {
    mode: 'url',
    name: 'hic_track',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr8:50,366,343-61,321,733',
      // offset labels so they overlay the tracks
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          // hide gene descriptions so the gene track stays compact next to
          // the Hi-C display
          type: 'LinearBasicDisplay',
          showDescriptions: false,
        },
        'hic',
      ],
    }),
    readySelector: '[data-testid="hic-display-done"]',
    readyTimeout: 60000,
    settleMs: 10000,
  },

  // Two windows on chr8 opened in one view. The matrix is fetched for every
  // PAIR of displayed regions, not just each region against itself, so the
  // block between the two panels carries their cross-region contacts — the
  // same geometry that puts a bright off-diagonal block at a translocation's
  // partner loci. Nothing in the app has to be clicked to get it; it falls out
  // of a multi-region `loc`.
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

  // The same region-pair machinery taken to the whole genome: every chromosome
  // displayed at once, so the fetch is every chromosome against every other one
  // and the picture is the whole pyramid rather than its diagonal.
  // `displayedRegionNames` is the declarative way in — whole chromosomes in the
  // order given, no menu to drive — and it names the 24 main ones so the
  // unplaced and alt contigs don't take a third of the width for slivers too
  // narrow to draw a triangle in.
  //
  // The ramp and the track height are a property of the FILE, not of the view —
  // both are commented where they are set, and both moved when the file did.
  //
  // A FILE WITH INTER-CHROMOSOMAL BLOCKS IN IT (reviewer: "ideally the whole
  // genome hic we use has inter-chromosomal connections"). The demo's own
  // hg19 intra_nofrag_30.hic cannot draw them: its master index (footer at the
  // header's masterIndexPos) holds 26 entries and every one is a self-pair,
  // `0_0` through `25_25`, so the off-diagonal came back empty and the figure
  // taught the geometry rather than the data. jbrowse.org has no whole-genome
  // .hic either -- the only two in the bucket are the HG008-T read-pair maps,
  // which carry inter blocks but only for chr3 and chr13.
  //
  // ENCFF563JTY is GM12878 in situ Hi-C from ENCODE (ENCSR730CER), hg38, .hic
  // v9, and its footer holds 326 entries: 26 self-pairs and all 300 pairs of
  // the 25 chromosomes. Coarsest binsize is 2.5 Mb, which is the one this view
  // asks for. Checked by reading the footer directly rather than by trusting
  // the file name; the same check is what ruled out an ENCODE ChIA-PET matrix
  // that is also shaped like a whole-genome .hic and would have been captioned
  // as Hi-C.
  //
  // hg38 rather than hg19 with it, and the file names chromosomes chr1..chrY,
  // which is the same style as the demo's hg38 (hg38.prefix.fa.gz).
  {
    mode: 'url',
    name: 'hic/whole_genome',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      displayedRegionNames: [
        ...Array.from({ length: 22 }, (_, i) => `chr${i + 1}`),
        'chrX',
        'chrY',
      ],
      trackLabels: 'offset',
      // 700, where the intra-only file needed 100. A pair's contacts are drawn
      // in the wedge between its two regions, so the drawing's height is set by
      // the WIDEST pair on screen: with only self-pairs that was chr1 against
      // itself (~113px of the 1450px genome, so 57px of wedge), and with all
      // 300 pairs answered it is chr1 against chrY, half the genome wide. At
      // 100px the figure was the top slice of that pyramid, which is its
      // faintest, longest-range corner painted at full saturation.
      //
      // Linear ramp, where the intra-only file needed `useLogScale`, for the
      // same reason inverted: log was compensating for a decayed self-contact
      // signal, and applied to a file that fills the whole pyramid it pushes
      // every bin to the top of the scale and the map comes back solid red.
      tracks: [
        { trackId: 'hic_gm12878_encode', useLogScale: false, height: 700 },
      ],
    }),
    // 910, off the run's own clipped-below-the-fold report, for the 700px of
    // track above
    viewportHeight: 910,
    readySelector: '[data-testid="hic-display-done"]',
    // 300 region pairs, and all 300 answer now, where the intra-only file
    // answered 24 of them. Measured serially in node against this file at the
    // 2.5 Mb binsize: 685,098 records in 224s, so the wait is minutes rather
    // than the seconds an intra-only file needed.
    readyTimeout: 900000,
    settleMs: 30000,
  },

  // The two halves of the faint-contacts comparison. Same region, same ramp;
  // the only difference is where the color scale saturates. With
  // useColorPercentile off the diagonal owns the scale (maxScore/20) and the
  // TAD interiors wash out; on (the default) it saturates at the 95th
  // percentile and off-diagonal structure separates from background. Kept as
  // two declarative specs composed below, so each state stays an openable live
  // link and neither can drift from a menu-driving capture.
  //
  // 4.2 Mb, not the 11 Mb the rest of this section is shot on. The setting is
  // about CONTRAST, and at 11 Mb the off half was a blank frame with a red line
  // across the top of it — a comparison whose losing side shows nothing reads as
  // a broken capture rather than as a washed-out scale. Here the TADs are
  // several hundred px wide, so both halves have blocks in them and the
  // difference is that one has edges.
  //
  // Each half carries its own label, because a compose has no annotation layer
  // of its own — the parts are captured separately and appended — and without
  // one the stack needs the caption to say which frame is which.
  ...(
    [
      ['hic/percentile_off', false, 'Show faint contacts OFF'],
      ['hic/percentile_on', true, 'Show faint contacts ON (the default)'],
    ] as const
  ).map(([name, useColorPercentile, label]) => ({
    mode: 'url' as const,
    name,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr8:52,000,000-56,200,000',
      trackLabels: 'offset',
      tracks: [{ trackId: 'hic', useColorPercentile, height: 330 }],
    }),
    // the whole 330px display has to be inside the capture, or the label
    // anchored to the bottom of the track band is drawn off the frame
    viewportHeight: 532,
    readySelector: '[data-testid="hic-display-done"]',
    readyTimeout: 60000,
    settleMs: 10000,
    annotations: [
      {
        type: 'text' as const,
        text: label,
        fontSize: 20,
        // bottom-left of the display, which is the corner of the triangle's
        // bounding box that has no data in it at any zoom
        anchor: {
          track: 'hic',
          alignX: 'left' as const,
          alignY: 'bottom' as const,
        },
        dx: 150,
        dy: -26,
      },
    ],
  })),
  {
    mode: 'compose',
    name: 'hic/faint_contacts',
    parts: ['hic/percentile_off', 'hic/percentile_on'],
  },

  // The on-figure overlay: the color legend and the binsize dropdown, both off
  // by default and both enabled here from config rather than by driving the
  // Show menu. This is the state the docs recommend for baking a chosen
  // resolution into a figure.
  {
    mode: 'url',
    name: 'hic/overlay_controls',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr8:50,366,343-61,321,733',
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'hic',
          showLegend: true,
          showResolutionControls: true,
        },
      ],
    }),
    viewportHeight: 530,
    readySelector: '[data-testid="hic-display-done"]',
    readyTimeout: 60000,
    settleMs: 10000,
  },

  // The same modifications CRAM shown twice in ONE ultra-wide frame — top row in
  // modifications mode (each call drawn at its MM-tag position), bottom row in
  // methylation mode (both modified and reference-CpG-inferred unmodified
  // positions) — over a UCSC CpG island on chr20. Each row is labeled with the
  // mode it is rendered in. The config
  // track (human_chr20_mod_call_5mC_5hmC_CG_cram) supplies the methylation-mode
  // row; a sessionTrack copy with its own trackId supplies the modifications-mode
  // row (the same trackId can't appear twice in a view). The island is
  // hypo-methylated, so the methylation row reads as a blue block. Replaces a
  // hand-curated capture.
  {
    mode: 'url',
    name: 'alignments/modifications2',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'human_chr20_mod_call_5mC_5hmC_CG_cram_modifications',
          name: 'human_chr20_mod_call_5mC_5hmC_CG (CRAM) (modifications)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'CramAdapter',
            cramLocation: {
              uri: 'https://jbrowse.org/genomes/GRCh38/methylation/human_chr20_mod_call_5mC_5hmC_CG.cram',
              locationType: 'UriLocation',
            },
            craiLocation: {
              uri: 'https://jbrowse.org/genomes/GRCh38/methylation/human_chr20_mod_call_5mC_5hmC_CG.cram.crai',
              locationType: 'UriLocation',
            },
            sequenceAdapter: {
              type: 'BgzipFastaAdapter',
              fastaLocation: {
                uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
                locationType: 'UriLocation',
              },
              faiLocation: {
                uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai',
                locationType: 'UriLocation',
              },
              gziLocation: {
                uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi',
                locationType: 'UriLocation',
              },
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          // zoomed out a bit from the old ~20kb window; the ultra-wide viewport
          // keeps roughly the same bp/px so the mod marks stay legible
          loc: 'chr20:19,742,000-19,778,000',
          tracks: [
            // CpG island annotation first (top) so the callout text on the CRAM
            // rows below doesn't cover it
            'cpgisland_ucsc_hg38',
            {
              trackId: 'human_chr20_mod_call_5mC_5hmC_CG_cram_modifications',
              colorBy: { type: 'modifications' },
              // lift the fetch-size gate so the CRAM auto-loads headless
              // instead of sitting on the force-load prompt (same mechanism
              // as the smalldel/multisv specs)
              forceLoad: true,
            },
            {
              trackId: 'human_chr20_mod_call_5mC_5hmC_CG_cram',
              // the methylation view is now modifications + fillUnmarked (the
              // "fill in unmarked cytosines" checkbox): every CpG painted, with
              // implicit-unmethylated ones blue
              colorBy: {
                type: 'modifications',
                modifications: { fillUnmarked: true },
              },
              forceLoad: true,
            },
          ],
        },
      ],
    }),
    readyText: 'CpG',
    readyTimeout: 60000,
    settleMs: 35000,
    hideTooltip: true,
    // no track menu in this frame: the mode radios carry no color swatches at
    // that level, so the open menu covered half the reads to show nothing the
    // row labels don't already say (reviewer). Wide single frame, both rows'
    // full width visible.
    viewportWidth: 2000,
    viewportHeight: 760,
    annotations: [
      {
        type: 'text',
        anchor: {
          selector:
            '[data-testid^="trackRenderingContainer-"][data-testid$="-human_chr20_mod_call_5mC_5hmC_CG_cram_modifications"]',
        },
        dx: 250,
        dy: -60,
        // matches the probability callout's width so the two pills line up
        maxWidth: 340,
        fontSize: 16,
        // Both callouts lead with their menu radio label verbatim (colorBy.tsx).
        // "only" here vs "every CpG" below is the contrast the figure teaches —
        // it's why the island reads empty on this row and blue on the next.
        text: 'One color per modification type: only positions marked in the MM tag',
      },
      {
        // blue is every CpG whose most likely state is unmodified: both the ones
        // the MM tag never called and the ones it called with low probability
        // (reviewer) — the old "CpGs the MM tag left unmodified" claimed only
        // the first.
        type: 'text',
        anchor: {
          selector:
            '[data-testid^="trackRenderingContainer-"][data-testid$="-human_chr20_mod_call_5mC_5hmC_CG_cram"]',
        },
        dx: 250,
        // this callout wraps to several lines, and an anchored text grows
        // downward from the container's mid-line, so it needs the extra lift to
        // clear the frame bottom. The heading is verbatim the menu radio label
        // (colorBy.tsx) — reviewer: name the actual colorBy option, not a "Plus…"
        // paraphrase — so it wraps across two lines at this maxWidth.
        dy: -130,
        maxWidth: 340,
        fontSize: 16,
        text: `One color per type, plus low-probability & unmodified in blue: every CpG painted

- red = methylated
- blue = low probability or unmarked`,
      },
    ],
  },

  // Phased HG002 ONT reads grouped AND colored by the HP tag (alignments_track.md
  // "Sort, color, and filter by tag"). Replaces a 5-stage menu-walkthrough figure
  // with the single end state: groupBy + colorBy HP splits the pileup into one
  // tinted section per haplotype, so the phased reads read at a glance. Same
  // built-in HP grouping the smalldel figure uses, on the same HG002 ultralong
  // ONT track; forceLoad lifts the force-load gate, readySelector waits
  // for the pileup canvas to paint.
  {
    mode: 'url',
    name: 'alignments/haplotype',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG002_NANOPORE_HP_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          // tighter window so the per-haplotype split and the phased
          // variant columns read clearly
          loc: '1:63,005,000-63,008,000',
          tracks: [
            {
              trackId: 'hg002_nanopore_hp',
              type: 'LinearAlignmentsDisplay',
              height: 500,
              forceLoad: true,
              groupBy: { type: 'tag', tag: 'HP' },
              colorBy: { type: 'tag', tag: 'HP' },
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 700,
    settleMs: 15000,
  },

  // Companion to alignments/haplotype: shows HOW to reach grouping — the track
  // menu opened at "Group by..." with its submenu expanded (reviewer wanted a
  // separate figure for the menu path). Choosing "Group by..." opens a dialog
  // where the tag (e.g. HP) is entered. Same HG002 ONT track; reads load via
  // forceLoad, then the menu is driven open and the entry boxed.
  {
    mode: 'url',
    name: 'alignments/haplotype_groupby',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG002_NANOPORE_HP_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:63,005,000-63,008,000',
          tracks: [
            {
              trackId: 'hg002_nanopore_hp',
              type: 'LinearAlignmentsDisplay',
              height: 300,
              forceLoad: true,
              // start ungrouped and uncolored: the figure demonstrates the
              // group-by mechanic itself, so the reads are plain until the
              // dialog is submitted (reviewer: initial state shouldn't already
              // have the color-by/group-by settings applied)
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 550,
    settleMs: 15000,
    hideTooltip: true,
    // Three-stage figure: stage 1 is the menu path (track menu ->
    // Group by... submenu, the inner item boxed); stage 2 is the dialog that item
    // opens, with the Tag dimension chosen and HP entered; stage 3 submits it and
    // shows the RESULT — the pileup split into HP 1 / HP 2 / undefined sections.
    stages: [
      {
        actions: [
          {
            type: 'click',
            selector:
              '[data-testid="track_menu_icon"][data-trackid="hg002_nanopore_hp"]',
          },
          { type: 'waitForText', text: 'Group by...' },
          { type: 'hover', text: 'Group by...' },
          // submenu opened once its items render: "None" is the ungroup radio at
          // the top of the Group by submenu (present even when ungrouped)
          { type: 'waitForText', text: 'None' },
          { type: 'delay', ms: 800 },
        ],
        // box the menu path end to end: the "Group by..." parent and the
        // "Tag..." radio inside it that stage 2's dialog comes from
        annotations: [
          { type: 'box', anchor: { text: 'Group by...' } },
          { type: 'box', anchor: { text: 'Tag...' } },
        ],
      },
      {
        actions: [
          // the Group by submenu is a radio list now; its "Tag..." entry opens
          // the group-by-tag dialog (the common dimensions group directly, no
          // dialog — only Tag needs a name entered)
          { type: 'click', text: 'Tag...' },
          {
            type: 'waitForText',
            text: 'Renders the reads as stacked sections',
          },
          {
            type: 'type',
            selector: '[data-testid="group-tag-name-input"]',
            value: 'HP',
          },
          // let the optional "Found values" tag preview resolve
          { type: 'delay', ms: 1500 },
        ],
      },
      {
        actions: [
          // submit the dialog -> the pileup regroups into HP sections
          {
            type: 'click',
            selector: '[role="dialog"] button[type="submit"]',
          },
          {
            type: 'waitForSelector',
            selector: '[data-testid="pileup-display-done"]',
          },
          { type: 'delay', ms: 2000 },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Alignments track interactions
  // ────────────────────────────────────────────────────────────────────────

  // Compact read drawing on real human data: HG002 Illumina hs37d5 2x250 (high
  // coverage, so the difference compact mode makes is obvious). The display is
  // preset to the compact preset (featureHeight 3) so the pileup is
  // already drawn compact; the track menu is opened to the "Read height"
  // submenu with the now-active Compact option boxed — i.e. the toggled state and
  // the menu path that sets it, in one figure. Remote DEMO_CONFIG data.
  {
    mode: 'url',
    name: 'alignments/compact',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr1:161,172,613-161,181,745',
      tracks: [
        {
          trackId: 'illumina_hg002',
          type: 'LinearAlignmentsDisplay',
          featureHeight: 3,
        },
      ],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    settleMs: 12000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      ...menuCascade(['Read height', 'Compact'], 800),
    ],
    // box both the "Read height" parent submenu and the "Compact" item it opens
    annotations: [
      { type: 'box', anchor: { text: 'Read height' } },
      { type: 'box', anchor: { text: 'Compact' } },
    ],
  },

  // Fit read height, with the menu path that sets it. Was a three-spec
  // before/after compose (fixed + fit, stacked): review rejected all three as
  // "not interesting" and asked for the toggling menu to be open instead, and
  // looking at that figure the call is obvious — two 260px pileups of the same
  // grey HG002 Illumina reads differ only in whether the overflow is behind a
  // scrollbar, which is nearly invisible at figure scale, while two full app
  // chromes ate ~40% of the image. The prose in alignments_track.md already
  // spells out all three modes, so the figure's job is "where do I click", the
  // same job alignments/compact does for the size presets.
  //
  // Labels come from getHeightModeOptions('read') so they cannot drift from the
  // menu; 'Track sizing' is a subheader inside the "Read height" submenu.
  {
    mode: 'url',
    name: 'alignments/height_mode_fit',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr1:161,176,000-161,178,500',
      tracks: [
        {
          trackId: 'illumina_hg002',
          type: 'LinearAlignmentsDisplay',
          heightMode: 'fit',
          height: 260,
        },
      ],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    settleMs: 12000,
    viewportHeight: 560,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      ...menuCascade(['Read height', FIT_LABEL], 800),
    ],
    annotations: [
      { type: 'box', anchor: { text: 'Read height' } },
      { type: 'box', anchor: { text: FIT_LABEL } },
    ],
  },

  // Read connections (arc display): two-stage figure on the volvox-sv CRAM (whose
  // discordant pairs make the arcs meaningful). Top frame: the track menu's "Read
  // connections → Show pair overlay" radio submenu with "Arcs" boxed, drawn over
  // a plain pileup (no arcs yet). Bottom frame: "Arcs" selected, so the arcs
  // render. Cropped to drop the empty viewport below the short track.
  {
    mode: 'url',
    name: 'alignments/select_arc_display',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_sv_cram'],
    }),
    readyText: 'ctgA',
    // shorter viewport (rather than a crop) so the result frame isn't mostly
    // whitespace while still leaving room for the deep "Read connections" submenu
    viewportHeight: 600,
    settleMs: 5000,
    // dismissing the menu leaves the track-menu button hovered, so MUI paints
    // its "Track settings" tooltip into the result frame
    hideSelectors: ['.MuiTooltip-popper'],
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Read connections', 'Show read arcs'], 600),
        ],
        // box only the "Show read arcs" checkbox (this figure is
        // specifically about enabling read arcs)
        annotations: [{ type: 'box', anchor: { text: 'Show read arcs' } }],
      },
      {
        // tick the "Show read arcs" checkbox so the result frame shows arcs,
        // then dismiss the menu — the checkbox stays open after a tick, and the
        // result frame is about the arcs, not about the menu that enabled them
        actions: [
          { type: 'click', text: 'Show read arcs' },
          { type: 'press', key: 'Escape' },
          { type: 'press', key: 'Escape' },
          { type: 'delay', ms: 3000 },
        ],
        // no menu in this frame, so it only has to hold the track
        viewportHeight: 480,
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // RNA-seq tutorial screenshots (use hg19 ACTB region from DEMO_CONFIG)
  // ────────────────────────────────────────────────────────────────────────

  // Whole-gene overview: coverage histogram, strand-colored splice arcs, and the
  // spliced read pileup over ACTB — the anchor figure for "what RNA-seq looks
  // like". minSashimiScore 3 drops the low-support aligner-noise arcs (see
  // compact_stacked below for the rationale).
  {
    mode: 'url',
    name: 'rnaseq/basic',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,567,000-5,570,000',
      trackLabels: 'offset',
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          type: 'LinearAlignmentsDisplay',
          coverageHeight: 120,
          height: 460,
          maxHeight: 2000,
          minSashimiScore: 3,
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
    viewportHeight: 700,
  },

  // Compact read drawing mode: featureHeight 3 packs the full ACTB
  // read stack into view, with maxHeight raised so the whole pileup renders
  // instead of clipping at "Max layout height reached" — that full, dense stack
  // (deep = highly expressed) is the point compact mode makes, and what the
  // reviewer found unclear at the default maxHeight.
  {
    mode: 'url',
    name: 'rnaseq/compact_stacked',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,566,500-5,570,500',
      // offset labels so they overlay the tracks
      trackLabels: 'offset',
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          type: 'LinearAlignmentsDisplay',
          featureHeight: 3,
          maxHeight: 2000,
          // taller SNPCoverage band + shorter pileup viewport + shorter
          // browser: coverageHeight is the LinearAlignmentsDisplay
          // coverage band, the pileup viewport = height - coverageHeight
          coverageHeight: 120,
          height: 420,
          // ACTB's real minus-strand introns have 449/290/29/27/4 reads;
          // the spurious forward-strand sashimi arcs are single-/2-read
          // aligner noise (correct XS-tag strand, just low support). A
          // min-support of 3 drops the noise, keeps the real junctions.
          minSashimiScore: 3,
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
    viewportHeight: 650,
  },

  // Long-read IsoSeq RNA-seq at ACTB.
  {
    mode: 'url',
    name: 'rnaseq/longread_isoseq',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,566,000-5,571,000',
      // offset labels so they overlay the tracks
      trackLabels: 'offset',
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'hg_isoforms.fasta_bam',
          // taller SNPCoverage band: coverageHeight is the
          // LinearAlignmentsDisplay coverage-track height (default 45).
          // super-compact featureHeight=1 so every isoform read
          // stacks in view instead of hitting "Max layout height reached".
          type: 'LinearAlignmentsDisplay',
          coverageHeight: 120,
          height: 620,
          featureHeight: 1,
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
    // tall enough for the 620px compact pileup + the coverage band + chrome
    viewportHeight: 900,
  },

  ...strandSpecificParts(),
  {
    mode: 'compose',
    name: 'rnaseq/strand_specific',
    parts: ['rnaseq/strand_specific_default', 'rnaseq/strand_specific_pair'],
  },

  // Strand-split coverage: grouping splits the coverage band as well as the
  // pileup — each section's band is computed from only that section's reads — so
  // hiding the pileup leaves two histograms sharing one autoscaled axis.
  //
  // NELFE(-) abutting SKIV2L(+) in MHC class III, the most gene-dense stretch in
  // the human genome. The forward band is empty over NELFE and carries all the
  // signal over SKIV2L; the reverse band does the exact opposite, and the switch
  // lands on the gene boundary. One frame beats the RPL7A/ACTB mirror pair this
  // replaces: a two-panel compose shows the fill following the strand only if
  // the reader holds both panels in their head, while the switch inside a single
  // view is the claim itself.
  //
  // firstOfPairStrand, NOT strand: this is a stranded paired-end library, so the
  // transcript strand is which mate the read is. Grouping on the raw read strand
  // sends the two mates of every pair to opposite sections, so neither band is
  // the transcript strand — the same distinction the coloring figure above draws.
  //
  // Found by rendering, not by reputation: gene-dense regions were swept at
  // 400 kb looking for BOTH bands carrying signal, which is the thing that is
  // actually rare, then the candidates zoomed. Rejected along the way, so they
  // are not re-tried: the whole surfeit cluster (RPL7A runs ~100x SURF1, so a
  // linear axis empties the reverse band and a log axis fills both with
  // antisense); SURF1/SURF2 alone (too shallow); GAPDH (intronic spikes over
  // 5000 flatten its own exons); HSPA1L/HSPA1B (a ~9x split and a long dead gap
  // between them); C6orf47/GPANK1 (comparable depth, but antisense over GPANK1
  // muddies the switch).
  {
    mode: 'url',
    name: 'rnaseq/strand_split_coverage',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr6:31,920,500-31,933,000',
      tracks: [
        { trackId: 'ncbi_gff_hg19', type: 'LinearBasicDisplay', height: 90 },
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          type: 'LinearAlignmentsDisplay',
          groupBy: { type: 'firstOfPairStrand' },
          showPileup: false,
          showSashimiArcs: false,
          coverageHeight: 135,
          height: 300,
        },
      ],
    }),
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 90000,
    settleMs: 12000,
    viewportHeight: 620,
    hideTooltip: true,
  },
]
