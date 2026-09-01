import { displayPainted, displaySettled } from '@jbrowse/browser-test-utils'

import {
  PARK_CURSOR,
  displayReady,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'
import {
  ECOLI_AVA_STACK_HEIGHT,
  ECOLI_DEMO_BASE,
  ecoliAvaStack,
} from './demoBase.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the E. coli pangenome tutorial (pangenome_ecoli.md). They load the
// hosted ecoli_pangenome demo config, whose pggb-graph tracks
// (ecoli_pggb_variants, ecoli_pggb_maf) are newer than
// jbrowse.org/code/jb2/latest, as a bare ?config= against the local build. Each
// projection is projected onto the K12 reference, so each figure is a plain
// LinearGenomeView on K12 with the K12 gene lane for context. Remote demo data →
// generous settle.
//
// The graph-view figures (the Bandage force-directed and rGFA anchored subgraph
// pictures) moved out with the GraphGenomeView, which is now the third-party
// jbrowse-plugin-graphgenomeview and no longer bundled in jbrowse-web. They live
// in specs/graph-ecoli.ts and specs/graph-hprc.ts, which load that plugin by
// esmUrl from a fixture config (specs/graph-fixtures.ts), so
// they are generated and live-linkable like everything else here.
const CONFIG = encodeURIComponent(`${ECOLI_DEMO_BASE}/config.json`)

export const pangenomeSpecs: ScreenshotSpec[] = [
  // Projection 1: the graph's own all-vs-all alignment, the wfmash PAF pggb
  // built the graph FROM (ecoli_pggb_ava), stacked the same way the all-vs-all
  // tutorial stacks its minimap2 PAF.
  //
  // This page used to illustrate that section with the minimap2 figure
  // (multiway_synteny/ecoli_pangenome) under a caption claiming it was wfmash's
  // — the same picture doing duty for two different files. They are worth
  // seeing side by side precisely because they nearly agree: an independent
  // pairwise aligner and the graph's own input alignment put the backbone and
  // IAI39's inversions in the same places.
  //
  // DEFAULT ALPHA, and the reason is worth keeping because this figure carried
  // the workaround for a year. wfmash maps all-to-all in both directions, so
  // K12->Sakai and Sakai->K12 are both in the PAF and describe the same spans
  // (measured on the published pif: 4.379 Mb of the K12 axis from one
  // direction, 4.381 Mb from the other, block starts within ~100 bp of each
  // other), and the adapter used to union both perspectives of the anchor. Two
  // 0.2 ribbons composite to #FFA3A3 where the minimap2 figure's one draws
  // #FFCCCC — "these polygons are darker than the other synteny figures", twice
  // in review. This spec answered it with alpha 0.1, which is half the ink for
  // twice the ribbons and only looks right while the file stays reciprocal.
  //
  // AllVsAll{,Indexed}PAFAdapter now drops the second statement of a homology
  // (createReciprocalDedupe), so a band is one ribbon at the alpha every other
  // synteny figure uses, and the minimap2 stack beside it — whose all_vs_all.paf
  // is upper-triangular, each unordered pair once — needs no compensation to be
  // comparable.
  //
  // Not a density difference, whatever an older comment said: over the
  // K12/Sakai band past the 10 kb cutoff minimap2 keeps 119 records and wfmash
  // 41 (21 of them the mirror of the other 20, which is what is dropped).
  {
    mode: 'url',
    name: 'pangenome/pggb_synteny',
    url: sessionSpec(CONFIG, {
      views: [ecoliAvaStack('ecoli_pggb_ava')],
    }),
    viewportHeight: ECOLI_AVA_STACK_HEIGHT,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    settleMs: 15000,
  },
  // Projection 3: the graph's whole-genome alignment as a MAF, projected onto
  // K12. The coverage band on top, then one row per strain (K12 reference first),
  // each colored where it differs from K12.
  //
  // 60 kb rather than the 6 kb this used to show (reviewer: "zoom out more"). At
  // 6 kb every row was continuous backbone, so the figure could only say "these
  // strains differ by SNPs" - a fact the variant figure above already carries.
  // The window is picked from the odgi pav bigWigs rather than by eye: scoring
  // every 60 kb window on "each strain is partly present and partly absent"
  // (8-40% of its 500bp bins absent) puts chr:4,540,000-4,600,000 top, with all
  // four strains between 29% and 40% absent. So the rows now show what only a
  // zoomed-out MAF can: where each strain stops aligning to K12 at all, against
  // the backbone it shares.
  {
    mode: 'url',
    name: 'pangenome/maf',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:4,540,000-4,600,000',
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            {
              // the same window's variant calls above the alignment they were
              // decomposed from (reviewer: show the evidence sources side by
              // side).
              //
              // No jexl length filter any more. It was here to hide the snarl
              // tree's wide parent records, which drew over the fine layer they
              // were decomposed from; `pggb -V K12:10000` pops those in the
              // pipeline (vcfbub | vcfwave) so the track loads an already-flat
              // tier. Keeping the filter would now drop real indels instead.
              trackId: 'ecoli_pggb_variants',
              type: 'LinearMultiSampleVariantDisplay',
              // Four strain rows and nothing else, which is what the lane is
              // for here (reviewer: "reduce height of multisamplevariantdisplay").
              //
              // It sat at 170 because the legend does not fit in 120: it is the
              // genotype key plus an Insertions section, ~160px inside a track
              // container that paint-clips its own box, so at 120 the last
              // swatch was sliced in half by the track boundary. The height was
              // raised to the legend rather than the legend cut to the height.
              // The action below hides it instead, and the caption names the
              // colors -- see there for why this lane in particular can spare
              // the key.
              height: 120,
            },
            { trackId: 'ecoli_pggb_maf', type: 'LinearMafDisplay' },
          ],
        },
      ],
    }),
    // The MAF lane's own phase, not a ruler tick. This gated on '540,000' until
    // the scalebar started hiding a coordinate that would sit under the sticky
    // refName label — the window opens at chr:4,539,975, so that label is a
    // fraction of a pixel from the left edge and never drawn.
    readySelector: displaySettled('maf-display'),
    readyTimeout: 90000,
    viewportWidth: 1000,
    // the variant lane plus one MAF row per sample and the coverage band
    viewportHeight: 660,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      // The variant lane's own key, dismissed through the button it carries.
      // Two reasons it is the one legend in the set that can go: its allele-count
      // vocabulary ("Homozygous alt", "Heterozygous") describes a diploid callset
      // and these are four haploid strains, and this lane is context under the
      // MAF projection the figure is actually about. A missing selector throws
      // the regen, so this cannot fail into a silently clipped legend the way a
      // hideSelectors rule would.
      { type: 'click', selector: '[aria-label="Hide legend"]' },
      PARK_CURSOR,
      { type: 'delay', ms: 2000 },
    ],
  },

  // Projection 1b: the ribbons read OUT of the graph by `odgi untangle`, rather
  // than off the wfmash PAF the graph was induced from.
  //
  // Framed on the one thing untangle says that a pairwise PAF cannot, rather
  // than on another whole-genome stack: a collapsed repeat, where two locations
  // in a query path come back pointing at the SAME reference span. Whole-genome,
  // this file draws the same near-colinear diagonals as the wfmash figure above
  // and the difference between the two projections is invisible.
  //
  // The locus is read off the file, not chosen. Two K12 spans are reached from
  // two distant query loci each, and the same three strains do it at both —
  //   chr:3,941,447-3,944,255   Sakai 4,735,016 + 4,975,690
  //                             NCTC86 4,313,805 + 4,538,509
  //                             IAI39  3,136,192 + 4,546,355
  //   chr:4,169,192-4,171,723   the same three, ~2.8 kb along each query
  // CFT073 reaches neither twice, which is the control. This figure takes the
  // first, the rrnC operon: seqwish collapsed the copies into one set of nodes,
  // so the graph has one place where the genome has several.
  //
  // Those coordinates are the -e 5000 rebuild. The file this spec was first
  // framed against had no -e, so it was 174 records for all four pairs and the
  // operon was ONE 5.3 kb block per copy; it is 3,923 records now and the same
  // copy is two blocks, the second of which lands on the OTHER collapsed span
  // 228 kb away. That is why the K12 window below is wide enough to hold the
  // gene context but the wedge only covers part of it: the rest of each Sakai
  // window points off-screen, at K12's own second rRNA operon.
  //
  // ONE STRAIN, TWICE: Sakai's rrnC copy on top, K12 in the middle, Sakai's
  // rrnB copy underneath. The same assembly fills two rows, each opened on one
  // of the two places its path lands on the shared K12 span, and both bands
  // draw a wedge that narrows onto the same third of the K12 row.
  //
  // It used to be NCTC86 and Sakai flanking K12, each on a window wide enough to
  // hold BOTH of that strain's copies (238 kb and 254 kb). That is what made the
  // figure unreadable (reviewer: "doesn't look very good or interesting"): a
  // 5.3 kb segment inside a 250 kb window is a 25 px sliver, so each band drew a
  // pale trapezoid from a sliver to the full width of the K12 row and the figure
  // was two washed-out fans with nothing to anchor them.
  //
  // The gene lanes are what make it self-explaining, and they are on all three
  // rows now rather than K12 alone: Sakai's copies carry rrsC/gltU/rrlC/rrfC and
  // rrsB/gltT/rrlB/rrfB, so the rows name the two operons the graph folded
  // together, and K12's lane names the one place they both land on.
  //
  // Window widths are set from the block rather than round: 4.2 kb on the Sakai
  // rows is the 2.81 kb segment with a ~700 bp flank either side, and 16 kb on
  // K12 leaves it a sixth of the middle row, so each band is a wedge narrowing
  // onto the same part of K12 rather than a slab filling its band.
  //
  // The Sakai windows were 6.6 kb while the untangle file had no -e and the
  // operon was ONE 5.34 kb block per copy. At -e 5000 that block is two, and the
  // second lands on the other collapsed span 228 kb away — off this K12 window —
  // so a 6.6 kb window drew a wedge over its left half and dead white space over
  // its right. Trimming to the block that lands here is the fix; the fact that
  // the rest of the operon points at K12's OTHER rRNA locus is the same collapse
  // one level up, and the prose says it rather than the picture.
  // pangenome/pggb_untangle was here and is DELETED. It drew Sakai's two rRNA
  // operons above and below one K12 span, so the collapse read as two pale
  // wedges converging over three gene lanes -- a shape a reader has to be told
  // to look for, on a figure that had already been reframed twice. Review:
  // "not a interesting figure, needs rethinking." What it was for is now two
  // figures that each carry a whole claim on their own: pggb_untangle_dotplot
  // (a descending run IS an inversion, two marks sharing an x ARE one span
  // reached twice) and pggb_untangle_rows (one lane per strain, coloured by
  // orientation, with three flat strains as the control).

  // Projection 1c: the same untangle file as one lane per strain on the K12
  // axis, rather than as ribbons between two genome rows.
  //
  // What only this framing shows is ORIENTATION. Column 5 of the untangle PAF is
  // the strand each query segment traverses the reference in, and a large
  // inversion is a long contiguous run of them. Measured on the -e 5000 file:
  // 310 of IAI39's 956 segments are reverse, merging into five runs on K12
  // (213,443-262,948; 302,899-501,436; 914,963-1,239,923; 1,635,838-2,229,302;
  // 3,941,447-4,171,723), while Sakai and NCTC86 have zero and CFT073 has one.
  // So the control is three flat grey rows in the same picture, from the same
  // file, and the claim is not "the graph has inversions" but "this strain does
  // and those three do not".
  //
  // The synteny figures already carry these as ribbon crossings, but only
  // whole-genome and only between the two rows in view; here they are placed on
  // the reference. Independent agreement with the minigraph `--call` route is in
  // agent-docs/reference/PANGENOME_GRAPHS.md (IAI39-only, one run at
  // 1,671,139-1,870,074, inside the fourth run above).
  //
  // Whole-chromosome and no gene lane, same as the depth and pav figures: at
  // 4.6 Mb the ~4,300 K12 genes only trip the FeatureTrack too-many-features
  // gate. The colors come from the BED's own itemRgb (scripts/untangle_to_bed.py)
  // so nothing here can drift from what the file says.
  {
    mode: 'url',
    name: 'pangenome/pggb_untangle_rows',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1-4,641,652',
          tracks: [
            {
              trackId: 'ecoli_pggb_untangle_rows',
              type: 'LinearMultiRowFeatureDisplay',
              // four strain rows; rowHeight 0 (the default) auto-fits them to
              // this height, so each is ~55px and a run of red reads as a band
              height: 240,
            },
          ],
        },
      ],
    }),
    readyText: 'untangle per strain',
    readyTimeout: 90000,
    viewportWidth: 1000,
    // the 240px lane plus its legend and the view chrome
    viewportHeight: 450,
    settleMs: 15000,
    hideTooltip: true,
    actions: [PARK_CURSOR, { type: 'delay', ms: 2000 }],
    // ONE ARM MARKED, AND MARKED IN THE DOTPLOT TOO (review: "still
    // unconvinced. complementary visualizations are useful"). The two figures
    // read the same file and neither one of them, alone, is proof: a red band
    // is the untangle PAF's strand column, and a reader who does not already
    // trust that column has nothing to check it against. So the largest of the
    // five reverse runs is boxed here and boxed again on the dotplot below, at
    // its own coordinates on both axes -- 594 kb of K12 at 1,635,838-2,229,302,
    // which is IAI39 1,574,975-906,630 read backwards. A band in one picture
    // and a descending arm in the other are then the same object.
    //
    // The callout carries the CROSS-REFERENCE and nothing else. It used to read
    // "594 kb, reversed in IAI39 only", which broke both callout rules at once:
    // the size is a specific value, and "reversed in IAI39 only" is exactly what
    // the frame already shows, since IAI39's is the one row with any red in it.
    // What a reader cannot see is that the dotplot's box and this one are the
    // same object, so that is what the text says.
    //
    // No `fracY`, so the box wraps the whole four-row band rather than the
    // IAI39 row alone. That is the point: at this x the three rows above it are
    // grey, so the control is inside the box rather than beside it.
    annotations: [
      {
        type: 'box',
        strokeWidth: 3,
        anchor: {
          track: 'ecoli_pggb_untangle_rows',
          locus: 'chr:1,635,838-2,229,302',
        },
      },
      {
        type: 'text',
        text: 'also boxed in the dotplot above',
        fontSize: 16,
        maxWidth: 260,
        anchor: {
          track: 'ecoli_pggb_untangle_rows',
          locus: 'chr:1,635,838',
          fracY: 0,
          dy: -34,
        },
      },
    ],
  },

  // The same untangle file in a dotplot: the idiomatic comparative picture for
  // how two genomes are ARRANGED, and it needs no new file since it reads the
  // PIF the synteny track already loads.
  //
  // K12 on x against IAI39 on y, whole genome. Ascending runs are shared
  // sequence in the same orientation; descending runs are inversions. Merging
  // the records into arms gives five reverse ones:
  //   K12   213,443-  262,948  -> IAI39   493,004-  449,188   (50 kb)
  //   K12   302,899-  501,436  -> IAI39   443,280-  228,426  (199 kb)
  //   K12   914,963-1,194,177  -> IAI39 2,336,701-2,058,958  (279 kb)
  //   K12 1,635,838-2,229,302  -> IAI39 1,574,975-  906,630  (594 kb)
  //   K12 3,946,786-4,171,723  -> IAI39 3,330,675-3,083,154  (225 kb)
  // the last of which is the pair detached from the diagonal near 4 Mb.
  //
  // IT DOES NOT SHOW THE COLLAPSED REPEAT, and an earlier caption here claimed
  // it did. At K12 3,941,447 the big forward arm ends (IAI39 4,546,355) and the
  // fifth reverse arm begins (IAI39 3,136,192), so the two records sharing that
  // x ARE a rearrangement breakpoint and look like every other junction on the
  // plot. The collapse is legible in the synteny figure above, where both copies
  // are framed, and filterable on `selfCov` in the lane below. Do not put it
  // back in this figure's caption.
  //
  // IAI39 rather than another strain because it is the only one with inversions
  // at all: 310 of its 956 untangle segments are reverse against 0 for Sakai and
  // NCTC86 and 1 for CFT073.
  {
    mode: 'url',
    name: 'pangenome/pggb_untangle_dotplot',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'DotplotView',
          tracks: ['ecoli_pggb_untangle'],
          // x is views[0] (hview), y is views[1] (vview)
          views: [{ assembly: 'K12' }, { assembly: 'IAI39' }],
        },
      ],
    }),
    readyTimeout: 120000,
    settleMs: 20000,
    // The same arm the rows figure boxes, on both axes here: a dotplot cell is
    // `{hLocus, vLocus}` and resolves through the plot's own axes, so this
    // follows the data rather than a measured pixel. See the note on
    // pggb_untangle_rows for why the pair is marked at all.
    annotations: [
      {
        type: 'box',
        strokeWidth: 3,
        anchor: {
          hLocus: 'chr:1,635,838-2,229,302',
          vLocus: 'chr:906,630-1,574,975',
        },
      },
    ],
  },

  // Projection 4: pangenome depth (core vs accessory) from `odgi depth`, as a
  // whole-chromosome overview so the shared plateau, the accessory dips and the
  // collapsed-rRNA spikes read at a glance. No gene lane: at 4.6 Mb the ~4,300
  // K12 genes only trip the FeatureTrack "too many features" gate, so the curve
  // carries the figure on its own.
  //
  // This used to be two lanes, depth over an `odgi degree` "graph complexity"
  // curve, on the claim that a window can be fully covered and still branched.
  // The data does not support it: over the build's 9,284 windows degree is flat
  // (p5 2.85 / p95 4.05) and correlates with depth at r = 0.78, so the second
  // lane was a near-copy of the first. Both the track and its section are gone.
  // `pangenome/depth` was here and is DELETED. It drew the aggregate odgi depth
  // curve alone over the whole chromosome, and the pav figure below draws that
  // same curve as its top lane with the per-strain rows under it -- the caption
  // said "the aggregate depth curve again" out loud. The long-read figure draws
  // it a third time, zoomed into one trough. Three figures of one curve is two
  // too many, and the one that was only the curve is the one that says least.

  // Projection 4b: per-strain presence from `odgi pav` as a MultiQuantitativeTrack
  // — one bigWig subtrack per non-K12 strain, whole-chromosome so each strain's
  // accessory dips read at a glance. No gene lane, same as the depth figure
  // above.
  //
  // The aggregate depth curve rides on top, which is the whole claim the section
  // makes: "where the aggregate curve dips, this track shows which strain is
  // missing". Alone, the pav rows are a wall of blue with hairline gaps and the
  // dip they explain is in a different figure eighty lines up, so the reader is
  // asked to hold two whole-chromosome pictures in their head and align them by
  // eye. The Minigraph-Cactus page already draws it this way
  // (pangenome_cactus/pav) for exactly this reason; this is that fix
  // back-ported, at the same two heights so the builders stay comparable.
  //
  // ONE TROUGH IS SHADED, because on 4.64 Mb of axis a single strain's island
  // is eight pixels wide and nothing said which eight. Before the band the
  // caption claimed "each dip resolves into the strain that accounts for it"
  // and no reader could check it.
  //
  // The span is read off the pav bigWigs this figure loads, not chosen. Over
  // chr:501,500-539,000 IAI39 is 0.00 in all 75 windows while NCTC86 holds
  // 1.00 across every one and Sakai stays near 1, and K12 carries ybaL through
  // the allantoin operon there. It also holds a second reading for free: CFT073
  // drops to 0 over chr:523,000-530,000 and nowhere else in the band, which is
  // the rhsD Rhs element.
  //
  // Two longer runs have one strain absent throughout and were rejected.
  // chr:1,489,500-1,533,000 (IAI39, 43.5 kb) is speckled -- Sakai and CFT073
  // each drop out in several places inside it, so the band would have shown
  // four ragged rows rather than one clean absence. chr:4,496,500-4,536,500 and
  // chr:262,500-302,500 are longer still and are the opposite figure: every row
  // goes white over them. Those are the negative, and the frame keeps plenty of
  // them either side of the band.
  {
    mode: 'url',
    name: 'pangenome/pav',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1-4,641,652',
          // Gold, alpha'd low: getHighlightColor takes a supplied color as-is,
          // and the band has to stay transparent to the white notch it points
          // at. The Minigraph-Cactus correspondence figure marks a region with
          // the same gold at 0.60, where covering what is under it costs
          // nothing.
          highlight: [
            {
              refName: 'chr',
              start: 501500,
              end: 539000,
              color: 'rgba(255,193,7,0.30)',
            },
          ],
          tracks: [
            {
              trackId: 'ecoli_pggb_depth',
              type: 'LinearWiggleDisplay',
              height: 150,
            },
            {
              trackId: 'ecoli_pggb_pav',
              type: 'MultiLinearWiggleDisplay',
              // Density rather than the default stacked XY, matched by the
              // Minigraph-Cactus sibling so the two builders stay comparable.
              // pav is a presence fraction per window, so at 4.6 Mb in 1000 px
              // the XY rendering spent a row's height on a quantity that is 1
              // almost everywhere and drew each absence as a hairline slit;
              // density spends colour on it instead, so an accessory stretch is
              // a white column and a partial one is pale blue.
              defaultRendering: 'multirowdensity',
              // 4 strains at 60px a row, enough for the accessory dips to read
              // without the stack dominating the frame
              height: 240,
            },
          ],
        },
      ],
    }),
    readyText: 'per-strain presence',
    readyTimeout: 90000,
    viewportWidth: 1000,
    // fits the 150px depth track plus the whole 240px stack
    viewportHeight: 640,
    settleMs: 15000,
    hideTooltip: true,
    actions: [PARK_CURSOR, { type: 'delay', ms: 2000 }],
  },

  // What a depth trough IS, at single-read resolution. The depth and pav tracks
  // say K12 carries sequence no other strain does; this is an unrelated clinical
  // isolate's nanopore reads over one of those troughs, and the absence is the
  // same absence.
  //
  // The locus is read off the data rather than chosen. `odgi pav` for NCTC86
  // gives 52 K12 spans no other strain traverses; the ones a long read can span
  // whole are 2-9 kb, and CPZ-55 at chr:2,559,000-2,565,000 is where the reads
  // are unambiguous. Measured on the BAM this figure loads:
  //   flanks     11-15x
  //   2,559,000-2,565,000   exactly 0x
  //   right flank 16x
  // and the reads that cross it carry ONE deletion of 6,789-6,791 bp (five of
  // them at last count, starting anywhere from 2,545,683 to 2,554,482). So the
  // pileup shows the event twice over: a hole with hard edges, and a wall of
  // reads each drawing the same gap.
  //
  // The gene lane is the point of the window, not decoration — intZ and yffL-yffS
  // name the CPZ-55 cryptic prophage, so the figure says which mobile element the
  // trough is rather than just that a trough exists.
  //
  // NOT whole-genome and not the other two prophages: CP4-6 (263-297 kb) reads
  // 2.8x and DLP12 (566.5-573.5 kb) 4.8x in this isolate, which is partial
  // carriage and a muddier picture. CPZ-55 is the clean one.
  {
    mode: 'url',
    name: 'pangenome/long_reads',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:2,554,000-2,570,000',
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            {
              trackId: 'ecoli_e146_ont',
              // 320 left half the lane empty: this slice is ~20x, so the reads
              // stack about 10 deep and the rest was white
              type: 'LinearAlignmentsDisplay',
              // Link supplementary alignments (review: "view as pairs/link supp
              // reads likely can be toggled too"). VIEW AS PAIRS has nothing to
              // act on -- these are ONT reads and not one of the 38 in this
              // window carries the paired flag -- but LINK SUPPLEMENTARY does:
              // 18 of them carry an SA tag, 10 supplementary alignments land
              // here, and 18 of the 22 SA segments map back into 2.5-2.6 Mb, so
              // the chains are local. `linkedReads: 'normal'` is the one setting
              // behind both menu items; on unpaired reads it chains a read's own
              // supplementary segments. That says something the CIGAR deletion
              // cannot: which reads cross the prophage boundary in one piece and
              // which are split at it.
              linkedReads: 'normal',
              // GROUPED ON THE SAME FACT the links draw (reviewer:
              // "potentially use groupBy split reads/sa tag"). `linkedReads`
              // chains a read's supplementary segments, which says which reads
              // are split at the prophage boundary, but the split and unsplit
              // reads are interleaved down the pileup so the answer has to be
              // traced read by read. Grouping puts them in two labelled
              // sections, so "18 of 38 carry an SA tag" is a thing you can see
              // rather than count.
              groupBy: { type: 'splitRead' },
              height: 210,
            },
            {
              trackId: 'ecoli_pggb_depth',
              type: 'LinearWiggleDisplay',
              height: 100,
            },
            // The MAF the graph induces, over the same window (review: "a maf
            // track of the different species in the graph if there is rgfa or
            // maf available"). There is: ecoli_pggb_maf, the same track
            // pangenome/maf draws whole-genome. Here it is the third independent
            // statement of one event -- the reads' deletion, the depth track's
            // 5 -> 1 step, and now the four non-K12 rows going blank across
            // exactly the prophage. Each comes from a different file and none of
            // them is the others' summary.
            { trackId: 'ecoli_pggb_maf', type: 'LinearMafDisplay' },
          ],
        },
      ],
    }),
    // gate on the pileup actually having drawn, not on the locus text: the
    // testid flips only once model.canvasDrawn is true, so a missing or empty
    // BAM fails the capture instead of quietly yielding a blank lane. readyText
    // on the window would have matched before a single read rendered.
    readySelector: displayReady('pileup-display'),
    readyTimeout: 120000,
    viewportWidth: 1000,
    // gene lane + the pileup with its coverage band + the depth wiggle + the
    // MAF's five rows and its coverage band
    viewportHeight: 865,
    settleMs: 20000,
    hideTooltip: true,
    actions: [PARK_CURSOR, { type: 'delay', ms: 2000 }],
  },
]
