import { displayPainted } from '@jbrowse/browser-test-utils'

import { heightModeLabel } from '../../../packages/display-kit/src/heightMode.ts'
import {
  DEMO_CONFIG,
  HG002_NANOPORE_HP_TRACK,
  PARK_CURSOR,
  VOLVOX,
  lgvSession,
  menuCascade,
  openTrackSelector,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

// Every Hi-C spec below waits this long, and the number is sized for the sweep
// rather than for the data: solo, each of them reaches its ready selector in a
// few seconds, and the whole block renders in about a minute at concurrency 4 on
// an idle machine. They are contiguous in the spec list, so the pool holds four
// of them at once — four SwiftShader WebGL contact matrices, the heaviest moment
// in the run. On 2026-08-15 the block timed out at 60s each on a box 24 GB into
// swap whose /tmp was a 16 GB tmpfs, 72% full.
//
// Headroom is only half an answer to that. Those pages could not be screenshot
// at all, so `debugDump` wrote no frame and the failure arrived as a bare
// selector timeout — a dead renderer outlasts any budget. This is the half that
// is ours to set. `hic/whole_genome` takes more still: it answers 300 region
// pairs where the others answer one.
const HIC_READY_TIMEOUT = 180000
const HIC_WHOLE_GENOME_READY_TIMEOUT = 240000

// volvox_sv_cram's adapter, used to build the read_cloud session track. Session
// tracks don't inherit the config's baseUri, so an absolute url is used (the
// same volvox test data jbrowse.org hosts) — works in both the local generator
// and the live-link instance.
export const VOLVOX_SV_CRAM =
  'https://jbrowse.org/code/jb2/latest/test_data/volvox'
export const VOLVOX_SV_CRAM_ADAPTER = {
  type: 'CramAdapter',
  cramLocation: {
    uri: `${VOLVOX_SV_CRAM}/volvox-sv.cram`,
    locationType: 'UriLocation',
  },
  craiLocation: {
    uri: `${VOLVOX_SV_CRAM}/volvox-sv.cram.crai`,
    locationType: 'UriLocation',
  },
}

// The menu label for `fit`, straight from the shared option table, so the click
// path and the boxed annotation below can't drift from the menu.
const FIT_LABEL = heightModeLabel('fit', 'read')

// HSV-1 strain 17 and one MinION mRNA run over it, built by
// scripts/build_hsv1_demo.sh. A 152 kb genome with genes packed on both strands
// and a library whose read strand is the transcript's -- see the strand-split
// depth spec for why that combination is what the figure needed.
const HSV1_CONFIG = encodeURIComponent(
  'https://jbrowse.org/demos/hsv1/config.json',
)

// The green-A mismatch column `alignments_sort_by_base` is about: the base the
// session sorts on, the base its right-click has to land on, and the base both
// of its callouts point at. One anchor for all four, resolved against the live
// view — the fracY sits in the pileup below the coverage subtrack, and every
// read row in this column carries the mismatch.
const SORT_COLUMN = {
  track: 'volvox_bam',
  locus: 'ctgA:14,481',
  // Down into the run of three adjacent A rows at the top of the (unsorted)
  // pileup: only a read carrying the mismatch offers "SNP/Mismatch", so this
  // fraction has to land on one of the eleven that do rather than on any read.
  fracY: 0.22,
}

// The frame `alignments/strand_split_coverage` puts around a SINGLE BASE, and
// the reason it is not the default one (review: "thinner and wider red boxes,
// they cover up the variant they are trying to show").
//
// A default box is 5 px of stroke and 6 px of pad, which frames a menu item
// nicely and draws very nearly a solid bar around one base: 250 bp across this
// viewport is ~6 css px a base, the stroke takes 2.5 of the padding back on each
// side, and the ~3 px of white left over is half the width of the column inside
// it. The two strokes then read AS the column and the column reads as the gap
// between them. 2 px of stroke and 8 px of pad leave 7 css px of clear white on
// either side of the base -- more than a base's width of margin, so the column
// is inside a frame instead of under one. `pad` cannot go much past this: the
// two positions this figure marks are 5 bp apart, ~30 css px, so the two boxes
// share that budget with the gap between them, and at 9 the gap closes to ~4 css
// px, which at the width a reader sees this figure is two red lines with a
// hairline between them rather than two marks.
//
// The other half of that complaint was not the stroke at all, and no width would
// have fixed it: a one-coordinate locus used to resolve to the ZERO-WIDTH
// position between two bases for every callout, so the box was centred on the
// column's left edge rather than around the column, and the right-hand stroke
// covered the left of the base. A box now asks for the base itself
// (`parseAnnotationLocus`'s `wrap`), which is the only reason 8 px of pad is
// enough here.
const COLUMN_BOX = {
  type: 'box',
  strokeWidth: 2,
  pad: 8,
} satisfies Partial<Annotation>

// The read `linear_align_ctx_menu` right-clicks, and the read its caption's
// arrow points at. One anchor for both: the figure's whole subject is that the
// menu came from THAT read, so a caption pointing somewhere else is the failure
// to design out.
//
// A depth in px rather than a `fracY`: the pileup packs from the top of the
// track under a coverage band of a fixed `coverageHeight` (45), so 57px is the
// second read row whatever height the display is given, where a fraction of the
// height is only the second row at one height.
const CTX_MENU_READ = {
  track: 'volvox_sv_cram',
  locus: 'ctgA:1633',
  fracY: 0,
  dy: 57,
}

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
// ONE FRAME, not the two-half compose it was (reviewer: "might just skip first
// screenshot, only use second"). The "before" half was the default grey pileup,
// and grey is what every other alignments figure on the site already shows, so
// it spent half the figure's height restating the reader's starting point. What
// makes the coloring legible is the switch landing on the gene boundaries, and
// that is visible in the colored frame alone with the strand arrows over it.
//
// The coloring is written into the session (never driven by a menu), so the
// figure's live link opens the state it shows.
function strandSpecificSpec(): ScreenshotSpec {
  const spec = (
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
        // What reserves the strip the three strand arrows below are drawn in,
        // and BOTH settings are load-bearing. Raising `height` alone does not
        // work: this display grows to its content, so a taller lane packed two
        // more snoRNA rows into the space and the arrows landed on their
        // descriptions again. `heightMode: 'fixed'` is what turns the number
        // into a reservation, and `showLabels: 'name'` drops the blue second
        // line under every feature, which here is four "small nucleolar RNA,
        // C/D box 36x" strings saying nothing the figure is about.
        {
          trackId: 'ncbi_gff_hg19',
          type: 'LinearBasicDisplay',
          showLabels: 'name',
          heightMode: 'fixed',
          height: 150,
        },
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          type: 'LinearAlignmentsDisplay',
          colorBy,
          // 120, not the 90 this had: a log axis prints a tick per power of two
          // rather than three round numbers, and at 90px they overlapped into an
          // unreadable column down the left of the band
          coverageHeight: 120,
          // LOG on the coverage band (reviewer). RPL7A is a ribosomal protein
          // running ~100x the surfeit genes beside it, so on a linear axis its
          // exons are the only thing with height and SURF1/SURF2 read as having
          // no expression at all, which is not what the file says.
          scaleType: 'log',
          height: 330,
          maxHeight: 2000,
          minSashimiScore: 3,
        },
      ],
    }),
    readyText: 'RPL7A',
    readyTimeout: 60000,
    settleMs: 15000,
    // the gene track, the sashimi/coverage band and the pileup
    viewportHeight: 718,
    hideTooltip: true,
    annotations: [
      // Which setting this is, anchored in the gene lane's empty band rather
      // than at the old raw (24, 56) -- that coordinate was chosen when this
      // figure was two stacked halves and each needed naming above its own
      // chrome; on one frame it lands on the app's FILE/ADD/TOOLS menu.
      {
        type: 'text' as const,
        fontSize: 22,
        maxWidth: 700,
        text: label,
        anchor: {
          track: 'ncbi_gff_hg19',
          locus: 'chr9:136,216,000',
          fracY: 0.6,
        },
      },
      // Which way each gene points, said big (reviewer: "make it clear with
      // extra annotation arrows which genes are forward and which are reverse").
      // The gene glyphs already carry per-exon chevrons, but they are 6px marks
      // on a 15 kb frame and the whole section turns on the reader seeing that
      // the middle gene runs the other way from its two neighbours.
      //
      // Anchored on interior coordinates rather than on the gene bounds: the
      // arrow only has to sit unambiguously inside one gene, and a span pinned
      // to a boundary would need re-checking against the annotation release.
      ...(
        [
          ['RPL7A', 136_215_300, 136_218_000],
          // tail right, head left: SURF1 is the minus-strand gene
          ['SURF1', 136_222_900, 136_219_000],
          ['SURF2', 136_223_800, 136_227_500],
        ] as const
      ).map(([, from, to]) => ({
        type: 'arrow' as const,
        strokeWidth: 9,
        fromAnchor: {
          track: 'ncbi_gff_hg19',
          locus: `chr9:${from}`,
          fracY: 0.86,
        },
        anchor: {
          track: 'ncbi_gff_hg19',
          locus: `chr9:${to}`,
          fracY: 0.86,
        },
      })),
    ],
  })
  return spec(
    'rnaseq/strand_specific',
    { type: 'firstOfPairStrand' },
    'Color by first of pair strand',
  )
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
    actions: openTrackSelector('menu'),
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
    viewportHeight: 805,
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
    // pileup both have room.
    //
    // DO NOT TRIM THIS ON THE RUN'S "blank below the last content" REPORT. That
    // measurement looks at the app window, and both menus here are MUI portals
    // drawn over it, so the report sees an empty pileup where the figure's whole
    // subject is. It asked for 141 px at 620 and another 71 at 550; taking the
    // second cut off the bottom of the track menu, losing Sashimi arcs and
    // Launch. Rendered at all three.
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
          PARK_CURSOR,
          // the toggle re-lays out and refetches the pileup, and none of the
          // waits above sees that: they are all about the menu going away
          { type: 'waitForAppSettled' },
        ],
      },
    ],
  },

  // STRAND-SPLIT COVERAGE AS DEPTH, WHICH IS THE OTHER HALF OF THE SETTING.
  // The figure below is about each band's own MISMATCH colouring and cannot
  // show a depth split -- HG002 ONT is WGS and strand-balanced by construction,
  // which is exactly why it is the right data for that claim and the wrong data
  // for this one. So this is a second frame rather than a replacement.
  //
  // A VIRUS, AND NOT RNA-SEQ OF A GENOME (review, three rounds: "i really think
  // we should seek out a viral sample or something that has dramatically diff
  // forward and reverse coverage", then "sorry but we need a new viral coverage
  // example. rnaseq is too crazy"). Two earlier cuts were K562 PacBio Iso-Seq
  // over human loci -- first the alpha-globin cluster, which is one-sided and
  // put a band on the floor, then LUC7L against FAM234A, which flips properly
  // but is 40 kb genes drawn as long thin intron lines with a pileup of
  // isoforms under them. What was wrong with both is the same thing: a
  // vertebrate transcript is mostly intron, so most of the frame is the parts
  // of a gene that carry no reads.
  //
  // HSV-1 has no such problem. 74 genes in 152 kb, packed on both strands,
  // essentially none of them spliced, so a 3 kb window holds two whole
  // neighbouring transcription units and every base of both carries reads.
  // scripts/build_hsv1_demo.sh builds the dataset and prints the split it
  // depends on; the short version is that read strand is transcript strand in
  // this library (ERR2379735, poly(A)-selected mRNA on MinION) and the other
  // nanopore run in the same study is randomly primed and comes back 50/50 in
  // every window, which would draw two identical bands.
  //
  // UL21 AND UL22, NOT THE LOUDEST PAIR IN THE GENOME. US9 against US10-US12 is
  // more extreme -- 1,079 forward against 10, then 3 against 2,567 -- and it is
  // the wrong pick for the same reason the globin cut was: at 2,500 reads the
  // pileup cannot be drawn, and the reviewer has twice asked to see the reads.
  // Here each strand runs ~150 over its own gene and ~5 over its neighbour's,
  // which is the same flip at a depth whose pileup fits under its own band.
  //
  // The switch lands at 43,800, between UL21's 3' end and UL22's. Both are
  // 3'-biased by the poly(A) selection, so each band peaks on the side facing
  // the other -- the two maxima are ~150 bp apart across the boundary, which is
  // what makes the flip read as one event rather than as two separate genes.
  //
  // `colorBy: strand` for the same reason the ONT figure below sets it: the
  // reads are coloured by the dimension the grouping used, so which section a
  // read belongs to is readable off the read.
  {
    mode: 'url',
    name: 'alignments/strand_split_depth',
    url: lgvSession(HSV1_CONFIG, {
      assembly: 'hsv1',
      loc: 'NC_001806.2:41,900-45,300',
      tracks: [
        {
          trackId: 'hsv1_genes',
          // The NCBI GFF3's first record is the whole 108 kb long-unique region
          // as one feature, which packs above the genes and takes the lane the
          // two labels need. Filtering it out leaves UL21 and UL22 on one row,
          // each with an arrow saying which way it is transcribed -- which is
          // the claim the two bands under it make.
          jexlFiltersSetting: ["jexl:feature.type=='gene'"],
          height: 70,
        },
        {
          trackId: 'hsv1_mrna',
          type: 'LinearAlignmentsDisplay',
          // 23 MB of BAM over a 152 kb genome puts every region in one index
          // bin, so the byte gate estimates 7.15 Mb for this 3.4 kb window and
          // draws its own message instead of reads. What actually arrives is
          // ~300 reads.
          forceLoad: true,
          groupBy: { type: 'strand' },
          colorBy: { type: 'strand' },
          // ~150 reads a strand and each one 1-3 kb against a 3.4 kb window, so
          // almost every read gets a row of its own: at 2px the two pileups are
          // ~600px and the bands lose the frame, at 1px they are the strip under
          // each band that the review asked to keep.
          featureHeight: 1,
          coverageHeight: 150,
          height: 700,
        },
      ],
    }),
    // `pileup-display` is the whole alignments display's testid, coverage band
    // included
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 120000,
    settleMs: 12000,
    // off the run's own below-the-fold report
    viewportHeight: 1015,
    hideTooltip: true,
  },

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
          // 250 bp rather than the 55 bp this used to be (reviewer: "please
          // zoom out significantly more"), centered on the same pair of
          // asymmetric positions. The earlier note here rejected a wider
          // window on mismatch-LETTER legibility, which was answering the
          // wrong question: the claim is about the two COVERAGE bands, and a
          // strand-biased position draws as a colored column in one band at
          // any width. What 55 bp cost was the baseline. With no ordinary
          // positions in frame there was nothing for the two columns to be
          // tall AGAINST, and both bands read as a wall of blocks.
          //
          // 250 AND NOT MORE, measured rather than reasoned: 600 bp was tried
          // first, on the theory that ONT's background speckle is low-fraction
          // and would stay at the foot of each bar. It does not. At 600 bp the
          // bands are dense with colored ticks the whole way across and the
          // two positions this window exists for stop being the tallest thing
          // in frame, which is the same failure the 55 bp note was worried
          // about arriving by a different route. At 250 the speckle is a
          // baseline and the asymmetric columns stand clear of it.
          loc: '1:55,705,588-55,705,838',
          tracks: [
            {
              trackId: 'hg002_nanopore_hp',
              type: 'LinearAlignmentsDisplay',
              forceLoad: true,
              groupBy: { type: 'strand' },
              // the reads stay on screen under each band (reviewer: hiding them
              // is confusing), colored by the same dimension the grouping used —
              // so the section a band belongs to is readable off the reads
              // themselves rather than only off the group label
              colorBy: { type: 'strand' },
              // ~12 reads per strand here, so the pileup is short whatever it is
              // given: at the compact 3px it drew as a solid pink and a solid
              // purple stripe with no reads in it
              featureHeight: 9,
              coverageHeight: 110,
              height: 480,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    settleMs: 12000,
    viewportHeight: 690,
    hideTooltip: true,
    // THE COLUMN, MARKED (review: "it might be good to make this screenshot on
    // an example that has dramatic differences between strandedness e.g. on
    // viral sample"). The dramatic thing is here and the frame was making a
    // reader find it: `scripts/rank_strand_asymmetry.py` scores every position
    // in this window and 1:55,705,711 is 0.00 mismatch across 12 forward reads
    // and 1.00 across 10 reverse ones -- as one-sided as it gets, and the next
    // position down is 0.40. A real variant is carried by both strands, so a
    // column present in one band and absent from the other is a basecalling
    // artifact; that is the whole figure, and now it is pointed at.
    //
    // The reviewer's own example is a claim about DEPTH rather than mismatches,
    // and it is a different figure: `alignments/strand_split_depth` above,
    // which is the viral one they asked for twice more after this note (HSV-1
    // UL21 against UL22), with `rnaseq/strand_split_coverage` making the same
    // claim on a human pair. ONT WGS cannot produce a depth split -- it is
    // strand-balanced by construction, which is exactly why it is the right
    // data for this one and the wrong data for that one.
    //
    // The box takes no `fracY`, so it wraps the whole track band and crosses
    // both coverage histograms and both pileups at once, which is the
    // comparison. Its stroke and padding are `COLUMN_BOX`, which is where the
    // one-base geometry is argued. The label right-aligns 14 px left of it
    // (`textAlign: 'end'`, since a pill's width is only known in-page).
    //
    // THE PILL IS OFF THE DATA NOW (review: "the agents 'call out' is obscuring
    // the result"). At `fracY: 0.04` it sat inside the track band, over the top
    // ~15 px of the FORWARD coverage histogram for 150 px to the left of the
    // box -- which is the band a reader checks first, since the claim is that
    // this column is missing from it. There is no free space inside the track:
    // both coverage bands fill their lanes and both pileups pack to the bottom.
    // The one empty strip in the frame is the track's own label row, white from
    // the end of "HG002 ONT" to the right edge, so the pill goes there:
    // `fracY: 0` is the top of the band and a negative `dy` lifts it out.
    // fontSize 15 rather than 17 is what makes it fit that strip (~26 css px)
    // instead of spilling back over the Forward strand divider.
    //
    // THE CONTROL IS FIVE BASES AWAY, AND IT WAS UNLABELLED. The loudest object
    // in this frame is not the boxed column: it is 1:55,705,716, an orange
    // column running the full height of BOTH pileups and colouring both
    // coverage bands. Unmarked, it reads as a counterexample -- a reader is
    // told "one strand only" and their eye lands on a column that is plainly on
    // both. Marked, it is the control the figure needs, and the pair is the
    // whole claim: same 250 bp, same track, one column carried by one strand
    // and one carried by both.
    //
    // Both positions come out of `rank_strand_asymmetry.py`, which now reads
    // the assembly's own FASTA instead of taking each column's majority base as
    // the reference. That substitution had a blind spot exactly here: at
    // 55,705,716 every read disagrees with hg19 (fwd 0.85 of 13, rev 0.73 of
    // 11, both to G), so the majority base IS the alt and the position scored
    // 0.00 asymmetry AND 0.00 mismatch -- invisible in both directions, which
    // is how the busiest column in the figure went unnamed through three review
    // rounds. `--both` ranks it now.
    annotations: [
      {
        ...COLUMN_BOX,
        anchor: { track: 'hg002_nanopore_hp', locus: '1:55,705,711' },
      },
      {
        type: 'text',
        text: 'reverse reads only: a basecalling artifact',
        fontSize: 15,
        textAlign: 'end',
        anchor: {
          track: 'hg002_nanopore_hp',
          locus: '1:55,705,711',
          fracY: 0,
          // -30 overshot into the ruler's own tick labels; -14 lands the pill
          // in the label row itself
          dy: -14,
          alignX: 'left',
          dx: -14,
        },
      },
      {
        ...COLUMN_BOX,
        anchor: { track: 'hg002_nanopore_hp', locus: '1:55,705,716' },
      },
      {
        // the two pills share the label row and leave their own column in
        // opposite directions, so 5 bp of separation is enough for both: this
        // one starts 14 px right of its box, the other ends 14 px left of its
        // own, and neither has to encode a width measured off an image
        type: 'text',
        text: 'both strands: a real variant',
        fontSize: 15,
        anchor: {
          track: 'hg002_nanopore_hp',
          locus: '1:55,705,716',
          fracY: 0,
          dy: -14,
          alignX: 'right',
          dx: 14,
        },
      },
    ],
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
      { type: 'rightclick', anchor: CTX_MENU_READ },
      { type: 'waitForText', text: 'Open feature details' },
      { type: 'delay', ms: 800 },
    ],
    // clarify the action (it's unclear this menu comes from right-clicking a
    // read). Caption sits over the pileup just left of the menu with a short
    // arrow at the right-clicked read; JBrowse intentionally clears the hover
    // shading when the context menu opens, so the arrow stands in for the
    // missing highlight.
    //
    // The arrow's head is the click, to the pixel, because it is the same anchor
    // — which is the point of naming it once: a figure whose caption points at a
    // different read than the menu came from is the failure mode here, and it
    // can no longer happen. The pill hangs off the same anchor, a line below and
    // to the left, so the two move together.
    annotations: [
      {
        type: 'text',
        anchor: { ...CTX_MENU_READ, dx: -231, dy: 35 },
        maxWidth: 180,
        text: 'Right-click any read to open this menu',
      },
      // tail below and just left of the read, which is clear of the text pill
      // above (~180px wide, ending ~50px short of the read), so the line never
      // crosses the callout box
      {
        type: 'arrow',
        fromAnchor: { ...CTX_MENU_READ, dx: -32, dy: 50 },
        anchor: CTX_MENU_READ,
      },
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
  // centered on the ctgA:14481 SNP, a green-A mismatch column: ~half the 21
  // reads carry A against the reference g, scattered through the pileup.
  //
  // The session used to arrive already sorted by that base, which made the
  // right-click land on a mismatch every time — and made the before frame a
  // picture of the after state (reviewer: "the first screenshot shows sorted
  // reads which is unexpected"). It starts unsorted now, so the two frames are
  // cause and effect. That costs nothing in reliability: the right-click has to
  // land on one of the A rows for the menu to offer "SNP/Mismatch" at all, so
  // SORT_COLUMN's fracY picks a row inside a run of them, and a layout change
  // that moves the run fails the cascade by name rather than quietly capturing
  // the wrong menu.
  //
  // The right-click and both callouts resolve through SORT_COLUMN, so the action
  // and the arrow that explains it cannot come apart: the SNP is named once, as
  // a locus, and the layout is the model's problem.
  {
    mode: 'url',
    name: 'alignments_sort_by_base',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:14470-14500',
      showCenterLine: true,
      tracks: ['volvox_bam'],
    }),
    readyText: 'ctgA',
    // narrower window; the right-click below anchors to the SNP's locus, so it
    // follows this width rather than being recomputed against it
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
          // Right-click the SNP column itself, resolved from the locus rather
          // than written down: the previous fixed x was computed for a 107bp
          // window and this spec's is 31bp, so it had drifted onto a plain read
          // two columns over. fracY lands in the pileup below the coverage
          // subtrack; every read row in this column carries the mismatch, so
          // anywhere in the band works.
          //
          // "The menu offers no SNP/Mismatch item" then came back with the
          // anchor already right, and the second cause was not in this file:
          // `bpAtPx` floored the offset and added a block start that carries a
          // fraction, so the base under the cursor came back fractional and the
          // pileup could not match a mismatch column it was drawing (29c7651d9f).
          // Both causes present as this cascade timing out, and the second one
          // moves with the view's offsetPx rather than with anything the spec
          // says — so before re-anchoring, check that a right-click anywhere in
          // the track offers the item at all.
          { type: 'rightclick', anchor: SORT_COLUMN },
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
          PARK_CURSOR,
          { type: 'delay', ms: 2500 },
        ],
        // make the (subtly-grouped) sort legible: point at the column where the
        // reads carrying each base at 14,481 now stack into one block. Anchored
        // to that locus, like the right-click above — these were hand-measured
        // pixels from when this spec framed 108bp, and after it was narrowed to
        // 31bp the arrow pointed at the centre line two columns over with
        // nothing to say so.
        annotations: [
          {
            type: 'text',
            anchor: SORT_COLUMN,
            dx: 60,
            dy: -20,
            maxWidth: 330,
            text: 'Reads sorted by base at this column',
          },
          {
            type: 'arrow',
            anchor: { ...SORT_COLUMN, dx: 12, dy: -18 },
            fromAnchor: { ...SORT_COLUMN, dx: 52, dy: -14 },
          },
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
          // keep the gene track compact next to the Hi-C display. Was
          // `showDescriptions: false`, which has no home on the unified labels
          // enum — migrateBasicConfigSnapshot resolves it to 'auto', so
          // descriptions do come back at low density. Written as what it
          // actually resolved to; pinning 'name' would honor the original
          // intent but change the figure.
          type: 'LinearBasicDisplay',
          showLabels: 'auto',
        },
        'hic',
      ],
    }),
    readySelector: displayPainted('hic-display'),
    readyTimeout: HIC_READY_TIMEOUT,
    slowLiveSession: false,
    settleMs: 10000,
  },

  // No two-windows-on-chr8 figure. It showed the region-pair fetch on two
  // windows 200 kb apart, which is the same picture hic/bcr_abl1_translocation
  // makes with a real result in it (chr9 x chr22 in K562, empty in GM12878), so
  // hic_track.md's "Comparing two regions" links there instead of carrying a
  // second, weaker copy of the geometry.

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
  // REHOSTED, and the track in config_demo.json now points at ours (reviewer:
  // "if it is not gigantic file, we might consider rehosting this on
  // jbrowse.org so we dont hammer encode servers"). ENCFF563JTY is 1.72 GB,
  // nearly all of it resolutions a whole-genome view never asks for, and every
  // reader who opened the live link pulled 300 region-pair range requests off
  // ENCODE's bucket. scripts/build_gm12878_wholegenome_hic.sh keeps only the
  // 2.5 Mb binsize and rebuilds with `juicer_tools pre`, verifying the rebuild
  // by dumping a pair back out and diffing: 1.72 GB -> 1.6 MB, round trip exact
  // (8,917 records on chr1 x chr2). The cost is that zooming in no longer gets
  // finer, which degrades rather than breaks -- the display picks a binsize
  // from the file's own list, so it keeps drawing 2.5 Mb blocks and the
  // resolution stepper offers no finer step.
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
    readySelector: displayPainted('hic-display'),
    // 300 region pairs, and all 300 answer, where the intra-only file answered
    // 24 of them. Against ENCODE's own 1.72 GB file that was 685,098 records in
    // 224 s measured serially, which is what the 900 s here used to be for; off
    // the rehosted 1.6 MB file (see the track note above) the whole capture is
    // under a minute, so this is headroom rather than an expectation.
    readyTimeout: HIC_WHOLE_GENOME_READY_TIMEOUT,
    slowLiveSession: false,
    settleMs: 15000,
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
    readySelector: displayPainted('hic-display'),
    readyTimeout: HIC_READY_TIMEOUT,
    slowLiveSession: false,
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
          type: 'LinearHicDisplay',
          showLegend: true,
          showResolutionControls: true,
        },
      ],
    }),
    viewportHeight: 530,
    readySelector: displayPainted('hic-display'),
    readyTimeout: HIC_READY_TIMEOUT,
    slowLiveSession: false,
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
    viewportHeight: 875,
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
    readySelector: displayPainted('pileup-display'),
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
    readySelector: displayPainted('pileup-display'),
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
            selector: displayPainted('pileup-display'),
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
      ...menuCascade(['Read height', 'Compact']),
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
      ...menuCascade(['Read height', FIT_LABEL]),
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
    // its "Track settings" tooltip into the result frame. `hideTooltip` rather
    // than a `.MuiTooltip-popper` hideSelector, which hid it from the capture
    // but not from the run's own tooltip check — that runs first, so every regen
    // reported a stray tooltip the figure did not have.
    hideTooltip: true,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Read connections', 'Show read arcs']),
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
          // the tick swaps the display, which fetches and draws again — the two
          // Escapes only dismiss the menu it was ticked in
          { type: 'waitForAppSettled' },
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
    viewportHeight: 800,
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
    viewportHeight: 760,
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
    viewportHeight: 960,
  },

  strandSpecificSpec(),

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
          // reads under each band, colored by the dimension that grouped them
          // (reviewer: the coverage-only frame was a boring image). The switch
          // at the gene boundary then shows twice — as the fill of the two
          // histograms and as which section the reads are stacked in
          colorBy: { type: 'firstOfPairStrand' },
          featureHeight: 3,
          showSashimiArcs: false,
          coverageHeight: 110,
          height: 560,
        },
      ],
    }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    settleMs: 12000,
    // the run reported 107 css px clipped below the fold at 780
    viewportHeight: 890,
    hideTooltip: true,
  },
]
