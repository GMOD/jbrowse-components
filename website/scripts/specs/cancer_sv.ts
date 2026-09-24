import { SPLIT_VIEW_MENU_LABEL } from '../../../plugins/variants/src/LinearVariantDisplay/labels.ts'
import { lgvSession, sessionSpec } from '../screenshot-spec-helpers.ts'
import { DER3_GENES_TRACK } from './cancer_sv_der3_genes.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for two tutorials that share one demo: cancer_sv.md takes the COLO829
// figures, k562_fusions.md takes the k562_* ones.
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

const GENES = 'ncbi_refseq_hg38'
const TUMOUR = 'COLO829_tumor_ont'
const NORMAL = 'COLO829BL_normal_ont'
const SV = 'COLO829_somatic_sv'

// Super-compact reads (COMPACTNESS_PRESETS' featureHeight 1; the 0 gap that
// pairs with it is derived, see featureSpacingForHeight).
// ONT depth here is 200x tumour / 80x normal, and at the default read height a
// panel shows a dozen rows out of that; the reads carrying the junction are
// below the fold. One row per pixel puts the whole pileup in frame, which is
// what makes the wall of clipping legible as a wall.
const SUPER_COMPACT = { featureHeight: 1 }

// Both COLO829 ONT pileups sit above the byte gate at every window this
// tutorial uses: over 3.4 kb the tumour CRAM's containers estimate 7.45 Mb and
// the normal BAM's index chunks 43.5 Mb, against a 5 Mb ceiling, because an ONT
// read is 20 kb of the fetch whatever the window is. Without this every figure
// below captures the "Requested too much data" banner where its pileup should
// be. `forceLoad` is the declarative half of the FORCE LOAD button the banner
// offers (RegionTooLargeMixin's `configForceLoad`), so the live link opens what
// the figure shows and a reader clicks the same approval once.
// `type` names the display these entries would have opened anyway, which is a
// no-op at render (`pickDisplayForView` takes the requested type first) and the
// only way a static script can know a pileup is a pileup: the figures load a
// hosted config, so the recipe builder cannot read the track's own type and
// falls back to calling its rows "features". Naming the display is what puts
// "Read height" rather than "Feature height" in the recipe.
const DEEP_ONT = { type: 'LinearAlignmentsDisplay', forceLoad: true }

// The independent check on every reconstruction below: Valle-Inclán et al.
// 2022's somatic SVs, called on Illumina, PacBio, ONT, 10X and Bionano before
// this ONT run existed and validated by capture, PCR or optical map. Served
// straight from Zenodo, which sends CORS headers, so the live link needs no
// rehosted copy.
const TRUTH_SET_TRACK = {
  type: 'VariantTrack',
  trackId: 'COLO829_truth_set',
  name: 'COLO829 validated somatic SVs (Valle-Inclán 2022)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfAdapter',
    vcfLocation: {
      uri: 'https://zenodo.org/api/records/4716169/files/truthset_somaticSVs_COLO829_hg38lifted.vcf/content',
    },
  },
}
const TRUTH_SET = TRUTH_SET_TRACK.trackId

// The two halves of cancer_sv/multihop_reads: the evidence at one breakpoint,
// and the chain across every locus it visits, side by side.
//
// The right half used to be a BreakpointSplitView authored as a session spec,
// over three loci a reader could only get by reading sv_multihop.py's output.
// The review rejected that ("i dont like that it was manually generated like
// this. i want it more automatic"), so it was deleted and the figure was split
// into two — which the review then rejected in turn ("not sure i like the way
// this has been split into two figs. please investigate better solutions. i
// dont care about height differences necessarily").
//
// So the pair is back, and the right half is the split view the callset's
// breakend walk opens from one record, with no locus typed anywhere.
//
// `+append` pads the shorter half rather than cropping it, which is what makes
// two different heights allowable here; each half is still sized to its own
// content, so the numbers come from the run's own reports rather than from a
// shared round number.
const MULTIHOP_HEIGHT = 1126
// The chain half's three panels, each paying for a gene lane and a pileup.
const MULTIHOP_CHAIN_HEIGHT = 1126
const MULTIHOP_WIDTH = 1000

// Per PANEL, so worth four times what it reads as, which is why it was 45 and
// why the chain frame is 100px taller for it. 45 fitted one packed row: the
// chr12 panel draws TRHDE-AS1 and TRHDE on two, and the second one's floating
// label was sliced in half by the lane's bottom edge (review: "gene track
// height could be increased"). A gene row with its label is ~30px, so 70 is two
// rows and the header chip clear of both.
const MULTIHOP_GENE_HEIGHT = 70

// K562's Iso-Seq is ~600x over BCR and the split-read subset of it is still
// ~250 rows, so the row height is what decides whether the pileup ends inside
// the figure or behind a scrollbar.
//
// FOUR PIXELS, where this was two (review: "potentially stop using
// 'supercompact' to more clearly see lines"). Two fits the whole read set in a
// 700px lane and was chosen for that, but a 2px row with a 1px gap is a hairline
// and the figure's claim is that each line is one molecule — which a reader has
// to be able to follow across the join to believe. Four doubles the pileup, so
// the lane and the frame grow with it rather than the rows going behind the
// track's own scrollbar; that scrollbar is the thing to check the regen for,
// since neither of the run's size reports can see an overflow INSIDE a track.
//
// The review's other idea, filtering to split reads by grouping on the SA tag,
// is already what `filterBy: { split: 'only' }` does one line down, and it is why
// the set is 250 rows rather than 600x of coverage.
const SPLIT_READS = { featureHeight: 4 }

// The 29 reads realigned to the derivative used to share one row height across
// the three figures that draw them. They no longer do, and the reason is that
// the three are at three zooms: 40 kb (derivative_synteny, now the coverage
// band alone), 1.1 kb (derivative_inserts, 8 px rows) and 380 bp
// (realigned_reads_derivative, 13 px rows). Each height is explained where it
// is set.

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

// A big numbered badge in the same corner of each frame of a staged figure
// (reviewer, on cancer_sv/split_view_from_breakend: "panels need to be numbered
// with large numbers so user can see the flow"). The frames are separate
// captures composed afterwards, so nothing can draw across a seam to say "this
// one, then that one" -- a badge in each says it in the order a reader reads.
//
// Radius 26 rather than realigned_reads' 15: that figure's pair sits inside two
// panes of one image, this one has to be legible after a 2700 px strip is
// scaled to a doc column. Anchored to the SV track's band so it follows the
// lane rather than a measured y, and hard left where no frame has content --
// the context menu is at the record, the dialog is centred, and the result's
// leftmost lane is a scale bar.
const FLOW_NUMBER = (n: number, extra?: { view: [number, number] }) =>
  ({
    type: 'circle',
    text: String(n),
    radius: 26,
    fontSize: 30,
    anchor: {
      ...extra,
      track: SV,
      fracY: 0,
      alignX: 'left',
      dx: 34,
      dy: 34,
    },
  }) as const

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
// The chr3 junction at 25,359,568, which is the first one the allele takes.
// The derivative's own coordinate for it is 32,732 (der3_RARB.vs_reference.paf:
// segment 1 is 0-32,732 + -> chr3:25,326,821-25,359,568), and both panes are
// centred on the pair.
//
// THREE PANELS ON THE REFERENCE SIDE, not two, and that is the answer to the
// third report on this figure ("it uses dotted lines which means, in effect, we
// dont have the full picture here. we might want to fully resolve the 3 level
// derived breakpoint split"). The dashes are not a style: AlignmentConnections
// draws `strokeDasharray="4 3"` exactly when `hiddenSegmentsBetween` is set,
// which readGroupConnections fills with the read's own SA-chain segments that
// fall between two drawn ones and are shown in NO panel. der(3) is a four-hop
// chain -- chr3 32.7 kb, chr10 199 bp, chr12 183 bp inverted, chr3 6.4 kb
// inverted -- so with chr3 and chr10 on screen every connector from the chr10
// island back to the returning chr3 arm skipped the chr12 insert and came out
// dashed. The reader was being told, correctly, that a piece was missing.
//
// Adding the chr12 panel puts all four segments in view, so each connector now
// joins two adjacent hops and every one of them is solid. The last hop returns
// to level 0, which is why one bundle of curves crosses the chr12 panel: the
// allele visits chr3 twice, and that crossing is the fold-back drawn rather
// than described.
//
// THE TWO PANES ARE NOT THE SAME WIDTH, and that is deliberate. The
// reference pane is 5 kb a panel where it used to be 380 bp, which is what
// fixes the second glitch report on this figure. A BreakpointSplitView
// connector runs between two SEGMENT ENDS, so if either end falls outside its
// panel the curve is still drawn -- from a coordinate far off the left edge to
// one on screen. At 380 bp most of these reads had one end outside, and forty
// such curves at once came out as a diagonal comb crossing the lower panel with
// no read at either end of it, which is what "weird glitchy lines in figure 1
// on left" is. The window is the fix, not a setting: at 5 kb both ends of every
// connector are in frame, the curves converge on the junction, and the chr10
// landing site reads as the 199 bp island it is. Reducing the read count first
// (`split: 'only'` below) halved the comb and did not remove it -- it
// is geometry, not density.
//
// The derivative pane stays at 380 bp, and widening it to match was tried and
// reverted: past about a kilobase the pane fills with the clipped tails of
// reads that reach the junction without crossing it, which is a true thing
// about the realignment and the opposite of what this pane is for. Each pane
// carries its own scale bar, and the two answer different questions -- where
// the pieces went, and whether anything clips AT the junction.
//
// Soft clipping is ON in both panes, which is what makes the comparison
// honest: the right pane is not "clipping hidden", it is the same setting over
// reads that have none to draw.
// The junction as a 20 bp band in the derivative's own coordinates. `derive`'s
// PAF puts derivative 0-32,732 (+) against chr3:25,326,821-25,359,568, so the
// boundary is the same event at 25,359,568 and at 32,732; the band is wide
// enough to be a mark rather than a hairline at 380 bp across a 700 px pane.
//
// Only this pane carries one. The reference pane is a split view, where the
// curves converge on the junction and mark it better than a band would -- and
// a band could not be drawn there anyway: BreakpointSplitView's `init` forwards
// `{loc, assembly, tracks}` to each panel and nothing else, so a `highlight`
// authored on a panel is dropped on the way through.
const JUNCTION_HL_DER3 = {
  refName: 'der3_RARB_BICC1_TRHDE',
  start: 32722,
  end: 32742,
  color: 'rgba(60,65,72,0.12)',
}

function realignedReadsPartSpecs(): ScreenshotSpec[] {
  // One height for both, since `+append` pads the shorter pane, and each pane's
  // tracks are then sized to fill it rather than to a round number: both halves
  // of the first render were wrong in opposite directions (the reference pane
  // carried 150 px of blank inside a track taller than its own pileup, the
  // derivative pane cut 97 px off the bottom of the page), which is what the
  // generator's two size reports are for.
  //
  // Two stacked panels now carry the left pane where one did, so the shared
  // height is the split view's rather than the single pileup's.
  // The split view's own height, and the derivative pane is then sized to meet
  // it rather than the other way round: the left half's content is two panels
  // and a bundle of curves, the right half's is 29 rows that can take any row
  // height. Neither of the run's size reports fixes this number -- both measure
  // the PAGE, and every miss here was inside a track. 566 came off the
  // blank-below report and left the chr3 pileup on a scrollbar.
  //
  // Grown for the third panel the reference pane gained (see the hidden-segment
  // note above), then measured back down: at 855 the left half's own content
  // stopped 72 px short and the right half's ran 8 px past, so this is the
  // left half as it renders and the right half's rows are sized to meet it.
  const HEIGHT = 785
  const WIDTH = 700
  // Both panels of the split view draw their reads the same way on purpose:
  // the comparison is between the two ENDS of one junction, so a difference in
  // row height or in clipping between them would be a difference the data does
  // not have. Super-compact because the depth is 200x and the curves have to
  // leave the pileup they start from; at featureHeight 2 the top panel alone is
  // taller than this whole pane.
  //
  // The HEIGHT each panel gets is not shared, though, and that is the same rule
  // the panes themselves follow: chr3 carries the full tumour pileup and chr10
  // carries only the reads whose tails land there, so equal track heights left
  // 210 px of white under the lower pileup. Neither size report catches it --
  // the blank is INSIDE the split view rather than below the fold.
  const BREAKPOINT_READS = {
    trackId: TUMOUR,
    ...DEEP_ONT,
    showSoftClipping: true,
    // ONLY THE SPLIT READS, which is what the panel is about and what fixes
    // the second glitch report ("this is potentially showing some weird
    // glitchy lines in figure 1 on left"). Those lines were the bezier
    // connectors: 200x of COLO829 packs more rows into each panel than the
    // panel is tall, so a connector leaving a row the pileup drew BELOW the
    // visible band still gets drawn, and a couple of hundred of them at 2px
    // spacing come out as two diagonal ladders running off both edges with no
    // read at either end. `split: 'only'` keeps the reads the
    // aligner emitted a supplementary segment for -- the chimeric evidence
    // this pane exists to show -- and every connector then starts and ends on
    // a row a reader can see.
    filterBy: { split: 'only' },
    // 2px rows, not the 1px SUPER_COMPACT the other cancer_sv pileups take: at
    // 1px a read is a hairline and the rows fuse into a grey slab with white
    // streaks where the pack happens to leave a gap, which reads as a rendering
    // fault rather than as a pileup (reviewer: "captured a very weird glitch").
    // 2px still fits every row in the panel here, since this window is 380bp
    // rather than the 3.4kb the other two draw.
    featureHeight: 2,
  }
  return [
    {
      mode: 'url',
      name: 'cancer_sv/realigned_reads_reference',
      viewportHeight: HEIGHT,
      viewportWidth: WIDTH,
      // A BREAKPOINT SPLIT VIEW, not the single chr3 pileup this pane used to
      // be (reviewer: "the left side should potentially show a breakpoint split
      // view, so that the user can see the split alignment from chr3 to
      // chr10"). One pileup could only show half the event: reads ending at
      // 25,359,568 with their tails hanging off as clip, which says the
      // molecules are torn but never where the other piece went. The second
      // panel is where it went, and the curves between the panels are the same
      // molecules drawn as one thing, so the left pane now makes the claim the
      // right pane answers -- torn in two against hg38, continuous against the
      // allele -- instead of leaving half of it to the caption.
      url: sessionSpec(CONFIG, {
        views: [
          {
            type: 'BreakpointSplitView',
            // all three loci, since all three are on screen now
            displayName: 'RARB (chr3) - BICC1 (chr10) - TRHDE (chr12)',
            // THE VIEW'S OWN HEIGHT IS THE LEVER, and it is easy to miss: a
            // panel's track height does apply (the two panels come out
            // different sizes), but the split view lays its panels out inside
            // `height` and scrolls them, so growing a track alone moves nothing
            // on screen and only leaves blank page under the view. Both have to
            // move together. `init` is NOT the spelling here -- the launcher
            // takes the panels flat as `views` and rejects `init` by name,
            // which is the config/defaultSession form.
            height: 800,
            // In the order the reads cross them, which is also the order that
            // makes the first two connector bundles run between adjacent
            // panels. chr3 carries both of the allele's chr3 arms, so it is the
            // panel with the full pileup and the one the last hop returns to.
            views: [
              {
                assembly: 'hg38',
                loc: 'chr3:25,357,000-25,362,000',
                tracks: [{ ...BREAKPOINT_READS, height: 280 }],
              },
              {
                assembly: 'hg38',
                loc: 'chr10:58,715,000-58,720,000',
                tracks: [{ ...BREAKPOINT_READS, height: 150 }],
              },
              // the 183 bp chr12 insert, centred. Only the reads that reach it
              // land here, so it takes the same height as the chr10 island
              // rather than chr3's.
              {
                assembly: 'hg38',
                loc: 'chr12:72,270,700-72,275,700',
                tracks: [{ ...BREAKPOINT_READS, height: 150 }],
              },
            ],
          },
        ],
      }),
      // 5 kb a panel. A wider window means more reads stack, which is what
      // kept this at 380 bp before -- the answer to that is
      // `split: 'only'` above rather than a narrower frame, and the
      // split subset fits the panel at 2 px a row.
      // The connections rather than a delay -- the overlay publishes
      // `<trackId>-loaded` only once a read has matches on BOTH panels, which
      // is exactly the thing this pane exists to show.
      readySelector: `[data-testid="${TUMOUR}-loaded"]`,
      // The COLO829 tumour track is a CRAM streamed from ont-open-data, and
      // decoding it takes long enough on a CI runner that 120000 failed all
      // four sweeps of .github/workflows/figures.yml — deterministically, not
      // under load. The files answer in under half a second, so the ceiling is
      // decode-and-draw, not the fetch. Same fix as orthofinder_synteny/wheat.
      readyTimeout: 300000,
      // Where each half's reads were aligned, on the half itself (reviewer: "if
      // it was shown how this was done, it is ideal e.g. text blurb saying
      // 'reads aligned to the derived contig'"). It has to be on-image rather
      // than in the caption: `direction: 'horizontal'` composes two captures
      // and a reader's eye is inside a pane, not at the caption, when the
      // question "aligned to WHAT?" comes up. Anchored to the track band so the
      // pill follows the pileup rather than a measured y.
      annotations: [
        // A NUMBER on each half (reviewer: "maybe even numbering"). The two are
        // separate captures `+append`ed afterwards, so nothing can draw across
        // the seam to say "this pane, then that one"; a badge in the same
        // corner of each says it in the order a reader reads.
        {
          type: 'circle',
          text: '1',
          anchor: { view: [0, 0], track: TUMOUR, fracY: 0, alignX: 'left' },
          radius: 15,
          dx: 24,
          dy: 78,
        },
        {
          type: 'text',
          text: 'aligned to hg38',
          // `view: [0, 0]` is the split view's UPPER panel -- an anchor's view
          // is a path, and both panels carry the same trackId, so without the
          // path this resolves to whichever the session lists first by
          // accident rather than on purpose.
          anchor: {
            view: [0, 0],
            track: TUMOUR,
            fracY: 0,
            alignX: 'left',
            dx: 10,
            dy: 30,
          },
        },
      ],
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
            type: 'LinearAlignmentsDisplay',
            showSoftClipping: true,
            // 29 reads rather than 200, so they get a row an order of magnitude
            // taller than the reference pane's and the pane fills with 380 bp
            // of pileup
            // EVERY ROW, and the row count is 43, not the 29 an older note
            // here asserted. 29 is the number of reads spanning ALL FOUR
            // junctions, which the tutorial's prose is about; what this 380 bp
            // window draws is every read overlapping it, and
            // `samtools view -c ... der3_RARB_BICC1_TRHDE:32545-32925` says 43
            // (69 in the whole BAM). Pitch is `featureHeight + 1` above 3px
            // (featureSpacingForHeight), so 43 rows need 387 px and the 425 px
            // this track has left over its coverage band fits them with room.
            // At 11 they overflowed and the pileup ended on a scrollbar, which
            // is the "pileup that stops" failure this number exists to avoid --
            // and neither size report catches it, because the overflow is
            // inside a track.
            featureHeight: 8,
            height: 470,
          },
        ],
      }),
      readyText: '32,5',
      readyTimeout: 90000,
      // The other half of the same label, and the one the reviewer asked for by
      // name. Short enough to stay one line: the first version named the tool
      // too ("... (sv_multihop.py derive)") and wrapped to three lines that
      // covered the track header and the top of the pileup. The tool is in the
      // caption and in the tutorial's Reproduce section, which is where a
      // sentence belongs; a callout is a label.
      annotations: [
        // the other half of the pair's numbering, in the same corner of the
        // pane and at the same offset below its label
        {
          type: 'circle',
          text: '2',
          anchor: { track: 'reads_vs_der3', fracY: 0, alignX: 'left' },
          radius: 15,
          dx: 24,
          dy: 78,
        },
        {
          type: 'text',
          text: 'realigned to the derived contig',
          anchor: {
            track: 'reads_vs_der3',
            fracY: 0,
            alignX: 'left',
            dx: 10,
            // clear of the track header: fracY 0 is the top of the rendering
            // container and a pill is ~44px tall, so a smaller offset draws it
            // across the track name
            dy: 30,
          },
        },
      ],
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
    viewportHeight: MULTIHOP_HEIGHT,
    viewportWidth: MULTIHOP_WIDTH,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      // tight enough that both chr3 breakpoints (25,359,111 and 25,359,568) sit
      // near the middle rather than against the right edge
      loc: 'chr3:25,357,600-25,361,000',
      tracks: [
        // no gene track: this window is deep inside RARB's first intron, so the
        // glyph is a line with arrows on it, and the other half of the figure
        // names every gene the chain touches
        //
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
        // TWO PIXELS A ROW, not the one every other cancer_sv pileup takes: the
        // pileups are 259 and 129 rows, so at 1px they are 388px of a frame
        // that has to reach the chain's height beside it and the rest is blank
        // page. At 2px they fill it and the clipping is a wall of colour rather
        // than a hairline. Each height is that pileup as drawn plus its own
        // coverage lane, measured off the render — 580/300 left 128 and 90 px of
        // white inside the two track boxes, which no size report catches because
        // the blank is inside a track rather than below the fold.
        {
          trackId: TUMOUR,
          ...DEEP_ONT,
          showSoftClipping: true,
          height: 470,
          featureHeight: 2,
        },
        {
          trackId: NORMAL,
          ...DEEP_ONT,
          showSoftClipping: true,
          height: 215,
          featureHeight: 2,
        },
      ],
    }),
    annotations: [
      {
        type: 'text',
        text: `Right-click a breakend → ${SPLIT_VIEW_MENU_LABEL}`,
        fontSize: 17,
        maxWidth: 260,
        leader: true,
        anchor: { selector: '[data-testid="feature-name-r_12_1"]' },
        dx: -30,
        dy: 95,
      },
    ],
  },

  // The other half: the same event as the chain of loci it visits, as the split
  // view the callset's breakend walk opens from the chr3 record
  // (cancer_sv/split_view_from_breakend shows the clicks). The three loci are
  // the walk's own answer, which walkBreakendChain.test.ts asserts against the
  // demo's records, and the per-panel heights are what fit three panels in the
  // frame the tumour-over-normal half is sized to.
  {
    mode: 'url',
    name: 'cancer_sv/multihop_split_view',
    viewportWidth: MULTIHOP_WIDTH,
    viewportHeight: MULTIHOP_CHAIN_HEIGHT,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'BreakpointSplitView',
          displayName: 'RARB (chr3) - BICC1 (chr10) - TRHDE (chr12)',
          views: [
            'chr3:25,354,568-25,364,568',
            'chr10:58,712,464-58,722,464',
            'chr12:72,268,294-72,278,294',
          ].map(loc => ({
            assembly: 'hg38',
            loc,
            tracks: [
              { ...GENE_TRACK, height: MULTIHOP_GENE_HEIGHT },
              {
                trackId: TUMOUR,
                ...DEEP_ONT,
                showSoftClipping: true,
                height: 160,
                ...SUPER_COMPACT,
              },
            ],
          })),
        },
      ],
    }),
    readySelector: `[data-testid="${TUMOUR}-loaded"]`,
    readyTimeout: 300000,
    hideTooltip: true,
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
    annotations: [
      {
        type: 'arrow',
        strokeWidth: 10,
        fromAnchor: { selector: '[data-part="0"]', alignX: 'right', dx: -160 },
        anchor: { selector: '[data-part="1"]', alignX: 'left', dx: 100 },
      },
    ],
  },

  // sv_multihop.py derive's contig against its three source loci. The chr3
  // window is 13 kb so the two inserts and the inverted return stay legible:
  // a synteny panel gives each region its share of the width by bp, so every
  // bp of zoom comes out of chr3.
  //
  // No realigned-read lane on the allele. derive realigns only the reads that
  // span every locus, and 18 of those 29 split at derivative 32,275, where the
  // fold-back's inverted copy of chr3 begins: a read whose return arm runs past
  // the contig's end aligns that arm onto the forward copy instead, so the
  // same bases count twice left of 32,275. The lane's coverage step was once
  // read as the intact homolog's reads stopping, which no read in that BAM can
  // be. derivative_inserts carries the realigned reads at base scale.
  {
    mode: 'url',
    name: 'cancer_sv/derivative_synteny',
    viewportHeight: 895,
    viewportWidth: 1600,
    url: sessionSpec(CONFIG, {
      sessionTracks: [DER3_GENES_TRACK, TRUTH_SET_TRACK],
      views: [
        {
          type: 'LinearSyntenyView',
          displayName: 'Reconstructed derivative allele vs hg38',
          views: [
            {
              assembly: 'hg38',
              trackLabels: 'overlapping',
              loc: 'chr3:25350000-25363000 chr10:58716500-58718500 chr12:72272000-72274500',
              highlight: [
                {
                  refName: 'chr3',
                  assemblyName: 'hg38',
                  label: 'junctions',
                  start: 25358000,
                  end: 25360600,
                },
                {
                  refName: 'chr3',
                  assemblyName: 'hg38',
                  label: 'not in the allele',
                  start: 25360600,
                  end: 25363000,
                  color: 'rgba(60,65,72,0.10)',
                },
              ],
              tracks: [
                {
                  ...GENE_TRACK,
                  type: 'LinearBasicDisplay',
                  displayMode: 'compact',
                  height: 50,
                },
                { trackId: TRUTH_SET, displayMode: 'collapsed', height: 30 },
                // The same molecules against hg38, split reads only, one row
                // per molecule across the three windows. Grey reads: the only
                // colours left are the connectors, which the legend names.
                {
                  trackId: TUMOUR,
                  ...DEEP_ONT,
                  filterBy: { split: 'only' },
                  linkedReads: 'normal',
                  showBezierConnections: true,
                  flipStrandLongReadChains: false,
                  heightMode: 'grow',
                  height: 200,
                  coverageHeight: 30,
                  featureHeight: 3,
                  readConnections: 'arc',
                  readConnectionsHeight: 110,
                  showLegend: true,
                },
              ],
            },
            {
              assembly: 'der3_RARB_BICC1_TRHDE',
              // the same total span as the row above, so the ribbons run
              // near-vertical
              loc: 'der3_RARB_BICC1_TRHDE:22,000-39,549',
              trackLabels: 'offset',
              tracks: [
                {
                  trackId: 'der3_segments',
                  type: 'LinearBasicDisplay',
                  displayMode: 'compact',
                },
                {
                  ...GENE_TRACK,
                  trackId: DER3_GENES_TRACK.trackId,
                  type: 'LinearBasicDisplay',
                  displayMode: 'compact',
                  height: 74,
                },
              ],
            },
          ],
          tracks: [['der3_vs_hg38']],
          drawCurves: true,
          color: { field: 'reference' },
          levelHeights: [88],
        },
      ],
    }),
    annotations: [
      {
        type: 'text',
        anchor: {
          view: [0, 1],
          track: DER3_GENES_TRACK.trackId,
          fracY: 0,
          alignX: 'left',
          dx: 40,
          dy: 20,
        },
        text: 'Fold-back: chr3, two short inserts, then the same chr3 stretch again, inverted',
        fontSize: 18,
        maxWidth: 900,
      },
      {
        type: 'text',
        text: 'Dark rows: each molecule crosses this stretch twice, forward and then inverted',
        fontSize: 17,
        maxWidth: 380,
        leader: true,
        anchor: {
          view: [0, 0],
          track: TUMOUR,
          locus: 'chr3:25,356,000',
          fracY: 0.8,
        },
        dx: -140,
        dy: -30,
      },
    ],
  },
  // The same reconstruction at the scale of the stitching. Above, the tumour's
  // split reads against hg38 stop at each junction, and the validated calls
  // sit where they stop; below, the spanning reads realigned to derive's
  // contig mostly cross all four junctions. That realignment checks that the reads
  // agree with the consensus they were polished into, so the independent
  // evidence is the truth-set lane, not the lane under the allele.
  {
    mode: 'url',
    name: 'cancer_sv/derivative_inserts',
    viewportHeight: 1345,
    viewportWidth: 1600,
    url: sessionSpec(CONFIG, {
      sessionTracks: [DER3_GENES_TRACK, TRUTH_SET_TRACK],
      views: [
        {
          type: 'LinearSyntenyView',
          displayName: 'Two templated inserts join the chr3 arms',
          views: [
            {
              assembly: 'hg38',
              // TWICE THE WINDOW ON EACH LOCUS, keeping the centres. At 800 /
              // 360 / 320 bp every panel was filled edge to edge by the reads
              // that built the allele, so the pileup ended where the PANEL
              // ended and a reader could not tell a tear from a crop. The chr3
              // window is the one that pays: its junction is at 25,359,568 and
              // the old right edge was 132 bp past it, which reads as margin;
              // 532 bp of reference with no read on it reads as the piece this
              // allele abandons. The other two widen with it because the three
              // share one panel width in proportion to their bp, so leaving
              // them would have squeezed both inserts into slivers.
              //
              // Not wider than 2x: the chr3 window holds BOTH the outgoing
              // junction and the return of the inverted arm at 25,359,111, and
              // those 457 bp are the structure the bezier connectors are drawn
              // over. At 2x they are still better than a quarter of the panel;
              // past that the two junctions close up on each other.
              loc: 'chr3:25358500-25360100 chr10:58717200-58717920 chr12:72272880-72273520',
              // the genes each junction lands in, named. All three windows are
              // deep inside an intron, so the glyphs are lines rather than exon
              // stacks, but they answer which gene each piece was taken from
              // without the reader going back to the text
              tracks: [
                { ...GENE_TRACK, displayMode: 'compact', height: 55 },
                { trackId: TRUTH_SET, displayMode: 'collapsed', height: 30 },
                // THE SAME MOLECULES AGAINST hg38 (reviewer: "can the reads be
                // shown aligned to the hg38 also?"), and at this zoom the two
                // lanes make the comparison the whole figure is for: a read
                // that runs through every junction below STOPS at one here,
                // with the rest of it soft-clipped, in all three windows at
                // once.
                //
                // NO SOFT CLIPPING, though it is the obvious thing to reach
                // for here and was tried: a clipped ONT tail is drawn base by
                // base as mismatch colour, and at 800 bp across the frame the
                // tails of every split read fill the whole chr3 window with
                // rainbow hash -- the same "mismatch-coloured hash that reads
                // as data and is not" the reference-sequence lanes were
                // removed for. Off, every read simply STOPS on the junction
                // and the pileup's right edge is a straight line at
                // 25,359,568, which is the tear, said once. Same subset and
                // the same reason as the sibling lane on derivative_synteny:
                // split alignments only.
                // `linkedReads` (reviewer: "please enable 'view as
                // pairs/link supplementary reads' in first row"). At this zoom
                // it is the whole comparison in one lane: a molecule's pieces
                // share a row across the three windows, so the row breaks
                // exactly where the reference does and the lane below shows
                // the same molecule unbroken.
                {
                  trackId: TUMOUR,
                  ...DEEP_ONT,
                  filterBy: { split: 'only' },
                  linkedReads: 'normal',
                  // curved connectors, same reviewer note and same reason as the
                  // sibling lane on derivative_synteny: chain mode alone leaves
                  // `bezierArcScope` at 'crossRegion', which draws a normal join
                  // as a straight hairline. It matters more here than there --
                  // this is the base-scale panel, where the point IS that a row
                  // stops at the junction, and the curve is what carries the eye
                  // to where the same molecule picks up again.
                  showBezierConnections: true,
                  // NOT super-compact, unlike every other pileup in this
                  // tutorial, and the connectors above are the whole reason
                  // (reviewer: "it is too hard to see the bezier curves"). A
                  // curve is drawn from one read's row to the other's and then
                  // dipped by an amount keyed on its horizontal SPAN
                  // (bezierConnector.ts, saturating toward 110px), so at a 1px
                  // pitch 28 molecules put 28 curves, each wanting tens of px
                  // of dip, into a 28px band: they bottom out together against
                  // the lane's lower edge and publish as one purple smear with
                  // no individual curve in it. Row pitch is what the overlay
                  // has to draw in, so the lane pays for it -- 6px (5 + the
                  // 1px gap featureSpacingForHeight adds above 3) is 168px of
                  // rows, and at the ~1/3 downscale this figure publishes at, a
                  // row and the curve leaving it each survive as their own
                  // mark.
                  //
                  // 'grow' rather than a fixed height for the same reason as
                  // the sibling lane on derivative_synteny: a configured
                  // featureHeight is ignored while fitting, so the pitch only
                  // takes effect once the lane stops deriving it.
                  heightMode: 'grow',
                  height: 170,
                  featureHeight: 5,
                  // NEUTRAL READS, both lanes (review: "consider turning off
                  // colorby:strand settings. the reads could all be grey and i
                  // think story would be the same. both top and bottom views").
                  //
                  // It is not `colorBy` that paints them, which is worth knowing
                  // before reaching for the obvious key: under CHAIN layout an
                  // unpaired read whose chain carries a supplementary segment is
                  // framed against the orientation the chains on screen agree on
                  // (readColorCategory's unpaired classifier), whatever scheme is
                  // set. Dropping `colorBy` was rendered and changes nothing.
                  //
                  // `flipStrandLongReadChains` is the switch that classifier is
                  // gated on, so turning it off lets the reads fall through to
                  // the scheme's own fill. What the figure loses is a colour
                  // saying "this segment flipped at the junction", and what it
                  // keeps is where each row STOPS and where the same molecule
                  // picks up again -- which the row ends and the connectors
                  // carry, and which is the whole claim.
                  flipStrandLongReadChains: false,
                  // A KEY FOR THE CURVES, which nothing else in the frame
                  // supplies: `showLegend` is opt-in for every color scheme, so
                  // a reader met two families of connector -- an orange
                  // straight line and a purple curve -- with no statement that
                  // they are same-strand and inverted junctions. FloatingLegend
                  // pins to the display's top RIGHT and offers only a `top`
                  // offset, so it lands over the first few rows of the chr12
                  // window and there is no placing it elsewhere. Worth the
                  // trade here: those rows are the same 28 molecules the other
                  // twenty draw, and nothing else in the frame says what a
                  // curve means.
                  showLegend: true,
                  // A BAND OVER THE SPLIT SUBSET, which is what this lane is
                  // and what the band therefore has to be read as.
                  // `split: 'only'` filters in the worker
                  // (`filterChainFeatures`), before partitioning and therefore
                  // before `runCoveragePipeline`, so the depth here counts only
                  // the chimeric reads drawn under it and is NOT tumour
                  // coverage. That is why it used to be off, and what changes
                  // it is the wider window above: the profile now steps down
                  // twice on chr3 -- once where the inverted arm stops
                  // contributing at 25,359,111, then to nothing at the junction
                  // at 25,359,568 -- and holds at nothing across the reference
                  // the allele abandons. The ragged right edge of a pileup says
                  // that once; a profile says it as a height, in each of the
                  // three windows at the same time.
                  //
                  // The der3 lane's band below is unfiltered realigned depth,
                  // so the two are NOT comparable as numbers and nothing in the
                  // frame could say so -- the caption names this lane as split
                  // alignments only for that reason.
                  showCoverage: true,
                  coverageHeight: 40,
                  // THE THREE JUNCTIONS AS COUNTED ARCS (review: "please add
                  // readconnections arcs to this figure"), which this figure
                  // could not have before: an inter-chromosomal connection drew
                  // as two ticks until both-feet-on-screen arcs landed, and all
                  // three of this allele's junctions have both feet in these
                  // three panels -- chr3:25,359,568 into chr10:58,717,463, chr10
                  // into chr12:72,273,111, and chr12 back into the inverted chr3
                  // arm at 25,352,683.
                  //
                  // It says something the bezier fan above it cannot. A curve
                  // per molecule shows each junction is real and cannot weigh
                  // them against each other, because 28 near-identical curves
                  // and 3 look alike; the band coalesces each junction into one
                  // mark whose stroke width is its support, so the three
                  // junctions of one allele are comparable at a glance. The
                  // per-molecule fan stays: it is what says a single read runs
                  // through all three.
                  //
                  // Default band height rather than a chosen one, as on
                  // k562_bcr_abl_split: three arcs is not a pile-up, and the
                  // band is under the coverage profile where it has the whole
                  // strip to itself.
                  readConnections: 'arc',
                },
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
                  displayMode: 'compact',
                  height: 95,
                },
                // TALLER ROWS AND NO COVERAGE BAND, on review ("the read stack
                // looks really messy also, can it use view-as-pairs/link supp
                // reads or anything to simplify the stack?").
                //
                // "No supplementary to chain" is what an earlier version of
                // this note said and it was wrong (reviewer: "are you certain
                // these are all single end ont reads? i think many of them are
                // likely split supplementary alignments"). `samtools view` over
                // this exact window returns 46 records with the flag histogram
                // 11x0, 7x16, 2x256, 13x272, 3x2048, 10x2064: 18 primary, 15
                // SECONDARY and 13 SUPPLEMENTARY, from 29 distinct read names.
                // None of them is paired (0 records with 0x1), so the
                // "single-end" half of that claim stands and view-as-pairs is
                // still not the lever -- but a third of the lane was competing
                // placements and another quarter was split segments, both drawn
                // as though each were its own molecule. `linkedReads` and the
                // secondary filter below are the fix; see the sibling lane on
                // derivative_synteny, where the same file over the whole allele
                // is 53 non-secondary records from 29 molecules.
                //
                // `mismatchAlpha` was an earlier guess and was measured rather
                // than assumed -- it fades a tick by `min(1, qual/50)`, and this
                // BAM's mismatch positions carry Q30-Q50, so it changed the
                // picture by nothing visible. Don't reach for it on R10 data.
                //
                // What is actually wrong is a scale the spec never states: this
                // capture is 3200 px wide and the page draws it about a third
                // of that, so a 5 px row lands under 2 px and 29 of them turn
                // into hash. At `featureHeight` 8 a row survives the downscale
                // as a bar. The coverage band goes to pay for it -- at 1.1 kb
                // it is one flat grey slab, and 29 rows that all span the frame
                // say "flat depth" more directly than a band drawn over them.
                // The band is the whole lane one figure up (derivative_synteny),
                // where the window is 40 kb and rows are the thing that cannot
                // work.
                //
                // 260 px is 28 rows at a pitch of 9 (`featureHeight + 1` above
                // 3 px, featureSpacingForHeight). 28, measured: dropping the 15
                // secondary records leaves 31 in this window over 28 read
                // names, 3 of which have both their segments inside it and so
                // merge into one chain row. (46 rows, the number this lane was
                // sized for, counted every record including the secondaries.)
                {
                  trackId: 'reads_vs_der3',
                  type: 'LinearAlignmentsDisplay',
                  // THE SAME PITCH AS THE hg38 LANE, because this figure is a
                  // comparison and a comparison is drawn at one scale. The
                  // super-compact 1px pitch this lane took (reviewer: "please
                  // show reads as supercompact") published as a ~9px strip of
                  // hash, so once the lane above came off 1px to make its
                  // connectors legible, the readable half of the figure was
                  // the tearing and the unreadable half was the evidence that
                  // the contig fixes it. That is backwards: "these molecules
                  // run unbroken" is the claim, and a reader has to be able to
                  // follow a row across the junctions to check it.
                  //
                  // The height case for 1px is on the record twice over and is
                  // what this reverses; the lane costs ~140px again.
                  heightMode: 'grow',
                  height: 175,
                  featureHeight: 5,
                  // Neutral here too, and this is the lane the strand channel
                  // served worst: these reads are realigned to the reconstructed
                  // allele, where the fold-back has been straightened out, so
                  // every segment agrees with its frame and the lane painted one
                  // colour whatever the scheme said. It was spending a colour
                  // channel to say nothing.
                  flipStrandLongReadChains: false,
                  // THE DEPTH CLAIM, which the tutorial makes in prose ("depth
                  // does not dip at them") and no lane had drawn since this
                  // one's band was dropped. It belongs here rather than on the
                  // hg38 lane: nothing filters this fetch to a subset (the
                  // flagExclude below drops secondaries and unmapped, keeping
                  // primary + supplementary), so the band is the realigned
                  // depth the sentence is about, flat across all four
                  // junctions.
                  coverageHeight: 40,
                  linkedReads: 'normal',
                  filterBy: { flagInclude: 0, flagExclude: 1796 },
                },
              ],
            },
          ],
          tracks: [['der3_vs_hg38']],
          // ON (review: "please use showCurves:true"). The name is `drawCurves`
          // and it is a property of the SYNTENY VIEW rather than of a track, so
          // spelled the other way in `tracks` it is one of the inline keys that
          // are dropped in silence -- the figure would have regenerated
          // identical and read as fixed.
          drawCurves: true,
          // 180 rather than 220: five ribbons crossing need enough band to
          // stay separable and no more, and the 40 px buys most of the row
          // height the reads gained. 140 once the whole frame went compact --
          // below that the two insert ribbons meet inside the crossings.
          levelHeights: [140],
        },
      ],
    }),
    // WHICH ROW IS WHICH GENOME, top and bottom (reviewer: "red box text
    // annotations could be added on top and bottom to say what is being
    // shown"). The location boxes in the header say it, but they say it in
    // 11px grey at the top of the frame and a reader is looking at the ribbons.
    // Two or three words each; the three loci are named on the segment track
    // and in the caption.
    annotations: [
      {
        type: 'text',
        text: 'validated calls, where the reads stop',
        fontSize: 17,
        leader: true,
        dx: 80,
        anchor: {
          view: [0, 0],
          track: TRUTH_SET,
          locus: 'chr3:25,359,568',
          fracY: 0.5,
        },
      },
      {
        type: 'text',
        text: 'hg38, three source loci',
        fontSize: 19,
        anchor: {
          view: [0, 0],
          track: GENES,
          locus: 'chr3:25,358,800',
          fracY: 0.75,
        },
      },
      {
        type: 'text',
        text: 'the derivative allele',
        fontSize: 19,
        // ON THE GENE LANE, not on the reads. It used to sit at fracY 0.88 of
        // `reads_vs_der3`, which was a comfortable margin while that lane was
        // 175px and became a pill taller than the lane once the reads went
        // super-compact -- a label lying across the data it names. The lane
        // above it is the bottom panel's own gene track, so anchoring to its
        // foot puts the pill immediately over the reads without covering them,
        // and it still labels the panel rather than any one track.
        anchor: {
          view: [0, 1],
          track: 'der3_genes',
          alignX: 'left',
          dx: 10,
          fracY: 0.95,
        },
      },
    ],
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
    // ONE ROW OF THREE, at the same height, which is the whole answer to
    // "please extensively reduce the y-real-estate of both the top and bottom
    // figures, potentially reducing width and height of browser too" and to
    // "we may want to make the breakpoint split view launch dialog a single
    // step also so it doesnt require two steps".
    //
    // It used to be four frames in a 2x2, 1,740 px tall, and BOTH halves of
    // that height were avoidable. The dialog is now one step rather than two
    // (BreakpointSplitViewChoiceDialog: the shapes are a selected pair above
    // the options they configure, instead of a screen each), which deletes a
    // frame outright. And the frames left are the same height as each other,
    // so a row of them wastes nothing: the result frame is 1,070 tall only
    // because its two panels each carried a 260 px pileup, and this junction's
    // support reads as clearly at 170.
    //
    // A trailing partial row is padded to full width on the right, so three
    // frames in rows of two would have been a row and a half with a blank
    // quarter. Three columns is the shape the content already has -- menu,
    // dialog, result -- and it is the order the numbers on the frames read in.
    viewportWidth: 900,
    // 612 is what the blank-below report asks for and it is wrong here: the
    // blank it measures is the page under a CENTRED dialog, while the page
    // itself is taller. All three frames take this one, since they share a row.
    viewportHeight: 700,
    stageColumns: 3,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr3:25,359,318-25,359,818',
      tracks: [
        { trackId: SV, height: 130 },
        { trackId: TUMOUR, height: 300, ...SUPER_COMPACT, ...DEEP_ONT },
      ],
    }),
    readyText: '25,359',
    // 300000 for the same reason as realigned_reads_reference above: this waits
    // on the COLO829 CRAM and failed every CI sweep at 90000.
    readyTimeout: 300000,
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
        annotations: [
          FLOW_NUMBER(1),
          { type: 'box', anchor: { text: SPLIT_VIEW_MENU_LABEL } },
        ],
      },
      {
        // The dialog it opens -- now ONE frame rather than two, because it is
        // one dialog rather than two. The shape and the window size are the
        // only two answers it needs and both are on screen at once, so the box
        // goes on "Follow further breakends at each end", which is the setting
        // that decides how much of the rearrangement the result frame holds:
        // the shape is a selected row a reader can see is selected, and the
        // window size is a number whose effect the result already shows.
        actions: [
          { type: 'click', text: SPLIT_VIEW_MENU_LABEL },
          { type: 'waitForText', text: 'Window size (bp)' },
          { type: 'delay', ms: 1000 },
        ],
        annotations: [
          FLOW_NUMBER(2),
          {
            type: 'box',
            anchor: { text: 'Follow further breakends at each end' },
          },
        ],
      },
      {
        // The result, loaded as a session rather than clicked out of the dialog
        // -- the harness's own `stage.url` case for "this frame is a RESULT
        // rather than a step". Driving the last click was tried three ways and
        // each failed differently: `.MuiDialogActions-root button` takes the
        // FIRST button (which was Back), a `button::-p-text(Open)` compound
        // matched Back too, and a plain `Open` left a second copy of the dialog
        // standing -- the menu item queues one, and the click helper's
        // covered-element fallback can dispatch twice, so the queue holds two.
        // Two of those three are gone with the Back button, but the frame stays
        // declarative: a result frame that is a session is one the live link
        // can open.
        //
        // The panels are what the dialog builds from this record at its default
        // 5 kb window, with "Follow further breakends at each end" left on:
        // each stop +/- 5 kb, both tracks copied onto every panel (Copy tracks /
        // Mirror, checked in the frame above).
        //
        // THREE PANELS, and they are the walk's own answer rather than a
        // choice made here (review, twice: "ideally this workflow would show all
        // three rows like cancer_sv/realigned_reads"). walkBreakendChain leaves
        // r_12's chr10 end by r_13, which is 198 bp away and goes to chr12, and
        // then stops: the only junction at the chr12 end is r_24, whose far end
        // is 457 bp from where the chain started. Those three stops, in this
        // order, are what walkBreakendChain.test.ts asserts against the records
        // as the demo's VCF carries them -- so this session states the same
        // thing the unit test does, and a change to either shows up as a
        // disagreement rather than as a figure nobody re-checked.
        //
        // 40/50 px a lane rather than 65/120: the frame height is shared with
        // the two step frames, and it now has to hold three panels rather than
        // two. Measured rather than guessed at -- the first try at three panels
        // kept 55/90 and the run reported 158 css px of the third panel below
        // the fold, which is 53 a panel. The connectors are what this frame is
        // of, and they are drawn between panels rather than inside one, so the
        // px come off the pileups.
        url: sessionSpec(CONFIG, {
          views: [
            {
              type: 'BreakpointSplitView',
              displayName: 'RARB (chr3) - BICC1 (chr10) - TRHDE (chr12)',
              views: [
                {
                  assembly: 'hg38',
                  loc: 'chr3:25,354,568-25,364,568',
                  tracks: [
                    { trackId: SV, height: 40 },
                    {
                      trackId: TUMOUR,
                      height: 50,
                      ...SUPER_COMPACT,
                      ...DEEP_ONT,
                    },
                  ],
                },
                {
                  assembly: 'hg38',
                  loc: 'chr10:58,712,464-58,722,464',
                  tracks: [
                    { trackId: SV, height: 40 },
                    {
                      trackId: TUMOUR,
                      height: 50,
                      ...SUPER_COMPACT,
                      ...DEEP_ONT,
                    },
                  ],
                },
                {
                  assembly: 'hg38',
                  loc: 'chr12:72,268,294-72,278,294',
                  tracks: [
                    { trackId: SV, height: 40 },
                    {
                      trackId: TUMOUR,
                      height: 50,
                      ...SUPER_COMPACT,
                      ...DEEP_ONT,
                    },
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
        // NO per-stage height any more: the point of this rebuild is that all
        // three frames are one height, so the result meets the step frames
        // rather than the step frames being padded up to it. It gets there on
        // its panels' own track heights (120 a pileup, from 260), which is
        // where the y-real-estate the review asked about actually was. 170 was
        // the first try and left 125 css px of page below the fold, per the
        // run's own report.
        annotations: [FLOW_NUMBER(3, { view: [0, 0] })],
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

  // K562: the caller's whole output, triaged in the SV inspector -- the table of
  // calls beside the circle those same rows draw as chords, one chord per row
  // from its left breakpoint to its right.
  //
  // The SV inspector rather than a bare circular view, and this is a rebuild
  // (review: "it is not just 'filtering' but it is 'only showing chr9 and
  // chr22'. that is confusing probably without close examination. ideally,
  // instead of just plain-old-circular view, using sv inspector might be better
  // here also"). The old pair of circles narrowed by dropping chromosomes, so
  // the two frames shared no geometry: the axis itself moved between them, and
  // nothing in the picture said so. Here the circle is the same circle in both
  // frames, at the same rotation, over the same 455 hg38 contigs. What changes
  // is which rows are in the table, and the chords are exactly those rows.
  //
  // "chr9" as the search term is the whole triage, and the data is what makes it
  // one term: of the 44 calls only BCR--ABL1 and NUP214--XKR3 name chr9
  // anywhere, and each names chr22 as its other end. Two junctions, not one
  // junction's two halves: BCR--ABL1 runs chr22:23,290,413 into
  // chr9:130,854,064 and NUP214--XKR3 runs chr9:131,199,015 into
  // chr22:16,808,083, whose chr22 ends are 6.5 Mb apart. The grid's quick
  // filter matches every visible column at once, so one term reads breakpoints,
  // gene names and annotations alike; on this file it is the breakpoint columns
  // that hit.
  //
  // `filterText` is a session-spec field as of this figure, so both frames are
  // openable links rather than one link and one scripted keystroke. Before it,
  // the search box was uncontrolled DataGrid state and a filtered SV inspector
  // could only be reached by typing into a live app.
  //
  // No stroke-colour expression here, unlike the old circles: the SV inspector
  // builds its own chord track (featuresCircularTrackConfiguration) and that
  // snapshot has no colour slot to set. Support is not lost by dropping it --
  // JunctionReadCount is a column in the table, which states 182 and 154 against
  // the single digits below rather than encoding the same thing as red.
  //
  // A third frame on the front, the import form itself, because the route in is
  // the one part of this that was prose: Add -> SV inspector, then a file type
  // the wizard cannot infer from a `.tsv` extension. Seeded with the assembly
  // and that file type and no uri, which is exactly what the launcher does with
  // a partial init, so the frame is the form as a reader meets it with the two
  // dropdowns already answered.
  {
    mode: 'url' as const,
    name: 'cancer_sv/k562_fusion_inspector_form',
    // the form sizes to its own content, so this is trimmed to it rather than
    // to the two frames it composes with
    viewportHeight: 390,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'SvInspectorView',
          displayName: 'Add → SV inspector, File Type → STAR-Fusion',
          assembly: 'hg38',
          fileType: 'STAR-Fusion',
          height: 620,
        },
      ],
    }),
    readyText: 'Open from track',
    readyTimeout: 60000,
  },
  ...(
    [
      [
        'cancer_sv/k562_fusion_inspector_all',
        undefined,
        'All 44 STAR-Fusion calls',
      ],
      [
        'cancer_sv/k562_fusion_inspector_pair',
        'chr9',
        'Search "chr9": two chr9-chr22 junctions',
      ],
    ] as const
  ).map(([name, filterText, displayName]) => ({
    mode: 'url' as const,
    name,
    // sized off the wider frame: 20 of the 44 rows is enough to read the tail
    // off, and the filtered frame's remaining white space is the narrowing
    viewportHeight: 700,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'SvInspectorView',
          displayName,
          assembly: 'hg38',
          // the same file the K562_star_fusion track in the config below reads;
          // the inspector's import form can also open it straight off that
          // track, which is how a reader gets here without typing a URL
          uri: `${CANCER_SV_BASE}/K562.star-fusion.tsv`,
          // no extension the wizard can infer from (`.tsv`), so name the parser
          fileType: 'STAR-Fusion',
          filterText,
          height: 620,
        },
      ],
    }),
    // the first column header, so this waits on the parsed sheet rather than on
    // the view's own chrome
    readyText: 'JunctionReadCount',
    readyTimeout: 60000,
  })),
  // The fourth frame: where a triaged row GOES. Every row of the table above
  // carries the menu that opens it.
  //
  // ONE LEVEL, TWO REGIONS, NOT A BREAKPOINT SPLIT VIEW (review: "i think the
  // premise of using the two level breakpoint split view is likely bad ... we
  // can show this in a single-level linear-genome-view, with view-as-pairs
  // enabled so that it literally puts the read pairs in a single row in
  // layout, no complex curves"). Two rounds of settings on the split view --
  // flipping chr22, dropping intraview links, half-pixel rows -- each made it
  // less chaotic and none fixed the shape: a stacked view runs its splines DOWN
  // the page, so a molecule is read across a gap that is not the gap the fusion
  // closes.
  //
  // Side by side with `linkedReads: 'normal'`, chain layout merges each
  // molecule's two alignments onto ONE row across the two displayed regions
  // (`mergeChains`), so the connectors go flat and the row count halves. Same
  // layout as `k562_bcr_abl_split`, on the other side of the same amplicon, and
  // the reviewer's "view as pairs" is literally that menu item (Read
  // connections -> View as pairs / link supplementary alignments). Iso-Seq is
  // single-end; what is linked is the SA chain.
  //
  // NUP214--XKR3, not BCR--ABL1: the search leaves two rows because two of the
  // file's junctions join chr9 to chr22, and the rest of the page follows the
  // BCR--ABL1 one.
  //
  // chr22 is `[rev]`, as on the split view and for the same reason: the call is
  // chr9:131199015:+ / chr22:16808083:-, so the transcript runs into XKR3 right
  // to left on chr22's forward coordinates. Flipped, one molecule reads
  // straight across the join.
  {
    mode: 'url' as const,
    name: 'cancer_sv/k562_fusion_inspector_reads',
    viewportHeight: 880,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      // EACH WINDOW ENDS ON ITS OWN BREAKPOINT, on the side facing the join.
      // The fusion transcript only occupies chr9 left of 131,199,015 and chr22
      // below 16,808,083, so a window centred on either breakpoint spends half
      // its width on empty lane AND pushes the two read piles ~700 px apart --
      // which is what turns the connectors from short hops into the long
      // diagonal fan this figure was denied for. chr22 is `[rev]`, so its
      // higher coordinate is drawn leftmost and the breakpoint lands at that
      // region's left edge.
      //
      // WIDER ON THE OUTER SIDES ONLY (review: "it is weirdly 'abbreviated'
      // ideally it would be able to scroll farther to the left and farther to
      // the right", then "zoom out the lgv a bit"). Each window keeps its
      // breakpoint where it was, against the seam, and grows away from it: 4.5
      // kb to 9.5 to 13.0 on chr9, 3.5 kb to 8.6 to 13.0 on chr22. Growing the
      // INNER sides is the thing that cannot be done, and the note above says
      // why.
      //
      // A BIT, and this is the number with a cost attached rather than a free
      // one. The two panels share one bp/px, and the read-by-read fan at the
      // seam -- what the figure is for -- is drawn at that scale, so every kb
      // added to an outer edge is resolution taken off the fan. 1.35x is where
      // that stops being a bit: it puts a further exon or two of each gene in
      // frame while the seam keeps most of its width.
      //
      // Equal windows now, where they were 9.5 and 8.6. With one bp/px, unequal
      // windows are unequal PANEL widths, so the seam sat off-centre for no
      // reason anyone reading the figure could recover.
      loc: 'chr9:131,183,000-131,199,515 chr22:16,792,068-16,808,583[rev]',
      // the call's own breakpoints, one band each, so each side's coverage step
      // has a marked position to sit on
      highlight: [
        { refName: 'chr9', start: 131_198_915, end: 131_199_115 },
        { refName: 'chr22', start: 16_807_983, end: 16_808_183 },
      ],
      tracks: [
        GENE_TRACK,
        {
          trackId: 'K562_star_fusion',
          type: 'LinearVariantDisplay',
          // COLLAPSED, which here means "no labels" (the slot's other job, one
          // row, this lane already had). Both records are the same call seen from
          // its two sides, so both floating labels read `NUP214--XKR3`, and each
          // sits at a breakpoint -- which the framing deliberately puts against
          // the seam. Widening the windows on the review's "zoom out the lgv a
          // bit" moved those two breakpoints close enough in px that the labels
          // overprinted into one unreadable string. Nothing is lost by dropping
          // them: the track's own name says which caller, and the callout names
          // the fusion.
          displayMode: 'collapsed',
          height: 30,
        },
        {
          trackId: 'K562_isoseq',
          type: 'LinearAlignmentsDisplay',
          height: 450,
          coverageHeight: 90,
          // the splice-junction arcs over the coverage were purple domes a
          // reader took for read connections joining the wrong places
          showSashimiArcs: false,
          // a read whose chr9 alignment has a chr22 supplementary IS the
          // fusion's support, so every remaining row crosses the junction
          filterBy: { split: 'only' },
          linkedReads: 'normal',
          // THE LEGEND, WHICH IS THE ANSWER TO "unclear why the reads are
          // red/pink on the left but not on the right" (review). The colours
          // are not a scheme this spec picked, which is why nothing in the spec
          // explained them: colorBy here is `normal`, and under CHAIN layout an
          // unpaired long read whose chain carries a supplementary alignment is
          // coloured by that segment's strand relative to the chain's primary
          // instead (`readColorCategory`, the `isChain && hasSupp && !isPaired`
          // branch). So the frame holds three categories and the legend names
          // all three: `Split segment (same strand)`, `Split segment (inverted)`
          // and plain `Reads` — same/flipped being relative to the chain's
          // frame, which is why the rows do not name a strand. The frame is the
          // orientation the chains on screen agree on
          // (`consensusChainStrandFrames`), no longer each chain's own primary;
          // on this two-locus join both answer the same, and derivative_inserts
          // is the figure where they don't.
          //
          // AND THE LEFT/RIGHT ASYMMETRY THE REVIEWER SAW WAS A BUG, not the
          // classification: `readChainHasSupp` was computed per WORKER CALL and
          // a call sees one window, so a molecule whose primary is in the chr9
          // window and whose supplementary is in the chr22 one was classified
          // twice from half a molecule each time — the primary side reporting
          // "not a split read" (plain) and the far side framing its segment
          // against an invented forward primary. Which is exactly a left/right
          // asymmetry, and exactly not what the legend claimed. Fixed in
          // `reconcileChainSuppAcrossRegions`, so the framing now means what the
          // rows say on both sides of the join, and plain `Reads` is left to the
          // molecules whose other segment is in neither window.
          // `showLegend` is opt-in per track and off by default, so a figure
          // that leans on those colours has to ask for it.
          showLegend: true,
          showBezierConnections: true,
          // THE JUNCTION'S TOTAL, beside the per-molecule fan (review: "please
          // add the readconnections arcs because it now supports
          // interchromosomal assemblies"). Both feet of this connection are on
          // screen -- that is what the two displayed regions are for -- so it
          // coalesces into one arc whose stroke width is its support rather than
          // into the pair of ticks an inter-chromosomal connection used to draw.
          // One junction here, against three on derivative_inserts and two on
          // k562_bcr_abl_split, so what the band adds is a single weighted mark
          // saying how many molecules the fan is: 40-odd near-identical curves
          // and four look alike.
          readConnections: 'arc',
          // arcs whose other end is outside both windows were a fan of thin
          // lines leaving the frame
          drawLongRange: false,
          readConnectionsHeight: 90,
          ...SPLIT_READS,
        },
      ],
    }),
    readyText: 'K562 PacBio Iso-Seq (ENCODE)',
    readyTimeout: 120000,
    annotations: [
      {
        type: 'text' as const,
        text: 'each line is one molecule, NUP214 into XKR3',
        fontSize: 18,
        maxWidth: 250,
        anchor: {
          track: 'K562_isoseq',
          locus: 'chr9:131,195,200',
          fracY: 0.55,
          alignX: 'left',
          dx: 20,
        },
      },
      // THE FLIP, SAID IN THE FRAME (review: "make it clear that the right side
      // is 'horizontally flipped'"). The app does say it, twice, and neither
      // place is where a reader is looking: `[rev]` inside the location box, and
      // a chr22 ruler whose labels descend left to right. Without it the panel
      // reads as an ordinary second locus and the reason the molecules run
      // straight across the seam -- rather than doubling back -- is invisible.
      //
      // In the gene lane rather than over the reads: on the chr22 side that lane
      // holds one glyph at the seam and is empty for the rest of its width,
      // which is the only region of this frame with nothing in it.
      {
        type: 'text' as const,
        text: 'chr22 is flipped: its coordinates run right to left',
        fontSize: 17,
        maxWidth: 330,
        anchor: {
          track: GENES,
          locus: 'chr22:16,805,600',
          fracY: 0.5,
          alignX: 'left',
        },
      },
    ],
  },
  // cancer_sv/k562_starfusion_triage WAS HERE and is gone, in three steps of the
  // same review. It composed four frames of the SV inspector walkthrough, then
  // two ("we do not need screenshots 1 and 2. just keep 3 and 4"), and now none
  // ("remove the first screenshot from this. the second is complex enough as
  // is") -- which leaves one frame, and a composition of one frame is the frame.
  // The tutorial renders `k562_fusion_inspector_reads` directly.
  //
  // Every dropped frame is still a spec, and that is the point rather than an
  // oversight: the Figure's `links=` carries all four as live views, so the
  // import form, the unfiltered 44-row table and the searched pair are each one
  // click from the figure without any of them costing a screen of page. Don't
  // delete them to tidy up.

  // BCR beside ABL1 in one row, the way FusionInspector lays a fusion out:
  // displayed regions in a single view rather than stacked panels, with the
  // called breakpoints banded. Iso-Seq coverage is the thing to read: it steps
  // down at the BCR band and up at the ABL1 band, so the transcript's exons come
  // from BCR up to the junction and from ABL1 after it.
  //
  // THREE REGIONS, NOT TWO, AND THAT IS THE WHOLE POINT OF THE FRAME. K562's
  // BCR--ABL1 is one donor and 24 acceptors (DEMO_DATASETS.md), and the two-
  // window version of this figure framed the SECOND-largest of them: the arc
  // band drew the called e14a2 junction and put everything else into one opaque
  // vertical at the BCR donor, which carried six times the arc's support and
  // said so nowhere a reader could see. A tick means "reaches somewhere you
  // cannot see", so the fix is to show the place -- the third window is the
  // acceptor those molecules actually reach, and adding it turns that vertical
  // into the figure's thickest arc.
  //
  // The two chr9 windows are 7 kb each rather than one wide ABL1 window, and
  // that is forced: an LGV shares one bp/px across displayed regions, so a
  // ~180 kb chr9 panel beside a 7 kb chr22 one leaves BCR under 4% of the width
  // and the read-by-read fan -- the thing this figure is for -- collapses into a
  // smear. Three windows of the same size keep every panel at the zoom the fan
  // is legible at.
  //
  // One level rather than a breakpoint split view: that view stacks the partners
  // one above the other and runs its splines down the page between them, which
  // is a second screen of figure for the same read set. Side by side, the same
  // splines run across the gap the fusion actually closes.
  //
  // LINKED, which is the reviewer's own suggestion ("consider 'view as pairs' or
  // other things to sync across displayed regions") and turns out to be
  // literally that menu item: `Read connections -> View as pairs / link
  // supplementary alignments`. Unlinked, a read's chr22 alignment and its chr9
  // supplementary are packed as two independent rows, so ~250 reads made ~500
  // rows and every connector ran diagonally from wherever one row landed to
  // wherever the other did -- the fan that makes this figure unreadable. In
  // chain mode `mergeChains` (computeChainLayout.ts) merges a chain by NAME
  // across displayed regions and shifts each region's bounds onto its own
  // segment of the packing axis, so a read's two alignments share one row: the
  // connectors go flat, the row count halves, and a reader can follow a single
  // molecule from BCR into ABL1 by running a finger along one line.
  //
  // Not a claim about pairs. Iso-Seq is single-end; what is being linked here
  // is the SA chain, which is the same layout and the same menu item.
  {
    mode: 'url',
    name: 'cancer_sv/k562_bcr_abl_split',
    viewportHeight: 1140,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      // donor, then the two acceptors in genomic order. Each 7 kb, so the three
      // panels are the same scale and an arc's LENGTH says nothing a reader
      // could mistake for support.
      loc: 'chr22:23,286,000-23,293,000 chr9:130,778,000-130,785,000 chr9:130,851,000-130,858,000',
      // the two breakpoints the DepMap STAR-Fusion call reports for BCR--ABL1,
      // one band each, so the coverage step has a marked position to sit on.
      //
      // The middle panel gets NO band, deliberately, and the asymmetry is the
      // figure's negative space: a band here means "a caller reported this", and
      // nothing reported that acceptor. The panel with the most reads under it
      // is the one with no band over it, which is a statement the caption does
      // not have to make.
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
          type: 'LinearAlignmentsDisplay',
          // A fixed lane rather than every molecule: the arc band carries the
          // count, and the first couple of hundred rows carry the shape.
          height: 800,
          coverageHeight: 110,
          showSashimiArcs: false,
          filterBy: { split: 'only' },
          // one row per molecule across both regions -- see the note above
          linkedReads: 'normal',
          showBezierConnections: true,
          // The fan's TOTAL, beside the fan itself. A curve per molecule shows
          // the junction is real and cannot show how many molecules say so --
          // 200 near-identical curves and one curve look alike -- and the arc
          // band coalesces them into one mark whose stroke width is the count.
          //
          // It draws at all only because an interchromosomal connection with
          // both feet on screen is now an arc rather than two ticks -- so which
          // junctions are arcs is a property of the WINDOWS, and the third one
          // was added to move the biggest of them across that line.
          //
          // Measured off the BAM (samtools over the chr22 window, counting chr9
          // SA start positions -- DEMO_DATASETS.md has the method): of 235 chr9
          // SA entries, 169 land in the middle window and 29 in the right one,
          // leaving 37 scattered over 15 sites the frame still does not reach.
          // So the band draws a thick arc into the middle panel, a thinner one
          // into the right, and keeps a tick at the donor for the 37.
          //
          // THE TICK DOES NOT GET THINNER, and that is worth knowing before
          // re-framing this again in the hope that it will: `arcLineWidth` caps
          // at 4x the base width around 44 reads, so 206 reads and 37 reads draw
          // the same 8 device px. What the third window changes is what the
          // marks MEAN -- the two junctions carrying this frame's evidence are
          // arcs now, weighted against each other, and the bar at the donor is
          // the honest remainder instead of the majority of the data hidden in a
          // mark with no way to say so.
          readConnections: 'arc',
          // over the 35 default (review: "increase height of the read
          // connections arcs"). Two arcs and a tick share this band, and at 35
          // the two domes were close enough in height to read as one mark
          // stepping over the middle panel. The slot buys apex separation only,
          // which is exactly what a frame comparing two junctions wants.
          readConnectionsHeight: 90,
          // The key for the arcs and the read fills alike (review: "also need
          // legend"). It is data-driven -- the display lists the colour slots
          // actually present -- so the inter-chromosomal row appears here
          // because this frame's arcs are inter-chromosomal, and it is the row
          // that needed a name: a reader meeting a brown curve across a region
          // divider has nothing else in the frame telling them what brown means.
          showLegend: true,
          ...SPLIT_READS,
        },
      ],
    }),
    // and one pill naming them, in the empty strip on the chr9 side of the
    // join. A coloured line crossing a panel divider is only obviously a
    // connection to someone who already knows the display draws them.
    //
    // THE SECOND PILL ANSWERS THE MIDDLE PANEL (review: "this is confusing
    // because there is a bunch of coverage over a region of the gene glyph
    // without an exon. might be that longest coding is not showing an isoform
    // that is relevant to use").
    //
    // The isoform hypothesis was checked and comes out negative, so it is worth
    // writing down rather than re-deriving. api.genome.ucsc.edu's ncbiRefSeq
    // over chr9:130,775,000-130,790,000 returns three transcripts: both ABL1
    // curated ones (NM_007313.3 from 130,713,042 and NM_005157.6 from
    // 130,835,253) put their exon 2 at 130,854,063-130,854,237, so intron 1
    // spans 130,714,455-130,854,063 in BOTH and this window is 140 kb of it.
    // The only annotated exon inside the window at all is 127 bp of the ncRNA
    // LOC124902288 (XR_007061823.1, 130,782,667-130,782,794), against a coverage
    // block several kb wide. So `geneGlyphMode: 'longestCoding'` is hiding
    // nothing here -- there is no ABL1 isoform with an exon under that
    // coverage, and switching the lane to all isoforms would draw two flat lines
    // instead of one and say the same thing less clearly.
    //
    // Which makes the panel a finding rather than a drawing problem, and the
    // pill says so at the strength DEMO_DATASETS.md licenses -- 154 of the 235
    // chr9 SA entries start at one base here, 151 distinct QNAMEs, and whether
    // that is an alternative acceptor or a recurrent alignment artefact is NOT
    // established. "Not annotated" is what the frame shows; the pill stops
    // there rather than naming it a splice site.
    annotations: [
      {
        type: 'text',
        text: 'each line is one molecule, BCR into ABL1',
        fontSize: 18,
        maxWidth: 250,
        anchor: {
          track: 'K562_isoseq',
          locus: 'chr9:130,851,100',
          fracY: 0.32,
          alignX: 'left',
          dx: 20,
        },
      },
      {
        type: 'text',
        text: 'ABL1 intron 1 — coverage, no annotated exon',
        fontSize: 18,
        maxWidth: 560,
        anchor: {
          track: 'K562_isoseq',
          locus: 'chr9:130,778,200',
          fracY: 0,
          dy: 230,
          alignX: 'left',
          dx: 6,
        },
      },
    ],
  },

  // THE DNA SIDE OF BOTH FUSIONS, in one chr9 window, off two assays that never
  // saw a read of each other: DepMap's WGS copy-number segmentation and the 10X
  // linked-read breakend calls, with the STAR-Fusion junctions over them. No
  // arcs and no reads (the deleted k562_cn_amplicon, below, died on both): what
  // the frame shows is COORDINATES agreeing. A DNA break stands under the
  // copy-number step at each end of the amplified block; the two RNA junctions
  // sit at exon edges, one 122 kb right of its break and one on top of it; and
  // the right-hand break reaches chr13, where nothing is transcribed, so no
  // fusion caller could report it. That last one is the negative.
  //
  // Paired-arc displays for both call tracks rather than the variant display's
  // 1 bp boxes: at 400 bp/px a breakpoint is under a pixel, and the arc
  // display's mate tick draws the same record as a 20 px arm pointing at the
  // side the derivative keeps.
  //
  // The bands are the three DNA breaks, 4 kb wide so they survive the scale.
  {
    mode: 'url',
    name: 'cancer_sv/k562_amplicon_dna',
    viewportHeight: 620,
    viewportWidth: 1600,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr9:130,690,000-131,320,000',
      highlight: [
        { refName: 'chr9', start: 130_729_760, end: 130_733_760 },
        { refName: 'chr9', start: 131_197_198, end: 131_201_198 },
        { refName: 'chr9', start: 131_278_138, end: 131_282_138 },
      ],
      tracks: [
        GENE_TRACK,
        {
          trackId: 'K562_star_fusion',
          type: 'LinearMarkDisplay',
          height: 50,
          marks: [
            {
              mark: 'link',
              size: 2,
              encoding: {
                x2: { chrom: 'mate.refName', pos: 'mate.start' },
                color: '#a65628',
              },
              transform: [{ type: 'mate' }],
            },
          ],
        },
        {
          trackId: 'K562_10x_sv',
          type: 'LinearMarkDisplay',
          height: 50,
          marks: [
            {
              mark: 'link',
              size: 2,
              encoding: {
                x2: { chrom: 'mate.refName', pos: 'mate.start' },
                color: '#a65628',
              },
              transform: [{ type: 'mate' }],
            },
          ],
        },
        {
          trackId: 'K562_cn',
          height: 130,
          scales: { y: { domainMin: 0, domainMax: 8 } },
        },
      ],
    }),
    readyText: 'K562 copy-number segments (DepMap WGS)',
    readyTimeout: 120000,
    annotations: [
      {
        type: 'text',
        text: 'BCR-ABL1 junction, called by STAR-Fusion from RNA-seq',
        maxWidth: 600,
        fontSize: 17,
        leader: true,
        anchor: {
          track: 'K562_star_fusion',
          locus: 'chr9:130,854,064',
          fracY: 0.3,
        },
        dx: 60,
        dy: 12,
      },
      {
        type: 'text',
        text: 'DNA break: copy number steps up',
        fontSize: 17,
        leader: true,
        anchor: {
          track: 'K562_10x_sv',
          locus: 'chr9:130,731,760',
          fracY: 0.3,
        },
        dx: 60,
        dy: 12,
      },
      {
        type: 'text',
        text: 'break to chr13, no fusion call',
        fontSize: 17,
        leader: true,
        anchor: {
          track: 'K562_10x_sv',
          locus: 'chr9:131,280,138',
          fracY: 0.3,
        },
        dx: -90,
        dy: 80,
      },
    ],
  },

  // cancer_sv/k562_cn_amplicon WAS HERE and is DELETED, after four review
  // rounds on it (final verdict: "this is not a very strong figure. the arcs
  // from dna failed to clarify, the arcs just end up in the middle of copy
  // number blocks, and there are not reads to orthogonally validate. we may need
  // to delete or fix by finding better evidence"). Deleted rather than fixed
  // because the "better evidence" is not available and the search for it is on
  // the record, so nobody should spend a fifth round on it:
  //
  //  - DepMap 24Q4, which both the copy-number lane and the fusion calls come
  //    from, publishes 73 files and none of them is a structural-variant table
  //    (OmicsCNSegmentsProfile and OmicsFusionFiltered, no
  //    OmicsStructuralVariants). The natural companion to the CN lane does not
  //    exist.
  //  - ENCODE has four K562 WGS experiments and all four are Illumina on hg19.
  //    There is no K562 long-read DNA there at all.
  //  - the one thing that does exist is the 10X Chromium linked-read run
  //    ENCSR053AXS, whose large-SV VCF this figure already drew as its blue
  //    lane. It is calls, not reads, so it cannot be the orthogonal read
  //    evidence the review is asking for.
  //  - the only aligned K562 reads at this locus are the ENCODE Iso-Seq, and
  //    they are the whole of cancer_sv/k562_bcr_abl_split above, at the zoom
  //    where a transcript resolves. Over these three windows they are a 6.22 Mb
  //    fetch, and even force-loaded, 1.25 Mb across ~1500 px puts an exon under
  //    a pixel.
  //
  // WHAT SURVIVES IT is the finding, in the tutorial's prose rather than in a
  // picture, because it is two coordinates rather than a shape: the 10X DNA call
  // puts BCR-ABL1's chr9 end at 130,731,760 and DepMap's segmentation steps up
  // at 130,731,326, with the transcript junction 122 kb inside both. Two assays,
  // two pipelines, one edge. The hosted K562_10x_sv track and the build script
  // that lifts it stay, since that paragraph cites them.
  //
  // The DNA-SV story on the site is told where there are real reads: the COLO829
  // ONT sections above and the C-GIAB PacBio HiFi tutorial.
]
